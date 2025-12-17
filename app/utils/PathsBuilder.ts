import type { TagBatch } from "../types/database.js";

import { Utilities } from "./Utilities.js";
import readline from "node:readline";
import { App } from "../App.js";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";

export class PathsBuilder {
    readonly dataPath: string;
    readonly tagGroupsPath: string;
    readonly tagAutocompletionsPath: string;
    readonly taggerPath: string;
    readonly databasePath: string;
    readonly settingsPath: string;
    readonly tagAutocompletionFilePath: string;
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
        this.databasePath = path.join(this.tagAutocompletionsPath, "tags.db");
        this.settingsPath = path.join(this.dataPath, "settings.json");
        this.tagAutocompletionFilePath = path.join(this.tagAutocompletionsPath, "danbooru.csv");
        this.distPath = path.join(__dirname, "..", "..", "dist");
        this.publicPath = path.join(__dirname, "..", "..", "public");
        this.appIconPath = fs.existsSync(this.distPath) ? path.join(this.distPath, "doro.ico") : path.join(this.publicPath, "doro.ico");
        this.preloadFilePath = path.join(__dirname, "..", "preload.js");
        this.indexFilePath = path.join(this.distPath, "index.html");
        this.uninstallerPath = path.join(path.dirname(App.electron.app.getPath("exe")), "Uninstall Dataset Editor.exe");

    }

    mkdirRecursive(path: fs.PathLike) {
        fs.mkdirSync(path, { recursive: true });
    }

    writeJSONFile(path: fs.PathOrFileDescriptor, content: unknown) {
        fs.writeFileSync(path, JSON.stringify(content, null, 4), { encoding: 'utf-8' });
    }

    readJSONFile<T>(path: fs.PathOrFileDescriptor): T {
        return JSON.parse(fs.readFileSync(path, 'utf-8'));
    }

    async readTagsCsv(csvPath: fs.PathLike, batchSize: number, onBatchComplete: (batch: TagBatch[]) => void) {
        return new Promise<void>((resolve, reject) => {
            const stream = fs.createReadStream(csvPath);
            const rl = readline.createInterface({ input: stream });
            let batch: TagBatch[] = [];

            rl.on('line', (line) => {
                try {
                    const [tag, type, results] = line.replaceAll('"', "").split(",");

                    if (tag && type && results) {
                        const isTypeNumeric = Utilities.isStringNumeric(type);
                        const isResultNumeric = Utilities.isStringNumeric(results);

                        if (!isTypeNumeric && !isResultNumeric)
                            return;

                        batch.push({
                            tag: tag.replaceAll("_", " "),
                            type: parseInt(type, 10),
                            results: parseInt(results, 10)
                        });
                    }

                    if (batch.length >= batchSize) {
                        onBatchComplete(batch);
                        batch = [];
                    }
                } catch (error: unknown) {
                    console.error(error);
                }
            });

            rl.on('close', () => {
                try {
                    if (batch.length > 0)
                        onBatchComplete(batch)

                    console.log('CSV import completed successfully!');
                    resolve();
                } catch (error: unknown) {
                    console.error(error);
                    reject(error);
                }
            });

            rl.on('error', reject);
        });
    }

    __dirname(fileURL: string): string {
        return path.dirname(url.fileURLToPath(fileURL));
    }
}
