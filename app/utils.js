import { dialog } from 'electron';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, basename, join } from 'node:path';

export const _dirname = (url) => dirname(fileURLToPath(url));

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
  const obj = JSON.parse(readFileSync(filePath, 'utf-8'));

  console.log(obj);

  if (Array.isArray(obj)) return false;
  for (const key in obj) {
    console.log(Array.isArray(obj[key]));
    if (!Array.isArray(obj[key])) return false;
    for (const value of obj[key]) {
      console.log(typeof value === 'string');
      if (typeof value !== 'string') return false;
    }
  }

  return new Map(Object.entries(obj).map(([name, tags]) => [name, new Set(tags)]));
}
