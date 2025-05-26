import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const BATCH_SIZE = 5000;

export class TagDatabase {
  constructor(database) {
    this.db = database;
  }

  loadCSVIntoDatabase(settingsManager) {
    const rowCount = this.db.prepare('SELECT COUNT(*) as count FROM tags').get().count;
    if (rowCount === 0) {
      const settings = settingsManager.loadSettings();
      if (settings && settings.autocompleteFile && existsSync(settings.autocompleteFile)) {
        this.insertTagsFromCSV(settings.autocompleteFile, true);
      }
    }
  }

  async insertTagsFromCSV(csvFile, resetTable = false) {
    if (!csvFile || !existsSync(csvFile)) {
      throw new Error(`CSV file not found: ${csvFile}`);
    }

    if (resetTable) {
      this.db.exec('DROP TABLE IF EXISTS tags');
      this.db.exec(`
        CREATE TABLE tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tag TEXT NOT NULL,
          type INTEGER NOT NULL,
          results INTEGER NOT NULL
        )
      `);
    }

    const stmt = this.db.prepare('INSERT INTO tags (tag, type, results) VALUES (?, ?, ?)');
    const insertMany = this.db.transaction((rows) => {
      for (const row of rows) stmt.run(row.tag, row.type, row.results);
    });

    return new Promise((resolve, reject) => {
      const stream = createReadStream(csvFile);
      const rl = createInterface({ input: stream });
      let batch = [];

      rl.on('line', (line) => {
        try {
          const [tag, type, results] = line.replaceAll('"', '').split(',');
          if (tag && type && results) {
            batch.push({
              tag: tag.replaceAll('_', ' '),
              type: parseInt(type, 10),
              results: parseInt(results, 10)
            });

            if (batch.length >= BATCH_SIZE) {
              insertMany(batch);
              batch = [];
            }
          }
        } catch (error) {
          console.warn(`Error parsing line: ${line}`, error);
        }
      });

      rl.on('close', () => {
        try {
          if (batch.length) insertMany(batch);
          console.log('CSV import completed successfully');
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      rl.on('error', reject);
    });
  }

  loadTagCompletions(query) {
    if (!query) return [];

    const stmt = this.db.prepare(`
      SELECT tag, results, type FROM tags
      WHERE tag LIKE ?
      LIMIT 20
    `);

    return stmt
      .all(`${query}%`)
      .map((row) => ({
        tag: row.tag,
        type: row.type,
        output: this.formatTagOutput(row.tag, row.results)
      }));
  }

  formatTagOutput(tag, results) {
    const numResults = parseInt(results, 10);
    let text = tag;

    if (numResults >= 1_000_000) {
      text += ` (${(numResults / 1_000_000).toFixed(1).replace('.0', '')}m)`;
    } else if (numResults >= 1000) {
      text += ` (${(numResults / 1000).toFixed(1).replace('.0', '')}k)`;
    } else {
      text += ` (${numResults})`;
    }

    return text;
  }
}
