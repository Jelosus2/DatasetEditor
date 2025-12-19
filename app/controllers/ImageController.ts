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

                App.window.mainWindow?.webContents.send('image-updated', { path: imagePath, mtime: mtimeMs });

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
    async getImageDimensions(imagePath: string) {
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
}
