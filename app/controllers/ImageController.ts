import type { Rect } from "../../shared/image.js";
import type { ImageHash } from "../types/image.js";
import type { IpcMainInvokeEvent } from "electron";
import type { Region } from "sharp";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import path from "node:path";
import fs from "fs-extra";
import sharp from "sharp";
import url from "node:url";

@IpcClass()
export class ImageController {
    constructor() {}

    @IpcHandle("image:set_background")
    async setBackgroundColor(_event: IpcMainInvokeEvent, images: string[], color: string) {
        const results = await Utilities.processMap(images, async (imagePath) => {
            const tempPath = imagePath + ".tmp";

            try {
                await sharp(imagePath)
                    .flatten({ background: color })
                    .toFile(tempPath);

                await fs.rename(tempPath, imagePath);

                return { status: "fulfilled" }
            } catch (error) {
                console.error(error);
                await fs.remove(tempPath).catch(() => {});
                return { status: "rejected", reason: error, path: imagePath };
            }
        });

        const successes = results.filter((result) => result.status === "fulfilled");
        const errors = results.filter((result) => result.status === "rejected");

        App.logger.info(`[Image Manager] Applied the background color to ${successes.length} image(s)`);

        if (errors.length > 0) {
            for (const error of errors) {
                App.logger.error(`[Image Manager] Failed to process image ${error.path}: ${Utilities.getErrorMessage(error.reason)}`);
            }

            return { error: true, message: 'Failed to change background color, check the logs for more information.' };
        }

        return { error: false, message: 'Changed background color successfully' };
    }

    @IpcHandle("image:crop")
    async cropImage(_event: IpcMainInvokeEvent, imagePath: string, cropRects: Rect[], overwrite: boolean) {
        let tempPath: string | null = null;

        try {
            const image = sharp(imagePath);

            const metadata = await image.clone().metadata();
            const imageWidth = metadata.width ?? 0;
            const imageHeight = metadata.height ?? 0;

            if (imageWidth === 0 || imageHeight === 0)
                return { error: true, message: "Could not read image dimensions" };

            const regions = cropRects
                .map((rect) => this.cropRectToRegion(rect, imageWidth, imageHeight))
                .filter((region): region is Region => region !== null);

            if (regions.length === 0)
                return { error: true, message: "No valid crop regions were found" };

            if (overwrite) {
                tempPath = `${imagePath}.crop.tmp`;
                await image.clone().extract(regions[0]).toFile(tempPath);
                await fs.rename(tempPath, imagePath);
                tempPath = null;

                App.logger.info(`[Image Manager] Cropped image (overwrite): ${imagePath}`);
                return { error: false, message: "Image cropped successfully" };
            }

            const result = await App.showOpenDialog({
                title: "Select output folder for cropped images",
                properties: ["openDirectory"]
            });

            const outputDirectory = result.filePaths[0];
            if (!outputDirectory)
                return { error: false, canceled: true };

            const extension = path.extname(imagePath);
            const base = path.basename(imagePath, extension);
            let saved = 0;

            for (let i = 0; i < regions.length; i++) {
                const rawPath = path.join(outputDirectory, `${base}_crop${extension}`);
                const outputPath = await this.getUniquePath(rawPath, i + 1);
                await image.clone().extract(regions[i]).toFile(outputPath);
                saved++;
            }

            App.logger.info(`[Image Manager] Saved ${saved} crop(s) from ${imagePath}`);
            return { error: false, message: `Saved ${saved} cropped image(s)` };
        } catch (error) {
            console.error(error);
            if (tempPath)
                await fs.remove(tempPath).catch(() => {});

            App.logger.error(`[Image Manager] Error cropping image ${imagePath}: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to crop image, check the logs for more information" };
        }
    }

    @IpcHandle("image:dimensions")
    async getImageDimensions(_event: IpcMainInvokeEvent, imagePath: string) {
        try {
            const metadata = await sharp(imagePath).metadata();

            return {
                width: metadata.width ?? 0,
                height: metadata.height ?? 0
            }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Image Manager] Error reading metadata for ${imagePath}: ${Utilities.getErrorMessage(error)}`);
            return { width: 0, height: 0 }
        }
    }

    @IpcHandle("image:find_duplicates")
    async findDuplicates(_event: IpcMainInvokeEvent, imagePaths: string[], method: "dhash" | "phash" = "dhash", threshold: number = 10) {
        const total = imagePaths.length;
        if (total === 0)
            return { error: false, groups: [] };

        App.logger.info(`[Image Manager] Finding duplicate images (${method}, threshold=${threshold}) in ${total} files...`);
        App.window.ipcSend("image:duplicate-progress", { processed: 0, total });

        try {
            const workerPath = url.fileURLToPath(new URL("../workers/duplicatesWorker.js", import.meta.url));

            const hashes = await Utilities.runWorkerTask<string, ImageHash>(
                imagePaths,
                workerPath,
                (file) => ({ type: "hash", file, method }),
                (processed, total) => App.window.ipcSend("image:duplicate-progress", { processed, total })
            );

            if (hashes.length < 2)
                return { error: false, groups: [] };

            const groups = this.groupHashesByDistance(hashes, threshold);

            App.logger.info(`[Image Manager] Duplicate search complete, found ${groups.length} group(s)`);
            return { error: false, groups };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Image Manager] Error trying to find duplicate images: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to find duplicates, check the logs for more information", groups: [] };
        }
    }

    private cropRectToRegion(cropRect: Rect, imageWidth: number, imageHeight: number): Region | null {
        const left = this.clamp(cropRect.x, 0, imageWidth - 1);
        const top = this.clamp(cropRect.y, 0, imageHeight - 1);
        const width = this.clamp(cropRect.width, 1, imageWidth - left);
        const height = this.clamp(cropRect.height, 1, imageHeight - top);

        if (width <= 0 || height <= 0)
            return null;

        return { left, top, width, height };
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, Math.floor(value)));
    }

    private async getUniquePath(filePath: string, start: number) {
        const extension = path.extname(filePath);
        const directory = path.dirname(filePath);
        const base = path.basename(filePath, extension);

        let counter = start;
        while (true) {
            const candidate = path.join(directory, `${base}_${counter}${extension}`);
            if (!await fs.pathExists(candidate))
                return candidate;
            counter++;
        }
    }

    private groupHashesByDistance(entries: ImageHash[], threshold: number) {
        const n = entries.length;
        const parent = new Int32Array(n).map((_, i) => i);

        const find = (i: number) => {
            while (i !== parent[i]) {
                parent[i] = parent[parent[i]];
                i = parent[i];
            }
            return i;
        }

        const union = (i: number, j: number) => {
            const rootA = find(i);
            const rootB = find(j);

            if (rootA !== rootB)
                parent[rootB] = rootA;
        }

        const getDistance = (a: number[], b: number[]) => {
            let d = 0;
            for (let i = 0; i < 8; i++) {
                let x = a[i] ^ b[i];
                while (x) {
                    d++;
                    x &= x - 1;
                }
            }
            return d;
        }

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const distance = getDistance(entries[i].hash, entries[j].hash);
                if (distance <= threshold)
                    union(i, j);
            }
        }

        const groups = new Map<number, string[]>();
        for (let i = 0; i < n; i++) {
            const root = find(i);

            if (!groups.has(root))
                groups.set(root, []);
            groups.get(root)!.push(entries[i].file);
        }

        return Array.from(groups.values()).filter((group) => group.length > 1);
    }
}
