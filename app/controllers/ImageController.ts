import type { ImageHash } from "../types/image.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import fs from "fs-extra";
import sharp from "sharp";

@IpcClass()
export class ImageController {
    readonly MAX_CACHE_SIZE = 2000;
    readonly thumbnailCache: Map<string, string>;

    constructor() {
        this.thumbnailCache = new Map();
    }

    @IpcHandle("image:set_background")
    async setBackgroundColor(_event: IpcMainInvokeEvent, images: string[], color: string) {
        const results = await Utilities.processMap(images, async (imagePath) => {
            const tempPath = imagePath + ".tmp";

            try {
                await sharp(imagePath)
                    .flatten({ background: color })
                    .toFile(tempPath);

                await fs.rename(tempPath, imagePath);

                let mtimeMs: number;
                try { mtimeMs = (await fs.stat(imagePath)).mtimeMs } catch { mtimeMs = Date.now() }

                App.window.ipcSend('image-updated', { path: imagePath, mtime: mtimeMs });

                return { status: "fulfilled" }
            } catch (error) {
                console.error(error);
                await fs.remove(tempPath).catch(() => {})
                return { status: "rejected", reason: error, path: imagePath };
            }
        });

        const successes = results.filter((result) => result.status === "fulfilled");
        const errors = results.filter((result) => result.status === "rejected");

        App.logger.info(`[Image Manager] Applied the background color to ${successes.length} images`);

        if (errors.length > 0) {
            for (const error of errors) {
                App.logger.error(`[Image Manager] Failed to process image ${error.path}: ${Utilities.getErrorMessage(error.reason)}`);
            }

            return { error: true, message: 'Failed to change background color, check the logs for more information.' };
        }

        return { error: false, message: 'Changed background color successfully' };
    }

    @IpcHandle("image:create_thumbnail")
    async createThumbnail(_event: IpcMainInvokeEvent, imagePath: string, size?: number) {
        size ??= 256;

        try {
            const { mtimeMs } = await fs.stat(imagePath);
            const key = `${imagePath}|${mtimeMs}|${size}`;

            if (this.thumbnailCache.has(key)) {
                const value = this.thumbnailCache.get(key);
                this.thumbnailCache.delete(key);
                this.thumbnailCache.set(key, value!);

                return value;
            }

            const buffer = await sharp(imagePath)
                .rotate()
                .resize({
                    width: size,
                    height: size,
                    fit: "inside",
                    withoutEnlargement: true
                })
                .webp({ quality: 75 })
                .toBuffer();

            const dataUrl = `data:image/webp;base64,${buffer.toString("base64")}`;

            if (this.thumbnailCache.size > this.MAX_CACHE_SIZE) {
                const oldestKey = this.thumbnailCache.keys().next().value;
                this.thumbnailCache.delete(oldestKey!);
            }

            this.thumbnailCache.set(key, dataUrl);
            return dataUrl;
        } catch (error) {
            console.error(error);
            App.logger.error(`[Image Manager] Failed to generate a thumbnail for image ${imagePath}: ${Utilities.getErrorMessage(error)}`)
            return null;
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
        const total = imagePaths?.length ?? 0;
        if (total === 0)
            return { error: false, groups: [] }

        App.logger.info(`[Image Manager] Finding duplicate images (${method}, threshold=${threshold}) in ${total} files...`);
        App.window.ipcSend("duplicate-progress", { processed: 0, total });

        try {
            const workerPath = new URL("../workers/duplicatesWorker.js", import.meta.url).href;

            const hashes = await Utilities.runWorkerTask<string, ImageHash>(
                imagePaths,
                workerPath,
                (file) => ({ type: "hash", file, method }),
                (processed, total) => App.window.ipcSend("duplicate-progress", { processed, total })
            );

            if (hashes.length < 2)
                return { error: false, groups: [] }

            const groups = this.groupHashesByDistance(hashes, threshold);

            App.logger.info(`[Image Manager] Duplicate search complete, found ${groups.length} group(s)`);
            return { error: false, groups }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Image Manager] Error trying to find duplicate images: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to find duplicates, check the logs for more information" }
        }
    }

    groupHashesByDistance(entries: ImageHash[], threshold: number) {
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
