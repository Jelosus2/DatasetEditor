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
}

const taggerRootScopeMap: Record<string, string> = {
    dev: app.getAppPath(),
    portable: process.resourcesPath,
    machine: path.join(process.env.ProgramData!, "dataset-editor"),
    user: app.getPath("userData")
}

export class PathsBuilder {
    readonly dataPath: string;
    readonly tagGroupsPath: string;
    readonly tagAutocompletionsPath: string;
    readonly taggerPath: string;
    readonly pythonPath: string;
    readonly pythonExecutablePath: string;
    readonly databasePath: string;
    readonly settingsPath: string;
    readonly bundledTagAutocompletionFilePath: string;
    readonly tagGroupsFilePath: string;
    readonly taggerScriptPath: string;
    readonly taggerModelsConfigPath: string;
    readonly distPath: string;
    readonly publicPath: string;
    readonly appIconPath: string;
    readonly preloadFilePath: string;
    readonly indexFilePath: string;
    readonly defaultHuggingFacePath: string;

    constructor(installScope: string) {
        const __dirname = this.__dirname(import.meta.url);
        const dataRoot = dataRootScopeMap[installScope];
        const taggerRoot = taggerRootScopeMap[installScope];

        this.dataPath = path.join(dataRoot, "Data");
        this.tagGroupsPath = path.join(this.dataPath, "TagGroups");
        this.tagAutocompletionsPath = path.join(this.dataPath, "TagAutocompletions");
        this.taggerPath = path.join(taggerRoot, "tagger");
        this.pythonPath = path.join(this.taggerPath, "embedded_python");
        this.pythonExecutablePath = path.join(this.pythonPath, "python.exe");
        this.databasePath = path.join(this.tagAutocompletionsPath, "tags.db");
        this.settingsPath = path.join(this.dataPath, "settings.json");
        this.bundledTagAutocompletionFilePath = installScope === "dev"
            ? path.join(this.dataPath, "TagAutocompletions", "danbooru.csv")
            : path.join(process.resourcesPath, "seed-data", "danbooru.csv");
        this.tagGroupsFilePath = path.join(this.tagGroupsPath, "tag_groups.json");
        this.taggerScriptPath = path.join(this.taggerPath, "main.py");
        this.taggerModelsConfigPath = path.join(this.dataPath, "models_config.json");
        this.distPath = path.join(__dirname, "..", "..", "dist");
        this.publicPath = path.join(__dirname, "..", "..", "public");
        this.appIconPath = installScope !== "dev" ? path.join(this.distPath, "doro.ico") : path.join(this.publicPath, "doro.ico");
        this.preloadFilePath = path.join(__dirname, "..", "preload.js");
        this.indexFilePath = path.join(this.distPath, "index.html");
        this.defaultHuggingFacePath = this.getHuggingFaceCachePath();
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

    __dirname(fileURL: string): string {
        return path.dirname(url.fileURLToPath(fileURL));
    }

    getHuggingFaceCachePath() {
        if (process.env.HF_HUB_CACHE)
            return process.env.HF_HUB_CACHE;
        if (process.env.HF_HOME)
            return path.join(process.env.HF_HOME, "hub");

        const homeDirectory = app.getPath("home");
        app.getPath("home")
        const xdgCache = process.env.XDG_CACHE_HOME || path.join(homeDirectory, ".cache");

        if (process.platform === "win32")
            return path.join(homeDirectory, ".cache", "huggingface", "hub")
        else
            return path.join(xdgCache, "huggingface", "hub")
    }
}
