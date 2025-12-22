import type { TagBatch } from "../types/database.js";

import { Utilities } from "./Utilities.js";
import { App } from "../App.js";
import readline from "node:readline";
import { app } from "electron";
import path from "node:path";
import url from "node:url";
import fs from "fs-extra";

export class PathsBuilder {
    readonly dataPath: string;
    readonly tagGroupsPath: string;
    readonly tagAutocompletionsPath: string;
    readonly taggerPath: string;
    readonly pythonPath: string;
    readonly databasePath: string;
    readonly settingsPath: string;
    readonly tagAutocompletionFilePath: string;
    readonly tagGroupsFilePath: string;
    readonly taggerScriptPath: string;
    readonly distPath: string;
    readonly publicPath: string;
    readonly appIconPath: string;
    readonly preloadFilePath: string;
    readonly indexFilePath: string;
    readonly uninstallerPath: string;

    constructor(basePath: string) {
        const __dirname = this.__dirname(import.meta.url);

        this.dataPath = path.join(basePath, "Data");
        this.tagGroupsPath = path.join(this.dataPath, "TagGroups");
        this.tagAutocompletionsPath = path.join(this.dataPath, "TagAutocompletions");
        this.taggerPath = path.join(basePath, "tagger");
        this.pythonPath = path.join(this.taggerPath, "embedded_python");
        this.databasePath = path.join(this.tagAutocompletionsPath, "tags.db");
        this.settingsPath = path.join(this.dataPath, "settings.json");
        this.tagAutocompletionFilePath = path.join(this.tagAutocompletionsPath, "danbooru.csv");
        this.tagGroupsFilePath = path.join(this.tagGroupsPath, "tag_groups.json");
        this.taggerScriptPath = path.join(this.taggerPath, "main.py");
        this.distPath = path.join(__dirname, "..", "..", "dist");
        this.publicPath = path.join(__dirname, "..", "..", "public");
        this.appIconPath = !App.IS_DEVELOPMENT ? path.join(this.distPath, "doro.ico") : path.join(this.publicPath, "doro.ico");
        this.preloadFilePath = path.join(__dirname, "..", "preload.js");
        this.indexFilePath = path.join(this.distPath, "index.html");
        this.uninstallerPath = path.join(path.dirname(app.getPath("exe")), "Uninstall Dataset Editor.exe");

    }

    async readTagsCsv(csvPath: string, batchSize: number, onBatchComplete: (batch: TagBatch[]) => void) {
        const stream = fs.createReadStream(csvPath);
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        let batch: TagBatch[] = [];
        let processedCount = 0;

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
                onBatchComplete(batch);
                processedCount += batch.length;
                batch = [];
            }
        }

        if (batch.length > 0) {
            onBatchComplete(batch);
            processedCount += batch.length;
        }

        console.log(`[CSV Reader] Successfully processed ${processedCount} tags`);
    }

    __dirname(fileURL: string): string {
        return path.dirname(url.fileURLToPath(fileURL));
    }
}
