import type { CompletionItem } from "../../shared/autocompletion.js";
import type { TagBatch } from "../types/database.js";

import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import Database from "better-sqlite3";
import fs from "fs-extra";

export class TagDatabase {
    readonly BATCH_SIZE = 2000;
    database: ReturnType<typeof Database>;

    constructor(database: ReturnType<typeof Database>) {
        this.database = database;
    }

    static async start() {
        await fs.ensureDir(App.paths.tagAutocompletionsPath);

        const database = new Database(App.paths.databasePath);
        database.pragma("journal_mode = WAL");
        database.exec(`
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tag TEXT NOT NULL,
                type INTEGER NOT NULL,
                results INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tag ON tags(tag);
        `);

        return new this(database);
    }

    resetTagsTable() {
        this.database.exec("DROP TABLE IF EXISTS tags");
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tag TEXT NOT NULL,
                type INTEGER NOT NULL,
                results INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tag ON tags(tag);
        `);
    }

    async tryLoadDefaultCsv() {
        const rowCount = this.database.prepare("SELECT COUNT(*) FROM tags").pluck().get() as number;
        if (rowCount === 0 && await fs.pathExists(App.paths.tagAutocompletionFilePath)) {
            await this.loadCsv(App.paths.tagAutocompletionFilePath, /* resetTable = */ true)
        }
    }

    async loadCsv(csvPath: string, resetTable?: boolean) {
        if (!csvPath || !await fs.pathExists(csvPath))
            throw new Error(`CSV file not found at ${csvPath}`);
        if (resetTable)
            this.resetTagsTable();

        const statement = this.database.prepare("INSERT INTO tags (tag, type, results) VALUES (?, ?, ?)");
        const insertMany = this.database.transaction((rows: TagBatch[]) => {
            for (const row of rows)
                statement.run(row.tag, row.type, row.results);
        });

        const taskId = "db:load_csv";
        const title = "Loading tags into the database";
        let taskError = false;
        let globalProgress = 0;

        App.window.sendStatus({ id: taskId, title, state: "start" });

        await App.paths.readTagsCsv(csvPath, this.BATCH_SIZE, (batch, progress, error) => {
            if (batch.length > 0) {
                insertMany(batch);
                globalProgress = progress;

                App.window.sendStatus({ id: taskId, title, message: `Inserted ${progress} tags...`, state: "progress" });
            }

            if (error) {
                App.window.sendStatus({ id: taskId, title, message: "Failed to insert tags, check the logs for more information", state: "error" });
                App.logger.error(`[Database Manager] Error while loading CSV file into database: ${Utilities.getErrorMessage(error)}`);
                taskError = true;
            }
        });

        if (!taskError)
            App.window.sendStatus({ id: taskId, title, message: `Successfully inserted ${globalProgress} tags`, state: "success" });
    }

    retrieveTagCompletions(tagHint: string): CompletionItem[] {
        if (!tagHint)
            return [];

        const statement = this.database.prepare<[string], TagBatch>(`
            SELECT tag, type, results FROM tags
            WHERE tag LIKE ?
            LIMIT 20
        `);

        return statement.all(`${tagHint}%`).map((row) => ({
            tag: row.tag,
            type: row.type,
            output: Utilities.formatTagOutput(row.tag, row.results)
        }));
    }
}
