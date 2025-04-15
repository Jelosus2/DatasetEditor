import { dialog } from 'electron';
import stripAnsi from 'strip-ansi';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

let originalDatasetHash;
let originalTagGroupsHash;

export const _dirname = (url) => dirname(fileURLToPath(url));

export function loadCSVIntoDatabase(autocompletionsPath, database) {
  const rowCount = database.prepare('SELECT COUNT(*) as count FROM tags').get().count;
  if (rowCount === 0) {
    insertTagsIntoDatabase(
      database,
      join(autocompletionsPath, 'danbooru_2025-02-16_pt25-ia-dd.csv'),
    );
  }
}

function insertTagsIntoDatabase(database, csvFile, resetTable = false) {
  if (!csvFile) return;
  if (resetTable) {
    database.exec('DROP TABLE IF EXISTS tags');
    database.exec(`
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL,
        type INTEGER NOT NULL,
        results INTEGER NOT NULL,
        alias TEXT
      )
    `);
  }

  const batchSize = 5000;
  const stmt = database.prepare('INSERT INTO tags (tag, type, results, alias) VALUES (?, ?, ?, ?)');
  const insertMany = database.transaction((rows) => {
    for (const row of rows) stmt.run(row.tag, row.type, row.results, row.alias);
  });

  const stream = createReadStream(csvFile);
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

export async function loadDatasetDirectory(mainWindow, isAllSaved, directory) {
  if (!isAllSaved) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes in the dataset. Do you want to continue?',
      buttons: ['Yes', 'No'],
    });
    if (result.response === 1) return null;
  }

  let directoryPath = directory;

  if (directoryPath === null) {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select the dataset directory',
      buttonLabel: 'Load Dataset',
      properties: ['openDirectory'],
    });

    if (result.canceled) return null;
    directoryPath = result.filePaths[0];
  }

  const images = new Map();
  const globalTags = new Map();

  const files = readdirSync(directoryPath).filter((file) =>
    ['.jpg', '.jpeg', '.png'].includes(extname(file)),
  );

  for (const file of files) {
    const ext = extname(file);
    const fileName = basename(file);
    const path = join(directoryPath, file);

    images.set(fileName, { tags: new Set(), path, filePath: pathToFileURL(path).href });

    const txtPath = join(directoryPath, fileName.replaceAll(ext, '.txt'));

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

  originalDatasetHash = createHash('md5')
    .update(
      JSON.stringify(
        [...images].map(([img, props]) => [img, { tags: [...props.tags], path: props.path }]),
      ),
    )
    .digest('hex');

  return { images, globalTags, directoryPath };
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

  originalTagGroupsHash = createHash('md5').update(JSON.stringify(tagGroups)).digest('hex');
}

export function loadTagGroups(appPath) {
  const tagGroupFilePath = join(appPath, 'Data', 'TagGroups', 'tag_groups.json');

  if (!existsSync(tagGroupFilePath)) return null;
  const data = JSON.parse(readFileSync(tagGroupFilePath, 'utf-8'));

  originalTagGroupsHash = createHash('md5').update(JSON.stringify(data)).digest('hex');

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
    const filePath = props.path.replaceAll(extname(image), '.txt');

    writeFileSync(filePath, tags);
  }
}

export async function startTaggerServer(appPath, mainWindow) {
  const os = getOS();
  const scriptsDir = os === 'windows' ? 'Scripts' : 'bin';
  const executable = os === 'windows' ? 'python.exe' : 'python';

  const taggerPath = join(appPath, 'tagger');
  const embeddedPythonDir = join(taggerPath, 'embedded_python');
  const venvPython = join(taggerPath, 'venv', scriptsDir, executable);
  const python = existsSync(embeddedPythonDir) ? join(embeddedPythonDir, 'python.exe') : venvPython;
  const filePath = join(taggerPath, 'main.py');

  await installTaggerRequirements(taggerPath, mainWindow);
  const taggerProcess = spawn(python, ['-u', filePath]);

  taggerProcess.stdout.on('data', (data) => {
    const output = data.toString();
    mainWindow.webContents.send('tagger-output', clearOutputText(output));
  });
  taggerProcess.stderr.on('data', (data) => {
    const output = data.toString();
    mainWindow.webContents.send('tagger-output', clearOutputText(output));
  });
  taggerProcess.on('error', (err) => {
    console.error(`Tagger error: ${err}`);
  });

  return taggerProcess;
}

function installTaggerRequirements(taggerPath, mainWindow) {
  return new Promise((resolve, reject) => {
    const filePath = join(taggerPath, 'install.py');
    const embeddedPythonDir = join(taggerPath, 'embedded_python');
    const embeddedPythonExists = existsSync(embeddedPythonDir);
    const python = embeddedPythonExists ? join(embeddedPythonDir, 'python.exe') : 'python';

    const args = ['-u', filePath];
    if (embeddedPythonExists) args.push('--skip-venv');

    const installProcess = spawn(python, args);
    installProcess.stdout.on('data', (data) => {
      const output = data.toString();
      mainWindow.webContents.send('tagger-output', clearOutputText(output));
    });
    installProcess.stderr.on('data', (data) => {
      const output = data.toString();
      mainWindow.webContents.send('tagger-output', clearOutputText(output));
    });
    installProcess.on('error', (err) => {
      console.error(`Tagger install error: ${err}`);
      reject(err);
    });
    installProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

function clearOutputText(str) {
  if (str.endsWith('\n')) str = str.slice(0, -1);
  return stripAnsi(str.replaceAll('\x00', '').trim());
}

export async function getTaggerDevice() {
  try {
    const response = await fetch('http://localhost:3067/device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return data.device;
  } catch (err) {
    console.error('Error getting tagger device: ', err);
    return 'Unkown';
  }
}

export async function autoTagImages(props) {
  try {
    const {
      images,
      generalThreshold,
      characterThreshold,
      removeUnderscores,
      selectedModels,
      removeRedundantTags,
    } = props;
    const results = new Map();

    for (const model of selectedModels) {
      const body = {
        images,
        model,
        character_threshold: characterThreshold,
        general_threshold: generalThreshold,
        remove_underscores: removeUnderscores,
        remove_redundant_tags: removeRedundantTags,
      };

      const response = await fetch('http://localhost:3067/tagger', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      for (const key in data) {
        if (!results.has(key)) results.set(key, new Set(data[key]));
        else results.set(key, new Set([...results.get(key), ...data[key]]));
      }
    }

    return results;
  } catch (err) {
    console.error('Error auto tagging images: ', err);
    return null;
  }
}

export function saveSettings(appPath, settings) {
  const defaultSettings = {
    showTagCount: false,
    theme: 'auto',
    autocomplete: true,
    autocompleteFile: join(
      appPath,
      'Data',
      'TagAutocompletions',
      'danbooru_2025-02-16_pt25-ia-dd.csv',
    ),
  };

  const settingsPath = join(appPath, 'Data', 'settings.json');
  if (!existsSync(settingsPath)) {
    writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
    return;
  }

  if (!settings) return;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

export function loadSettings(appPath) {
  const settingsPath = join(appPath, 'Data', 'settings.json');
  if (!existsSync(settingsPath)) return null;

  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  return settings;
}

export async function changeAutocompleteFile(mainWindow, database) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select the autocomplete file',
    properties: ['openFile'],
    filters: [
      {
        name: 'CSV File',
        extensions: ['csv'],
      },
    ],
  });

  if (result.canceled) return null;

  insertTagsIntoDatabase(database, result.filePaths[0], true);
  return result.filePaths[0];
}

export function compareDatasetChanges(images) {
  const currentDatasetHash = createHash('md5').update(images).digest('hex');
  if (!originalDatasetHash) return true;
  return originalDatasetHash === currentDatasetHash;
}

export function updateOriginalDatasetHash(images) {
  originalDatasetHash = createHash('md5').update(images).digest('hex');
}

export function compareTagGroupChanges(tagGroups) {
  const currentTagGroupHash = createHash('md5').update(tagGroups).digest('hex');
  if (!originalTagGroupsHash) return true;
  return originalTagGroupsHash === currentTagGroupHash;
}
