import type { DatasetImage } from "../types/dataset.js";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { App } from "../App.js";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";

@IpcClass()
export class DatasetController {
    readonly SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
    readonly originalDataset: unknown | null;
    readonly thumbnailCache: Map<string, string>;

    constructor() {
        this.originalDataset = null;
        this.thumbnailCache = new Map();
    }

    @IpcHandle("dataset:load")
    async loadDataset(isAllSaved: boolean, directory?: string, recursive?: boolean, sortOnLoad?: boolean) {
        if (!isAllSaved && !this.confirmedUnsavedChanges())
            return null;

        const directoryPath = directory ?? this.selectDirectory();
        if (!directoryPath)
            return null;

        try {
            const { images, globalTags } = this.processDatasetDirectory(directoryPath, recursive, sortOnLoad);
        } catch (error: unknown) {
            console.error(error);
            return null;
        }
    }

    confirmedUnsavedChanges(): boolean {
        const result = App.showMessageBox({
            type: "question",
            title: "Unsaved Changes",
            message: "You have unsaved changes in the dataset. Do you want to continue?",
            buttons: ["Yes", "No"]
        });

        return result === 0;
    }

    selectDirectory() {
        const results = App.showOpenDialog({
            title: "Select the dataset directory",
            buttonLabel: "Load Dataset",
            properties: ["openDirectory"]
        });

        return results?.[0];
    }

    processDatasetDirectory(directoryPath: string, recursive?: boolean, sortOnLoad?: boolean) {
        const images = new Map<string, DatasetImage>();
        const globalTags = new Map<string, Set<string>>();

        const entries = fs.readdirSync(directoryPath, { withFileTypes: true, recursive });
        const files = entries
            .filter((entry) => entry.isFile() && this.SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase()))
            .map((entry) => ({ fileName: entry.name, parentPath: entry.parentPath, filePath: path.join(entry.parentPath, entry.name) }));

        if (sortOnLoad) {
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
            files.sort((a, b) => collator.compare(a.fileName, b.fileName));
        }

        files.forEach((file) => {
            const tags = this.loadImageTags(directoryPath, file.fileName);

            let mtimeMs: number;
            try { mtimeMs = fs.statSync(file.filePath).mtimeMs } catch { mtimeMs = Date.now() }

            const imageKey = file.filePath.replace(/\\|\\\\/g, '/');
            const filePath = `${url.pathToFileURL(file.filePath).href}?v=${mtimeMs}`;

            images.set(imageKey, {
                tags,
                filePath,
                path: file.filePath,
            });
        });

        return { images, globalTags }
    }

    loadImageTags(directoryPath: string, fileName: string): Set<string> {
        const sanitizedName = fileName.replace(/\.[^.]+$/, '.txt');
        const txtPath = path.join(directoryPath, sanitizedName);

        if (!fs.existsSync(txtPath))
            return new Set();

        try {
            const content = fs.readFileSync(txtPath, "utf-8");
            return new Set(
                content
                    .split(",")
                    .map((tag) => tag.trim().replaceAll('_', ' ').replaceAll('\\(', '(').replaceAll('\\)', ')'))
                    .filter(Boolean)
            );
        } catch (error: unknown) {
            console.error(error);
            return new Set();
        }
    }
}
