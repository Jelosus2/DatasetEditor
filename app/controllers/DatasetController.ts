import type { Dataset, DatasetPersistable, DatasetRenameOptions, GlobalTags, RenamePair, RenamePreviewItem, RenameProgressPayload } from "../../shared/dataset.js";
import type { RenamePlanEntry } from "../types/dataset.js";
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
    private readonly SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
    private originalDataset: Dataset | null;
    private loadedDirectory: string | null;

    constructor() {
        this.originalDataset = null;
        this.loadedDirectory = null;
    }

    @IpcHandle("dataset:load")
    async loadDataset(_event: IpcMainInvokeEvent, isAllSaved: boolean, reloadDataset = false) {
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
                return { error: true, message: "Failed to load the dataset, check the logs for more information" };
            }

            this.originalDataset = dataset;
            this.loadedDirectory = directoryPath;

            App.logger.info("[Dataset Manager] Dataset loaded successfully");
            return { error: false, dataset, globalTags };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error loading the dataset: ${Utilities.getErrorMessage(error)}`);
            this.loadedDirectory = tmpDirectory;
            return { error: true, message: "Error loading the dataset, check the logs for more information" };
        }
    }

    @IpcHandle("dataset:save")
    async saveDataset(_event: IpcMainInvokeEvent, dataset: DatasetPersistable) {
        try {
            for (const properties of dataset.values()) {
                const tags = Array.from(properties.tags).join(", ");
                const filePath = properties.path.replace(/\.[^.]+$/, ".txt");

                await fs.outputFile(filePath, tags, { encoding: "utf-8" });
            }

            App.logger.info("[Dataset Manager] Dataset saved successfully");
            this.originalDataset = this.transformDataset<Dataset>(dataset, "runtime");

            return { error: false };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error while trying to save the dataset: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to save the dataset, check the logs for more information" };
        }
    }

    @IpcHandle("dataset:compare")
    compare(_event: IpcMainInvokeEvent, dataset: DatasetPersistable) {
        if (!this.originalDataset)
            return true;

        const originalPersistable = this.transformDataset<DatasetPersistable>(this.originalDataset, "persistable");

        return _.isEqualWith(originalPersistable, dataset, (val1, val2) => {
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
        const results: Array<
            | { status: "fulfilled"; filePath: string }
            | { status: "rejected"; reason: unknown; path: string }
        > = [];

        for (const filePath of filePaths) {
            try {
                if (await fs.pathExists(filePath))
                    await shell.trashItem(filePath);

                const directory = path.dirname(filePath);
                const filename = path.basename(filePath);

                const txtPath = path.join(directory, filename.replace(/\.[^.]+$/, ".txt"));
                if (await fs.pathExists(txtPath))
                    await shell.trashItem(txtPath);

                results.push({ status: "fulfilled", filePath });
            } catch (error) {
                console.error(error);
                results.push({ status: "rejected", reason: error, path: path.dirname(filePath) });
            }
        }

        const successes = results.filter((result) => result.status === "fulfilled");
        const errors = results.filter((result) => result.status === "rejected");

        App.logger.info(`[Dataset Manager] Sent ${successes.length} pair of files to the trash bin`);

        if (errors.length > 0) {
            for (const error of errors) {
                App.logger.error(`[Dataset Manager] Error deleting pair in ${error.path}: ${Utilities.getErrorMessage(error.reason)}`);
            }

            return { error: true, message: "Error trashing file, check the logs for more information" };
        }

        const trashedImages = successes.map((entry) => entry.filePath!);
        this.removeImagesFromOriginalDataset(trashedImages);

        return { error: false, message: `Sent ${successes.length} pair of files to the trash bin` };
    }

    @IpcHandle("dataset:rename")
    async renameDataset(_event: IpcMainInvokeEvent, imagePaths: string[], options: DatasetRenameOptions | number) {
        if (!imagePaths.length)
            return { error: false, renamedCount: 0, preview: [], conflicts: 0 };

        const renameOptions = typeof options === "number"
            ? { mode: "sequence", startAt: options } satisfies DatasetRenameOptions
            : options;

        const { plan, preview, conflicts } = await this.createRenamePlan(imagePaths, renameOptions);

        if (renameOptions.dryRun)
            return { error: false, preview, conflicts, renamedCount: 0 };
        if (conflicts > 0)
            return { error: true, message: `Found ${conflicts} naming conflict(s). Adjust options before renaming.`, preview, conflicts };

        const pairs: RenamePair[] = [];
        const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let pairIndex = 0;

        for (const entry of plan) {
            const imageExtension = path.extname(entry.imageFrom);

            pairs.push({
                from: entry.imageFrom,
                to: entry.imageTo,
                temp: path.join(path.dirname(entry.imageFrom), `.tmp_${batchId}_${pairIndex++}${imageExtension}`)
            });

            if (entry.txtFrom && entry.txtTo) {
                pairs.push({
                    from: entry.txtFrom,
                    to: entry.txtTo,
                    temp: path.join(path.dirname(entry.txtFrom), `.tmp_${batchId}_${pairIndex++}.txt`)
                });
            }
        }

        const concurrency = 50;
        const totalOperations = pairs.length * 2;
        let processed = 0;

        const updateProgress = (phase: RenameProgressPayload["phase"], currentPath?: string) => {
            App.window.ipcSend("dataset:rename-progress", {
                phase,
                processed,
                total: totalOperations,
                currentPath
            });
        }

        updateProgress("prepare");

        try {
            await Utilities.processMap(pairs, async (pair) => {
                await fs.rename(pair.from, pair.temp);
                processed++;
                updateProgress("rename_temp", pair.from);
            }, concurrency);

            await Utilities.processMap(pairs, async (pair) => {
                await fs.rename(pair.temp, pair.to);
                processed++;
                updateProgress("rename_final", pair.to);
            }, concurrency);

            const mappings = plan.map((entry) => ({
                from: entry.imageFrom,
                to: entry.imageTo,
                mtime: Date.now()
            }));

            this.applyRenameMappingsToOriginalDataset(mappings);

            updateProgress("done");
            App.logger.info(`[Dataset Manager] Successfully renamed ${plan.length} images`);
            return { error: false, renamedCount: plan.length, mappings, preview, conflicts: 0 };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error while renaming dataset: ${Utilities.getErrorMessage(error)}`);
            App.logger.warning("[Dataset Manager] Rename failed. Reverting changes...");

            try {
                await this.rollbackRenameOperation(pairs, concurrency, totalOperations);

                App.logger.info("[Dataset Manager] Rename rollback successful");
                return { error: true, message: "Rename failed, but files were restored to their original names", preview, conflicts: 0 };
            } catch (rollbackError) {
                console.error(rollbackError);
                App.logger.error(`[Dataset Manager] Rename rollback failed: ${Utilities.getErrorMessage(rollbackError)}`);
                return { error: true, message: "Critical error: rename failed and rollback could not be completed. Please check for files named .tmp", preview, conflicts: 0 };
            }
        }
    }

    @IpcHandle("dataset:open_in_explorer")
    async openInExplorer(_event: IpcMainInvokeEvent, filePath: string) {
        try {
            const normalizedPath = path.normalize(filePath);

            if (!await fs.pathExists(normalizedPath))
                return { error: true, message: "File not found" };

            shell.showItemInFolder(normalizedPath);
            return { error: false };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error opening in explorer (${filePath}): ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to open in explorer, check the logs for more information" };
        }
    }

    private async confirmedUnsavedChanges() {
        const result = await App.showMessageBox({
            type: "question",
            title: "Unsaved Changes",
            message: "You have unsaved changes in the dataset. Do you want to continue?",
            buttons: ["Yes", "No"]
        });

        return result.response === 0;
    }

    private async selectDirectory() {
        const result = await App.showOpenDialog({
            title: "Select the dataset directory",
            buttonLabel: "Load Dataset",
            properties: ["openDirectory"]
        });

        return result.filePaths[0];
    }

    private async processDatasetDirectory(directoryPath: string, recursive?: boolean, sortOnLoad?: boolean) {
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
            const tags = await this.loadImageTags(file.parentPath, file.filename);

            let mtimeMs: number;
            try { mtimeMs = (await fs.stat(file.filePath)).mtimeMs } catch { mtimeMs = Date.now() }

            const imageKey = this.normalizePath(file.filePath);
            const filePath = `${url.pathToFileURL(file.filePath).href}?v=${mtimeMs}`;

            dataset.set(imageKey, {
                tags,
                filePath,
                path: file.filePath,
            });

            this.updateGlobalTags(globalTags, tags, imageKey);
        }

        return { dataset, globalTags };
    }

    private async loadImageTags(directoryPath: string, filename: string): Promise<Set<string>> {
        const sanitizedName = filename.replace(/\.[^.]+$/, ".txt");
        const txtPath = path.join(directoryPath, sanitizedName);

        if (!await fs.pathExists(txtPath))
            return new Set();

        try {
            const content = await fs.readFile(txtPath, "utf-8");
            return new Set(
                content
                    .split(",")
                    .map((tag) => tag.trim().replaceAll("_", " ").replaceAll("\\(", "(").replaceAll("\\)", ")"))
                    .filter(Boolean)
            );
        } catch (error) {
            console.error(error);
            App.logger.error(`[Dataset Manager] Error reading the tags from ${filename}: ${Utilities.getErrorMessage(error)}`);
            return new Set();
        }
    }

    private updateGlobalTags(globalTags: GlobalTags, tags: Set<string>, imageName: string) {
        for (const tag of tags) {
            if (!globalTags.has(tag))
                globalTags.set(tag, new Set());

            globalTags.get(tag)!.add(imageName);
        }
    }

    private transformDataset<T extends Dataset | DatasetPersistable>(
        dataset: Dataset | DatasetPersistable,
        targetType: "runtime" | "persistable"
    ): T {
        const result = new Map() as T;

        for (const [key, image] of dataset.entries()) {
            if (targetType === "runtime") {
                (result as Dataset).set(key, {
                    path: image.path,
                    tags: image.tags,
                    filePath: url.pathToFileURL(image.path).href
                });
            } else {
                (result as DatasetPersistable).set(key, {
                    path: image.path,
                    tags: image.tags
                });
            }
        }

        return result;
    }

    private normalizePath(path: string) {
        return path.replace(/\\|\\\\/g, "/");
    }

    private normalizeStartAt(startAt?: number) {
        const normalized = Number.isFinite(startAt) ? Math.trunc(startAt!) : 1;
        return normalized > 0 ? normalized : 1;
    }

    private normalizePadding(padding?: number) {
        const normalized = Number.isFinite(padding) ? Math.trunc(padding!) : 0;
        return Math.max(0, Math.min(12, normalized));
    }

    private sanitizeFilenameSegment(segment: string) {
        const sanitized = segment
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
            .replace(/\s+/g, " ")
            .trim();

        if (!sanitized || sanitized === "." || sanitized === "..")
            return "_";

        return sanitized;
    }

    private buildTargetBaseName(imagePath: string, index: number, options: DatasetRenameOptions) {
        const extension = path.extname(imagePath);
        const currentName = path.basename(imagePath, extension);
        const startAt = this.normalizeStartAt(options.startAt);
        const padding = this.normalizePadding(options.padding);
        const nextIndex = startAt + index;
        const indexStr = String(nextIndex).padStart(padding, "0");

        if (options.mode === "sequence")
            return this.sanitizeFilenameSegment(indexStr);

        const template = options.template?.trim() || "{index}_{name}";
        const target = template
            .replaceAll("{index}", indexStr)
            .replaceAll("{name}", currentName)
            .replaceAll("{ext}", extension.replace(".", ""));

        return this.sanitizeFilenameSegment(target);
    }

    private async createRenamePlan(imagePaths: string[], options: DatasetRenameOptions) {
        const sourceFiles = new Set(imagePaths.map((entry) => path.normalize(entry.toLowerCase())));
        const seenTargets = new Set<string>();
        const plan: RenamePlanEntry[] = [];
        const preview: RenamePreviewItem[] = [];

        let conflicts = 0;

        for (let i = 0; i < imagePaths.length; i++) {
            const imageFrom = imagePaths[i];
            const directory = path.dirname(imageFrom);
            const extension = path.extname(imageFrom);
            const nextBase = this.buildTargetBaseName(imageFrom, i, options);
            const imageTo = path.join(directory, `${nextBase}${extension}`);
            const imageToKey = path.normalize(imageTo.toLowerCase());

            let hasConflict = false;
            let reason: string | undefined;

            const markConflict = (message: string) => {
                if (!hasConflict) {
                    hasConflict = true;
                    reason = message;
                }
            }

            if (seenTargets.has(imageToKey))
                markConflict("Two files would be renamed to the same destination.");
            else
                seenTargets.add(imageToKey);

            if (!hasConflict && await fs.pathExists(imageTo) && !sourceFiles.has(imageToKey))
                markConflict(`Target file already exists: ${path.basename(imageTo)}`);

            const txtFrom = imageFrom.replace(/\.[^.]+$/, ".txt");
            const hasTxtPair = await fs.pathExists(txtFrom);
            const txtFromKey = path.normalize(txtFrom.toLowerCase());
            if (hasTxtPair)
                sourceFiles.add(txtFromKey);

            let txtTo: string | null = null;

            if (hasTxtPair) {
                txtTo = path.join(directory, `${nextBase}.txt`);
                const txtToKey = path.normalize(txtTo.toLowerCase());

                if (seenTargets.has(txtToKey))
                    markConflict("Two caption files would be renamed to the same destination.");
                else
                    seenTargets.add(txtToKey);

                if (!hasConflict && await fs.pathExists(txtTo) && !sourceFiles.has(txtToKey))
                    markConflict(`Target caption file already exists: ${path.basename(txtTo)}`);
            }

            if (hasConflict)
                conflicts++;

            plan.push({
                imageFrom,
                imageTo,
                txtFrom: hasTxtPair ? txtFrom : null,
                txtTo,
                hasConflict,
                reason
            });

            preview.push({
                from: imageFrom,
                to: imageTo,
                fromName: path.basename(imageFrom),
                toName: path.basename(imageTo),
                hasConflict,
                reason
            });
        }

        return { plan, preview, conflicts };
    }

    private async rollbackRenameOperation(pairs: RenamePair[], concurrency: number, totalOperations: number) {
        let processed = 0;

        await Utilities.processMap(pairs, async (pair) => {
            if (await fs.pathExists(pair.temp))
                await fs.rename(pair.temp, pair.from);
            else if (await fs.pathExists(pair.to) && pair.to !== pair.from)
                await fs.rename(pair.to, pair.from);

            processed++;
            App.window.ipcSend("dataset:rename-progress", {
                phase: "rollback",
                processed,
                total: totalOperations,
                currentPath: pair.from
            });
        }, concurrency);
    }

    private applyRenameMappingsToOriginalDataset(mappings: { from: string; to: string; mtime: number }[]) {
        if (!this.originalDataset || mappings.length === 0)
            return;

        const updated = new Map(this.originalDataset);

        for (const { from, to, mtime } of mappings) {
            const fromKey = this.normalizePath(from);
            const toKey = this.normalizePath(to);

            const existing = updated.get(fromKey);
            if (!existing)
                continue;

            updated.delete(fromKey);
            updated.set(toKey, {
                tags: new Set(existing.tags),
                path: this.normalizePath(to),
                filePath: `${url.pathToFileURL(to).href}?v=${mtime}`
            });
        }

        this.originalDataset = updated;
    }

    private removeImagesFromOriginalDataset(filePaths: string[]) {
        if (!this.originalDataset || filePaths.length === 0)
            return;

        const updated = new Map(this.originalDataset);

        for (const filePath of filePaths) {
            const key = this.normalizePath(filePath);
            updated.delete(key);
        }

        this.originalDataset = updated;
    }
}

