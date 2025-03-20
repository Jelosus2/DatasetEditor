import { dialog } from 'electron';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';

export const _dirname = (url) => dirname(fileURLToPath(url));

export function loadCSVIntoDatabase(autocompletionsPath, database) {
  const rowCount = database.prepare('SELECT COUNT(*) as count FROM tags').get().count;
  if (rowCount === 0) {
    const csvFile = readdirSync(autocompletionsPath).filter((f) => f.endsWith('.csv'))?.[0];
    if (!csvFile) return;

    const batchSize = 5000;
    const stmt = database.prepare(
      'INSERT INTO tags (tag, type, results, alias) VALUES (?, ?, ?, ?)',
    );
    const insertMany = database.transaction((rows) => {
      for (const row of rows) stmt.run(row.tag, row.type, row.results, row.alias);
    });

    const csvPath = join(autocompletionsPath, csvFile);
    const stream = createReadStream(csvPath);
    const rl = createInterface({ input: stream });

    let batch = [];

    rl.on('line', (line) => {
      const [tag, type, results, ...alias] = line.replaceAll('"', '').split(',');
      if (tag && type && results) {
        batch.push({
          tag: tag.replaceAll('_', ' '),
          type: parseInt(type, 10),
          results: parseInt(results, 10),
          alias: alias.join(',') || null,
        });
        if (batch.length >= batchSize) {
          insertMany(batch);
          batch = [];
        }
      }
    });

    rl.on('close', () => {
      if (batch.length) insertMany(batch);
      console.log('Completed!');
    });
  }
}

export async function loadDatasetDirectory(mainWindow) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select the dataset directory',
    buttonLabel: 'Load Dataset',
    properties: ['openDirectory'],
  });

  if (result.canceled) return null;

  const directoryPath = result.filePaths[0];

  const images = new Map();
  const globalTags = new Map();

  const files = readdirSync(directoryPath).filter((file) =>
    ['.jpg', '.jpeg', '.png'].includes(extname(file)),
  );

  for (const file of files) {
    const ext = extname(file);
    const fileName = basename(file);

    images.set(fileName, { tags: new Set(), path: join(directoryPath, file) });

    const txtPath = join(directoryPath, fileName.replace(ext, '.txt'));

    if (existsSync(txtPath)) {
      const tags = new Set(
        readFileSync(txtPath, 'utf-8')
          .split(',')
          .map((tag) =>
            tag.trim().replaceAll('_', ' ').replaceAll('\\(', '(').replaceAll('\\)', ')'),
          )
          .filter((tag) => tag),
      );

      images.get(fileName).tags = tags;

      for (const tag of tags) {
        if (!globalTags.has(tag)) globalTags.set(tag, new Set());
        globalTags.get(tag).add(fileName);
      }
    }
  }

  return { images, globalTags };
}

export function getOS() {
  const osTypes = {
    darwin: 'mac',
    win32: 'windows',
    linux: 'linux',
  };

  return osTypes[process.platform] ?? 'linux';
}

export async function saveTagGroupFile(mainWindow, tagGroups) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Tag Group File',
    defaultPath: 'tag_group.json',
    filters: [
      {
        name: 'JSON File',
        extensions: ['json'],
      },
    ],
  });

  if (result.canceled) return null;

  writeFileSync(result.filePath, JSON.stringify(tagGroups, null, 2));

  return true;
}

export async function importTagGroup(mainWindow) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select the tag group JSON file to load',
    properties: ['openFile'],
    filters: [
      {
        name: 'JSON File',
        extensions: ['json'],
      },
    ],
  });

  if (result.canceled) return null;

  const filePath = result.filePaths[0];
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));

  if (Array.isArray(data)) return false;
  for (const key in data) {
    if (!Array.isArray(data[key])) return false;
    for (const value of data[key]) {
      if (typeof value !== 'string') return false;
    }
  }

  return new Map(Object.entries(data).map(([name, tags]) => [name, new Set(tags)]));
}

export function saveTagGroup(appPath, tagGroups) {
  const dataDirPath = join(appPath, 'Data', 'TagGroups');
  const tagGroupFilePath = join(dataDirPath, 'tag_groups.json');

  if (!existsSync(dataDirPath)) mkdirSync(dataDirPath, { recursive: true });

  writeFileSync(tagGroupFilePath, JSON.stringify(tagGroups, null, 2));
}

export function loadTagGroups(appPath) {
  const tagGroupFilePath = join(appPath, 'Data', 'TagGroups', 'tag_groups.json');

  if (!existsSync(tagGroupFilePath)) return null;
  const data = JSON.parse(readFileSync(tagGroupFilePath, 'utf-8'));

  return new Map(Object.entries(data).map(([name, tags]) => [name, new Set(tags)]));
}

export function loadTagCompletions(database, query) {
  if (!query) return [];

  const stmt = database.prepare(`
    SELECT tag, results, type FROM tags
    WHERE tag LIKE ?
    LIMIT 20
  `);

  const formatOutput = (tag, results) => {
    results = parseInt(results, 10);
    let text = tag;

    if (results >= 1_000_000) text += ` (${(results / 1_000_000).toFixed(1).replace('.0', '')}m)`;
    else if (results >= 1000) text += ` (${(results / 1000).toFixed(1).replace('.0', '')}k)`;
    else text += ` (${results})`;

    return text;
  };

  return stmt
    .all(`${query}%`)
    .map((row) => ({ tag: row.tag, type: row.type, output: formatOutput(row.tag, row.results) }));
}

export function saveDataset(dataset) {
  for (const image in dataset) {
    const props = dataset[image];

    const datasetDir = dirname(props.path);
    if (!existsSync(datasetDir)) mkdirSync(datasetDir, { recursive: true });

    const tags = props.tags.join(', ');
    const filePath = props.path.replace(extname(props.path), '.txt');

    writeFileSync(filePath, tags);
  }
}

export function startTaggerServer(appPath) {
  const os = getOS();
  const scriptsDir = os === 'windows' ? 'Scripts' : 'bin';
  const executable = os === 'windows' ? 'python.exe' : 'python';

  const taggerPath = join(appPath, 'tagger');
  const venvPython = join(taggerPath, 'venv', scriptsDir, executable);
  const filePath = join(taggerPath, 'main.py');

  const activePython = existsSync(venvPython) ? venvPython : executable;
  const taggerProcess = spawn(activePython, ['-u', filePath]);

  taggerProcess.stdout.on('data', (data) => {
    console.log(`Tagger output: ${data.toString().replaceAll('\n', '')}`);
  });
  taggerProcess.stderr.on('data', (data) => {
    console.error(`Tagger error: ${data}`);
  });
  taggerProcess.on('error', (err) => {
    console.error(`Tagger error: ${err}`);
  });

  return taggerProcess;
}
