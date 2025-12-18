import type { Database as DatabaseType } from "better-sqlite3";
import type { TagBatch, DBTagBatch } from "../types/database.js";

import { Utilities } from "../utils/Utilities.js";
import Database from "better-sqlite3";
import { App } from "../App.js";

export class TagDatabase {
    readonly BATCH_SIZE = 5000;
    database: DatabaseType | null;

    constructor() {
        this.database = null;
    }

    async start() {
        await App.paths.mkdirRecursive(App.paths.tagAutocompletionsPath);

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

        this.database = database;
    }

    resetTagsTable() {
        this.database!.exec("DROP TABLE IF EXISTS tags");
        this.database!.exec(`
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
        const rowCount = this.database!.prepare("SELECT COUNT(*) FROM tags").pluck().get() as number;
        if (rowCount === 0 && await App.paths.fileExists(App.paths.tagAutocompletionFilePath)) {
            await this.loadCsv(App.paths.tagAutocompletionFilePath, /* resetTable = */ true)
        }
    }

    async loadCsv(csvPath: string, resetTable: boolean = false) {
        try {
            if (!csvPath || !await App.paths.fileExists(csvPath))
                throw new Error(`CSV file not found at ${csvPath}`);
            if (resetTable)
                this.resetTagsTable();

            const statement = this.database!.prepare("INSERT INTO tags (tag, type, results) VALUES (?, ?, ?)");
            const insertMany = this.database!.transaction((rows: TagBatch[]) => {
                for (const row of rows)
                    statement.run(row.tag, row.type, row.results);
            });

            await App.paths.readTagsCsv(csvPath, this.BATCH_SIZE, /* onBatchComplete = */ insertMany);
        } catch (error: unknown) {
            console.error(error);
        }
    }

    retrieveTagCompletions(tagHint: string) {
        if (!tagHint)
            return [];

        const statement = this.database!.prepare<[string], DBTagBatch>(`
            SELECT tag, type, results FROM tags
            WHERE tag LIKES ?
            LIMIT 20
        `);

        return statement.all(`${tagHint}%`).map((row) => ({
            tag: row.tag,
            type: row.type,
            output: Utilities.formatTagOutput(row.tag, row.results)
        }));
    }
}
