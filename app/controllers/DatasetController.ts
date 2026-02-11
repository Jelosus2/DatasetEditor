import type { Dataset, GlobalTags, RenamePair } from "../../shared/dataset.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import { shell } from "electron";
import path from "node:path";
import url from "node:url";
import fs from "fs-extra";
import _ from "lodash";

@IpcClass()
export class DatasetController {
    readonly SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
    originalDataset: Dataset | null;
    loadedDirectory: string | null;

    constructor() {
        this.originalDataset = null;
        this.loadedDirectory = null;
    }

    @IpcHandle("dataset:load")
    async loadDataset(_event: IpcMainInvokeEvent, isAllSaved: boolean, reloadDataset: boolean = false) {
        let tmpDirectory: string | null = null;

        if (!isAllSaved && !await this.confirmedUnsavedChanges()) {
            App.logger.info("[Dataset Manager] Dataset load was canceled");
            return { error: false, canceled: true };
        }

        if (!reloadDataset) {
            tmpDirectory = this.loadedDirectory;
            this.loadedDirectory = null;
        }

        const directoryPath = this.loadedDirectory ?? await this.selectDirectory();
        if (!directoryPath) {
            this.loadedDirectory = tmpDirectory;
            App.logger.info("[Dataset Manager] Dataset load was canceled");
            return { error: false, canceled: true };
        }

        try {
            const settings = await App.settings.loadSettings();

            const { dataset, globalTags } = await this.processDatasetDirectory(directoryPath, settings.recursiveDatasetLoad, settings.sortImagesAlphabetically);
            if (dataset.size === 0) {
                App.logger.warning("[Dataset Manager] Skipping dataset load as it constains 0 elements");
                return { error: true, message: "Failed to load the dataset, check the logs for more information" }
            }

            this.originalDataset = dataset;
            this.loadedDirectory = directoryPath;

            App.logger.info("[Dataset Manager] Dataset loaded successfully");
            return { error: false, dataset, globalTags }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error loading the dataset: ${Utilities.getErrorMessage(error)}`);
            this.loadedDirectory = tmpDirectory;
            return { error: true, message: "Error loading the dataset, check the logs for more information" };
        }
    }

    @IpcHandle("dataset:save")
    async saveDataset(_event: IpcMainInvokeEvent, dataset: Dataset) {
        try {
            for (const properties of dataset.values()) {
                const tags = Array.from(properties.tags).join(", ");
                const filePath = properties.path.replace(/\.[^.]+$/, '.txt');

                await fs.outputFile(filePath, tags, { encoding: "utf-8" });
            }

            App.logger.info("[Dataset Manager] Dataset saved successfully");
            this.originalDataset = dataset;

            return { error: false }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error while trying to save the dataset: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to save the dataset, check the logs for more information" }
        }
    }

    @IpcHandle("dataset:compare")
    compare(_event: IpcMainInvokeEvent, dataset: Dataset) {
        if (!this.originalDataset)
            return true;

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
    async trashDatasetPairs(_event: IpcMainInvokeEvent, filePaths: string[]) {
        const results = await Utilities.processMap(filePaths, async (filePath) => {
            try {
                if (await fs.pathExists(filePath))
                    await shell.trashItem(filePath);

                const directory = path.dirname(filePath);
                const filename = path.basename(filePath);

                const txtPath = path.join(directory, filename.replace(/\.[^.]+$/, '.txt'));
                if (await fs.pathExists(txtPath))
                    await shell.trashItem(txtPath);

                return { status: "fulfilled" }
            } catch (error) {
                console.error(error);
                return { status: "rejected", reason: error, path: path.dirname(filePath) }
            }
        });

        const successes = results.filter((result) => result.status === "fulfilled");
        const errors = results.filter((result) => result.status === "rejected");

        App.logger.info(`[Dataset Manager] Sent ${successes.length} pair of files to the trash bin`);

        if (errors.length > 0) {
            for (const error of errors) {
                App.logger.error(`[Dataset Manager] Error deleting pair in ${error.path}: ${Utilities.getErrorMessage(error.reason)}`);
            }

            return { error: true, message: "Error trashing file, check the logs for more information" }
        }

        return { error: false }
    }

    @IpcHandle("dataset:rename")
    async renameDataset(_event: IpcMainInvokeEvent, imagePaths: string[], startAt: number) {
        if (!imagePaths?.length)
            return { error: false, renamedCount: 0 };

        const pairs: RenamePair[] = [];
        const sourceFiles = new Set(imagePaths.map((p) => path.normalize(p.toLowerCase())));

        for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            const directory = path.dirname(imagePath);
            const extension = path.extname(imagePath);
            const newName = `${startAt + i}`;

            const newImagePath = path.join(directory, newName + extension);

            if (await fs.pathExists(newImagePath) && !sourceFiles.has(path.normalize(newImagePath.toLowerCase())))
                return { error: true, message: `Cannot rename: Target '${newImagePath}' exists and is not part of the dataset.` }

            const tempImagePath = path.join(directory, `.tmp_${Date.now()}_img_${i}${extension}`);
            pairs.push({
                from: imagePath,
                to: newImagePath,
                temp: tempImagePath
            });

            const txtPath = imagePath.replace(/\.[^.]+$/, '.txt');
            if (await fs.pathExists(txtPath)) {
                const newTxtPath = path.join(directory, newName + ".txt");

                if (await fs.pathExists(newTxtPath) && !sourceFiles.has(path.normalize(newTxtPath.toLowerCase())))
                    return { error: true, message: `Cannot rename: Target '${newTxtPath}' exists and is not part of the dataset.` }

                const tempTxtPath = path.join(directory, `.tmp_${Date.now()}_txt_${i}.txt`);
                pairs.push({
                    from: txtPath,
                    to: newTxtPath,
                    temp: tempTxtPath
                });
                sourceFiles.add(path.normalize(txtPath.toLowerCase()));
            }
        }

        let processed = 0;
        const concurrency = 50;
        const totalOperations = pairs.length * 2;

        const updateProgress = () => {
            processed++;
            App.window.ipcSend("rename-progress", { processed, total: totalOperations });
        }

        try {
            await Utilities.processMap(pairs, async (pair) => {
                await fs.rename(pair.from, pair.temp);
                updateProgress();
            }, concurrency);

            await Utilities.processMap(pairs, async (pair) => {
                await fs.rename(pair.temp, pair.to);
                updateProgress();
            }, concurrency);

            const mappings = pairs
                .filter((pair) => this.SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(pair.to)))
                .map((pair) => ({ from: pair.from, to: pair.to, mtime: Date.now() }));

            App.logger.info(`[Dataset Manager] Successfully renamed ${pairs.length} files`);
            return { error: false, renamedCount: pairs.length, mappings }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error while renaming dataset: ${Utilities.getErrorMessage(error)}`);
            App.logger.warning("Rename failed. Reverting changes...");

            try {
                await this.rollbackRenameOperation(pairs, concurrency);

                App.logger.info("[Dataset Manager] Rename rollback successful");
                return { error: true, message: "Rename failed, but files were restored to their original names" }
            } catch (rollbackError) {
                console.error(rollbackError);
                App.logger.error(`[Dataset Manager] Rename rollback failed: ${Utilities.getErrorMessage(rollbackError)}`);
                return { error: true, message: "Critical error: rename failed and rollback could not be completed. Please check for files named .tmp" }
            }
        }
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

        return result.filePaths[0];
    }

    async processDatasetDirectory(directoryPath: string, recursive?: boolean, sortOnLoad?: boolean) {
        const dataset: Dataset = new Map();
        const globalTags: GlobalTags = new Map();

        const entries = await fs.readdir(directoryPath, { withFileTypes: true, recursive });
        const files = entries
            .filter((entry) => {
                const fileExtension = path.extname(entry.name).toLowerCase();
                return entry.isFile() && this.SUPPORTED_IMAGE_EXTENSIONS.includes(fileExtension);
            })
            .map((entry) => ({
                filename: entry.name,
                parentPath: entry.parentPath,
                filePath: path.join(entry.parentPath, entry.name)
            }));

        if (sortOnLoad) {
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
            files.sort((a, b) => collator.compare(a.filename, b.filename));
        }

        for (const file of files) {
            const tags = await this.loadImageTags(directoryPath, file.filename);

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

    async loadImageTags(directoryPath: string, filename: string): Promise<Set<string>> {
        const sanitizedName = filename.replace(/\.[^.]+$/, '.txt');
        const txtPath = path.join(directoryPath, sanitizedName);

        if (!await fs.pathExists(txtPath))
            return new Set();

        try {
            const content = await fs.readFile(txtPath, "utf-8");
            return new Set(
                content
                    .split(",")
                    .map((tag) => tag.trim().replaceAll('_', ' ').replaceAll('\\(', '(').replaceAll('\\)', ')'))
                    .filter(Boolean)
            );
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error reading the tags from ${filename}: ${Utilities.getErrorMessage(error)}`)
            return new Set();
        }
    }

    updateGlobalTags(globalTags: GlobalTags, tags: Set<string>, imageName: string) {
        for (const tag of tags) {
            if (!globalTags.has(tag))
                globalTags.set(tag, new Set());

            globalTags.get(tag)!.add(imageName);
        }
    }

    async rollbackRenameOperation(pairs: RenamePair[], concurrency: number) {
        await Utilities.processMap(pairs, async (pair) => {
            if (await fs.pathExists(pair.temp)) {
                await fs.rename(pair.temp, pair.from);
            } else if (await fs.pathExists(pair.to) && pair.to !== pair.from) {
                await fs.rename(pair.to, pair.from);
            }
        }, concurrency);
    }
}
