import type { DatasetImage } from "../types/dataset.js";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import fs from "node:fs/promises";
import { shell } from "electron";
import path from "node:path";
import * as _ from "lodash";
import url from "node:url";

@IpcClass()
export class DatasetController {
    readonly SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
    originalDataset: Map<string, DatasetImage> | null;

    constructor() {
        this.originalDataset = null;
    }

    @IpcHandle("dataset:load")
    async loadDataset(isAllSaved: boolean, directory?: string, recursive?: boolean, sortOnLoad?: boolean) {
        if (!isAllSaved && !await this.confirmedUnsavedChanges())
            return null;

        const directoryPath = directory ?? await this.selectDirectory();
        if (!directoryPath)
            return null;

        try {
            const { dataset, globalTags } = await this.processDatasetDirectory(directoryPath, recursive, sortOnLoad);
            this.originalDataset = dataset;

            return { dataset, globalTags, directoryPath }
        } catch (error: unknown) {
            console.error(error);
            return null;
        }
    }

    @IpcHandle("dataset:save")
    async saveDataset(dataset: Map<string, DatasetImage>) {
        for (const [imageName, properties] of dataset) {
            try {
                const datasetDirectory = path.dirname(properties.path);
                await App.paths.mkdirRecursive(datasetDirectory);

                const tags = Array.from(properties.tags).join(", ");
                const filePath = properties.path.replace(/\.[^.]+$/, '.txt');

                await fs.writeFile(filePath, tags, { encoding: "utf-8" });
            } catch (error: unknown) {
                console.error(error);
            }
        }

        this.originalDataset = dataset;
    }

    @IpcHandle("dataset:compare")
    areDatasetsEqual(dataset: Map<string, DatasetImage>) {
        return _.isEqualWith(this.originalDataset, dataset, (val1, val2) => {
            if (val1 instanceof Set && val2 instanceof Set) {
                if (val1.size !== val2.size)
                    return false;

                for (const tag of val1) {
                    if (!val2.has(tag)) {
                        return false;
                    }
                }
                return true;
            }

            return undefined;
        });
    }

    @IpcHandle("dataset:trash")
    async trashDatasetPairs(filePaths: string[]) {
        const results = await Utilities.processMap(filePaths, async (filePath) => {
            try {
                if (await App.paths.fileExists(filePath))
                    await shell.trashItem(filePath);

                const directory = path.dirname(filePath);
                const fileName = path.basename(filePath);

                const txtPath = path.join(directory, fileName.replace(/\.[^.]+$/, '.txt'));
                if (await App.paths.fileExists(txtPath))
                    await shell.trashItem(txtPath);

                return { status: "fulfilled" }
            } catch (error) {
                console.error(error);
                return { status: "rejected", reason: error as Error, path: filePath }
            }
        });

        const successes = results.filter((result) => result.status === "fulfilled");
        const errors = results.filter((result) => result.status === "rejected");

        if (successes.length > 0) {
            // TODO: Register the log
        }

        if (errors.length > 0) {
            for (const error of errors) {
                const message = `Error deleting pair ${error.path}, with error: ${error.reason?.message}`;
                // TODO: Register the log
            }

            return { error: true, message: "Error trashing file, check the logs for more information" }
        }

        return { error: false }
    }

    async confirmedUnsavedChanges() {
        const result = await App.showMessageBox({
            type: "question",
            title: "Unsaved Changes",
            message: "You have unsaved changes in the dataset. Do you want to continue?",
            buttons: ["Yes", "No"]
        });

        return result.response === 0;
    }

    async selectDirectory() {
        const result = await App.showOpenDialog({
            title: "Select the dataset directory",
            buttonLabel: "Load Dataset",
            properties: ["openDirectory"]
        });

        return result.filePaths?.[0];
    }

    async processDatasetDirectory(directoryPath: string, recursive?: boolean, sortOnLoad?: boolean) {
        const dataset = new Map<string, DatasetImage>();
        const globalTags = new Map<string, Set<string>>();

        const entries = await fs.readdir(directoryPath, { withFileTypes: true, recursive });
        const files = entries
            .filter((entry) => {
                const fileExtension = path.extname(entry.name).toLowerCase();
                return entry.isFile() && this.SUPPORTED_IMAGE_EXTENSIONS.includes(fileExtension);
            })
            .map((entry) => ({
                fileName: entry.name,
                parentPath: entry.parentPath,
                filePath: path.join(entry.parentPath, entry.name)
            }));

        if (sortOnLoad) {
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
            files.sort((a, b) => collator.compare(a.fileName, b.fileName));
        }

        for (const file of files) {
            const tags = await this.loadImageTags(directoryPath, file.fileName);

            let mtimeMs: number;
            try { mtimeMs = (await fs.stat(file.filePath)).mtimeMs } catch { mtimeMs = Date.now() }

            const imageKey = file.filePath.replace(/\\|\\\\/g, '/');
            const filePath = `${url.pathToFileURL(file.filePath).href}?v=${mtimeMs}`;

            dataset.set(imageKey, {
                tags,
                filePath,
                path: file.filePath,
            });

            this.updateGlobalTags(globalTags, tags, imageKey);
        }

        return { dataset, globalTags }
    }

    async loadImageTags(directoryPath: string, fileName: string): Promise<Set<string>> {
        const sanitizedName = fileName.replace(/\.[^.]+$/, '.txt');
        const txtPath = path.join(directoryPath, sanitizedName);

        if (!await App.paths.fileExists(txtPath))
            return new Set();

        try {
            const content = await fs.readFile(txtPath, "utf-8");
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

    updateGlobalTags(globalTags: Map<string, Set<string>>, tags: Set<string>, imageName: string) {
        for (const tag of tags) {
            if (!globalTags.has(tag))
                globalTags.set(tag, new Set());

            globalTags.get(tag)?.add(imageName);
        }
    }
}
