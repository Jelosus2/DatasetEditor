import type { TagBatch } from "../types/database.js";

import { Utilities } from "./Utilities.js";
import readline from "node:readline";
import { app } from "electron";
import path from "node:path";
import url from "node:url";
import fs from "fs-extra";

const dataRootScopeMap: Record<string, string> = {
    dev: app.getAppPath(),
    portable: process.resourcesPath,
    machine: app.getPath("userData"),
    user: app.getPath("userData")
};

const taggerRootScopeMap: Record<string, string> = {
    dev: app.getAppPath(),
    portable: process.resourcesPath,
    machine: path.join(process.env.ProgramData ?? "", "dataset-editor"),
    user: app.getPath("userData")
};

export class PathsBuilder {
    private readonly installScope: string;
    readonly dataPath: string;
    readonly tagGroupsPath: string;
    readonly tagAutocompletionsPath: string;
    readonly taggerPath: string;
    readonly pythonPath: string;
    readonly pythonExecutablePath: string;
    readonly venvPath: string;
    readonly databasePath: string;
    readonly settingsPath: string;
    readonly bundledTagAutocompletionFilePath: string;
    readonly tagGroupsFilePath: string;
    readonly taggerScriptPath: string;
    readonly taggerModelsConfigPath: string;
    readonly bundledTaggerPath: string;
    readonly distPath: string;
    readonly publicPath: string;
    readonly appIconPath: string;
    readonly preloadFilePath: string;
    readonly indexFilePath: string;
    readonly defaultHuggingFacePath: string;
    readonly whatsNewStatePath: string;
    readonly releaseNotesPath: string;

    constructor(installScope: string) {
        const __dirname = this.__dirname(import.meta.url);
        const dataRoot = dataRootScopeMap[installScope];
        const taggerRoot = taggerRootScopeMap[installScope];

        this.installScope = installScope;
        this.dataPath = path.join(dataRoot, "Data");
        this.tagGroupsPath = path.join(this.dataPath, "TagGroups");
        this.tagAutocompletionsPath = path.join(this.dataPath, "TagAutocompletions");
        this.taggerPath = path.join(taggerRoot, "tagger");
        this.pythonPath = path.join(this.taggerPath, "embedded_python");
        this.venvPath = path.join(this.taggerPath, "venv");
        this.pythonExecutablePath = process.platform === "win32"
            ? path.join(this.pythonPath, "python.exe")
            : path.join(this.venvPath, "bin", "python");
        this.databasePath = path.join(this.tagAutocompletionsPath, "tags.db");
        this.settingsPath = path.join(this.dataPath, "settings.json");
        this.bundledTagAutocompletionFilePath = installScope === "dev"
            ? path.join(dataRoot, "build", "danbooru.csv")
            : path.join(process.resourcesPath, "seed-data", "danbooru.csv");
        this.tagGroupsFilePath = path.join(this.tagGroupsPath, "tag_groups.json");
        this.taggerScriptPath = path.join(this.taggerPath, "main.py");
        this.taggerModelsConfigPath = path.join(this.dataPath, "models_config.json");
        this.bundledTaggerPath = path.join(process.resourcesPath, "tagger");
        this.distPath = path.join(__dirname, "..", "..", "dist");
        this.publicPath = path.join(__dirname, "..", "..", "public");
        this.appIconPath = installScope !== "dev" ? path.join(this.distPath, "doro.ico") : path.join(this.publicPath, "doro.ico");
        this.preloadFilePath = path.join(__dirname, "..", "preload.js");
        this.indexFilePath = path.join(this.distPath, "index.html");
        this.defaultHuggingFacePath = this.getDefaultHuggingFaceCachePath();
        this.whatsNewStatePath = path.join(this.dataPath, "whats-new-state.json");
        this.releaseNotesPath = installScope === "dev"
            ? path.join(dataRoot, "build", "release-notes.json")
            : path.join(process.resourcesPath, "seed-data", "release-notes.json");
    }

    async readTagsCsv(csvPath: string, batchSize: number, onBatchComplete: (batch: TagBatch[], progress: number, error?: unknown) => void) {
        let batch: TagBatch[] = [];
        let processedCount = 0;

        try {
            const stream = fs.createReadStream(csvPath);
            const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

            for await (const line of rl) {
                if (!line.trim())
                    continue;

                const cleanLine = line.replaceAll('"', "");
                const parts = cleanLine.split(",");

                if (parts.length < 3)
                    continue;

                const tag = parts[0].replaceAll("_", " ");
                const type = parts[1];
                const results = parts[2];

                if (!Utilities.isStringNumeric(type) || !Utilities.isStringNumeric(results))
                    continue;

                batch.push({
                    tag,
                    type: parseInt(type, 10),
                    results: parseInt(results, 10)
                });

                if (batch.length >= batchSize) {
                    processedCount += batch.length;
                    onBatchComplete(batch, processedCount);
                    batch = [];
                }
            }

            if (batch.length > 0) {
                processedCount += batch.length;
                onBatchComplete(batch, processedCount);
            }

            console.log(`[CSV Reader] Successfully processed ${processedCount} tags`);
        } catch (error) {
            console.error(error);

            if (batch.length > 0) {
                processedCount += batch.length;
                onBatchComplete(batch, processedCount, error);
                return;
            }

            onBatchComplete([], 0, error);
        }
    }

    async ensureBundleTaggerIsSynced() {
        if (this.installScope === "dev" || process.platform === "win32")
            return;

        const bundledVersionPath = path.join(this.bundledTaggerPath, "bundle-version");
        const installedVersionPath = path.join(this.taggerPath, "bundle-version");

        if (!await fs.pathExists(this.bundledTaggerPath))
            throw new Error(`Bundled tagger folder was not found at ${this.bundledTaggerPath}`);

        const bundledVersion = await this.readTaggerBundleVersion(bundledVersionPath);
        const installedVersion = await this.readTaggerBundleVersion(installedVersionPath);

        if (installedVersion && bundledVersion && installedVersion === bundledVersion)
            return;

        await fs.ensureDir(this.taggerPath);
        await fs.copy(this.bundledTaggerPath, this.taggerPath);
    }

    async repairTagger() {
        if (this.installScope === "dev" || this.installScope === "portable")
            throw new Error("Autotagger repair is not available for this installation type");
        if (!await fs.pathExists(this.bundledTaggerPath))
            throw new Error(`Bundled tagger folder was not found at ${this.bundledTaggerPath}`);

        await fs.remove(this.taggerPath);
        await fs.ensureDir(this.taggerPath);
        await fs.copy(this.bundledTaggerPath, this.taggerPath, { overwrite: true });
    }

    private __dirname(fileURL: string): string {
        return path.dirname(url.fileURLToPath(fileURL));
    }

    private getDefaultHuggingFaceCachePath() {
        if (process.env.HF_HUB_CACHE)
            return process.env.HF_HUB_CACHE;
        if (process.env.HF_HOME)
            return path.join(process.env.HF_HOME, "hub");

        const homeDirectory = app.getPath("home");
        const xdgCache = process.env.XDG_CACHE_HOME || path.join(homeDirectory, ".cache");

        if (process.platform === "win32")
            return path.join(homeDirectory, ".cache", "huggingface", "hub");
        else
            return path.join(xdgCache, "huggingface", "hub");
    }

    private async readTaggerBundleVersion(filePath: string) {
        if (!await fs.pathExists(filePath))
            return null;

        const version = await fs.readFile(filePath, { encoding: "utf-8" });
        return version.trim() || null;
    }
}
