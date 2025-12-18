import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import fs from "node:fs/promises";
import sharp from "sharp";

@IpcClass()
export class ImageController {
    readonly MAX_CACHE_SIZE = 2000;
    readonly thumbnailCache: Map<string, string>;

    constructor() {
        this.thumbnailCache = new Map();
    }

    @IpcHandle("image:set_background")
    async setBackgroundColor(images: string[], color: string) {
        const results = await Utilities.processMap(images, async (imagePath) => {
            const tempPath = imagePath + ".tmp";

            try {
                await sharp(imagePath)
                    .flatten({ background: color })
                    .toFile(tempPath);

                await fs.rename(tempPath, imagePath);

                let mtimeMs: number;
                try { mtimeMs = (await fs.stat(imagePath)).mtimeMs } catch { mtimeMs = Date.now() }

                // TODO: Send the image update to the renderer process

                return { status: "fulfilled" }
            } catch (error) {
                console.error(error);
                await fs.unlink(tempPath).catch(() => {});
                return { status: "rejected", reason: error as Error, path: imagePath };
            }
        });

        const errors = results.filter((result) => result.status === "rejected");
        if (errors.length > 0) {
            for (const error of errors) {
                const message = `Failed to process image ${error.path}, with error: ${error.reason?.message}`;
                // TODO: Register the log
            }

            return { error: true, message: 'Failed to change background color, check the logs for more information.' };
        }

        // TODO: Register the log
        return { error: false, message: 'Changed background color successfully' };
    }

    async getThumbnail(filePath: string, size?: number) {
        size ??= 256;

        try {
            const { mtimeMs } = await fs.stat(filePath);
            const key = `${filePath}|${mtimeMs}|${size}`;

            if (this.thumbnailCache.has(key)) {
                const value = this.thumbnailCache.get(key);
                this.thumbnailCache.delete(key);
                this.thumbnailCache.set(key, value!);

                return value;
            }

            const buffer = await sharp(filePath)
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
            return null;
        }
    }
}
