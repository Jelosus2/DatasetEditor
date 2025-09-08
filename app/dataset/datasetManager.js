import { dialog, shell } from 'electron';
import { default as _ } from 'lodash';
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { extname, join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import * as os from 'node:os';

function sortTags(tags) {
  const arr = Array.from(tags);
  if (arr.length <= 1) return arr;
  const [first, ...rest] = arr;
  rest.sort((a, b) => a.localeCompare(b));
  return [first, ...rest];
}

const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export class DatasetManager {
  constructor() {
    this.originalDataset = null;
    this.thumbnailCache = new Map();
  }

  async loadDatasetDirectory(mainWindow, isAllSaved, directory = null, recursive = false, sortOnLoad = false) {
    if (!isAllSaved && !await this.confirmUnsavedChanges(mainWindow)) {
      return null;
    }

    const directoryPath = directory || await this.selectDirectory(mainWindow);
    if (!directoryPath) return null;

    try {
      const { images, globalTags } = await this.processDatasetDirectory(directoryPath, mainWindow, recursive, sortOnLoad);
      this.originalDataset = this.serializeDatasetImages(images);

      return { images, globalTags, directoryPath };
    } catch (error) {
      const message = `Error loading dataset directory: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
    }
  }

  async confirmUnsavedChanges(mainWindow) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes in the dataset. Do you want to continue?',
      buttons: ['Yes', 'No'],
    });
    return result.response === 0;
  }

  async selectDirectory(mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select the dataset directory',
      buttonLabel: 'Load Dataset',
      properties: ['openDirectory'],
    });

    return result.canceled ? null : result.filePaths[0];
  }

  async processDatasetDirectory(directoryPath, mainWindow, recursive = false, sortOnLoad = false) {
    const images = new Map();
    const globalTags = new Map();

    const entries = readdirSync(directoryPath, { withFileTypes: true, recursive });
    const files = entries
      .filter((entry) => entry.isFile() && SUPPORTED_IMAGE_EXTENSIONS.includes(extname(entry.name).toLowerCase()))
      .map((entry) => ({ fileName: entry.name, parentPath: entry.parentPath, filePath: join(entry.parentPath, entry.name) }));

    if (sortOnLoad) {
      files.sort((a, b) => a.fileName.toLowerCase().localeCompare(b.fileName.toLowerCase()));
    }

    for (const file of files) {
      const tags = this.loadImageTags(file.parentPath, file.fileName, mainWindow);

      let mtimeMs;
      try {
        mtimeMs = statSync(file.filePath).mtimeMs;
      } catch {
        mtimeMs = Date.now();
      }

      const imageKey = file.filePath.replace(/\\|\\\\/g, '/');
      images.set(imageKey, {
        tags,
        path: file.filePath,
        filePath: `${pathToFileURL(file.filePath).href}?v=${mtimeMs}`
      });

      this.updateGlobalTags(globalTags, tags, imageKey);
    }

    return { images, globalTags };
  }

  loadImageTags(directoryPath, fileName, mainWindow) {
    const txtPath = join(directoryPath, fileName.replace(/\.[^.]+$/, '.txt'));

    if (!existsSync(txtPath)) {
      return new Set();
    }

    try {
      const content = readFileSync(txtPath, 'utf-8');
      return new Set(
        content
          .split(',')
          .map(tag => tag.trim().replaceAll('_', ' ').replaceAll('\\(', '(').replaceAll('\\)', ')'))
          .filter(tag => tag.length > 0)
      );
    } catch (error) {
      const message = `Error reading tags for ${fileName}: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'warning', message });
      return new Set();
    }
  }

  updateGlobalTags(globalTags, tags, fileName) {
    for (const tag of tags) {
      if (!globalTags.has(tag)) {
        globalTags.set(tag, new Set());
      }
      globalTags.get(tag).add(fileName);
    }
  }

  saveDataset(dataset, sort = false, mainWindow) {
    for (const [imageName, props] of Object.entries(dataset)) {
      try {
        const datasetDir = dirname(props.path);
        if (!existsSync(datasetDir)) {
          mkdirSync(datasetDir, { recursive: true });
        }

        const tags = Array.isArray(props.tags) ? props.tags.join(', ') : [...props.tags].join(', ');
        const filePath = props.path.replace(/\.[^.]+$/, '.txt');

        writeFileSync(filePath, tags);
      } catch (error) {
        const message = `Error saving tags for ${imageName}: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
        mainWindow?.webContents.send('app-log', { type: 'error', message });
      }
    }

    this.originalDataset = Object.entries(dataset).map(([img, props]) => [
      img,
      { tags: sort ? sortTags(props.tags) : [...props.tags], path: props.path }
    ]);
  }

  compareDatasetChanges(images) {
    if (!this.originalDataset) return true;
    return _.isEqual(this.originalDataset, images);
  }

  serializeDatasetImages(images, sort = false) {
    return [...images].map(([img, props]) => [
      img,
      { tags: sort ? sortTags(props.tags) : [...props.tags], path: props.path }
    ]);
  }

  async applyBackgroundColor(images, color, mainWindow) {
    for (const image of images) {
      try {
        const buffer = readFileSync(image);
        unlinkSync(image);
        try {
          await sharp(buffer).flatten({ background: color }).toFile(image);
        } catch (error) {
          writeFileSync(image, buffer);
          throw error;
        }

        const { mtimeMs } = statSync(image);
        mainWindow?.webContents.send('image-updated', { path: image, mtime: mtimeMs });
      } catch (error) {
        const message = `Error applying background color for ${image}: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
        mainWindow?.webContents.send('app-log', { type: 'error', message });
        return { error: true, message: 'Failed to change background color, check the logs for more information.' };
      }
    }

    mainWindow?.webContents.send('app-log', { type: 'info', message: 'Changed background color successfully' });
    return { error: false, message: 'Changed background color successfully' };
  }

  async cropImage(path, { x, y, width, height }, overwrite, mainWindow) {
    try {
      let outPath = path;

      if (!overwrite) {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: 'Save cropped image as',
          defaultPath: path,
        });

        if (canceled || !filePath) {
          return { error: true, message: 'Save cancelled' };
        }

        outPath = filePath;
      }

      const extractOptions = {
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      };

      if (overwrite) {
        const buffer = readFileSync(path);
        unlinkSync(path);
        try {
          await sharp(buffer).extract(extractOptions).toFile(path);
        } catch (error) {
          writeFileSync(path, buffer);
          throw error;
        }
      } else {
        await sharp(path).extract(extractOptions).toFile(outPath);
      }

      if (overwrite) {
        const { mtimeMs } = statSync(outPath);
        mainWindow?.webContents.send('image-updated', { path: outPath, mtime: mtimeMs });
      }

      mainWindow?.webContents.send('app-log', { type: 'info', message: 'Image cropped successfully' });
      return { error: false, message: 'Image cropped successfully' };
    } catch (error) {
      const message = `Error cropping image: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
      return { error: true, message: 'Failed to crop image, check the logs for more information.' };
    }
  }

  async getThumbnail(filePath, mainWindow, size = 256) {
    try {
      const { mtimeMs } = statSync(filePath);
      const key = `${filePath}|${mtimeMs}|${size}`;

      if (this.thumbnailCache.has(key)) {
        const val = this.thumbnailCache.get(key);
        this.thumbnailCache.delete(key);
        this.thumbnailCache.set(key, val);
        return val;
      }

      const input = readFileSync(filePath);
      const buffer = await sharp(input)
        .rotate()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      const dataUrl = `data:image/webp;base64,${buffer.toString('base64')}`;
      this.thumbnailCache.set(key, dataUrl);

      return dataUrl;
    } catch (error) {
      const message = `Error creating thumbnail of image: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
      return null;
    }
  }

  async findDuplicates(filePaths, mainWindow, method = 'dhash', threshold = 10) {
    try {
      const total = filePaths?.length || 0;
      mainWindow?.webContents.send('app-log', { type: 'info', message: `Finding duplicate images (${method}, threshold=${threshold}) in ${total} files` });

      if (total === 0) {
        return { error: false, groups: [] };
      }

      const groups = [];

      const entries = await this.hashWithWorkers(filePaths, method, mainWindow);
      const n = entries.length;
      if (n <= 1) return { error: false, groups: [] };

      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[rb] = ra;
      };

      const popcount8 = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i, cnt = 0;
        while (c) { c &= c - 1; cnt++; }
        popcount8[i] = cnt;
      }

      const hamming = (a, b) => {
        let d = 0;
        for (let i = 0; i < 8; i++) d += popcount8[a[i] ^ b[i]];
        return d;
      };

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dist = hamming(entries[i].bytes, entries[j].bytes);
          if (dist <= threshold) union(i, j);
        }
      }

      const map = new Map();
      for (let i = 0; i < n; i++) {
        const r = find(i);
        if (!map.has(r)) map.set(r, []);
        map.get(r).push(entries[i].file);
      }

      for (const arr of map.values()) if (arr.length > 1) groups.push(arr);

      mainWindow?.webContents.send('app-log', { type: 'info', message: `Duplicate search complete: ${groups.length} group(s) found` });
      return { error: false, groups };
    } catch (error) {
      const message = `Error finding duplicate images: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
      return { error: true, message: 'Failed to find duplicates, check the logs for more information.', groups: [] };
    }
  }

  async getImageDimensions(filePath, mainWindow) {
    try {
      const input = readFileSync(filePath);
      const meta = await sharp(input).metadata();
      const width = meta.width || 0;
      const height = meta.height || 0;
      return { width, height };
    } catch (error) {
      const message = `Error reading image metadata: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'warning', message });
      return { width: 0, height: 0 };
    }
  }

  async hashWithWorkers(filePaths, method, mainWindow) {
    const entries = [];
    const total = filePaths.length;

    const usableWorkers = os.availableParallelism();
    const workers = Array.from({ length: usableWorkers }, () =>
      new Worker(new URL('./duplicateWorker.js', import.meta.url), { type: 'module' })
    );

    let nextIndex = 0;
    let processed = 0;

    function postProgress() {
      mainWindow?.webContents.send('duplicate-progress', { processed, total });
    }

    const runWorker = (worker) => new Promise((resolve) => {
      let active = 0;
      let finished = false;

      const tryResolve = () => {
        if (!finished && nextIndex >= total && active === 0) {
          finished = true;
          worker.off('message', onMessage);
          worker.off('error', onError);
          resolve();
        }
      };

      const assign = () => {
        if (nextIndex < total) {
          const idx = nextIndex++;
          const file = filePaths[idx];
          active++;
          worker.postMessage({ type: 'hash', file, method });
        } else {
          tryResolve();
        }
      };

      const onMessage = (msg) => {
        if (msg?.type === 'result') {
          processed++;
          if (msg.bytes) entries.push({ file: msg.file, bytes: Uint8Array.from(msg.bytes) });
          postProgress();
        } else if (msg?.type === 'error') {
          processed++;
          const message = `Error hashing (${method}) ${msg.file}: ${msg.error}`;
          mainWindow?.webContents.send('app-log', { type: 'warning', message });
          postProgress();
        }
        active = Math.max(0, active - 1);
        assign();
      };

      const onError = (err) => {
        mainWindow?.webContents.send('app-log', { type: 'error', message: `Duplicate worker error: ${err?.message || err}` });
        active = Math.max(0, active - 1);
        assign();
      };

      worker.on('message', onMessage);
      worker.on('error', onError);

      assign();
    });

    await Promise.all(workers.map((w) => runWorker(w)));
    await Promise.all(workers.map((w) => w.terminate().catch(() => {})));
    mainWindow?.webContents.send('duplicate-progress', { processed, total });

    return entries;
  }

  async trashFiles(filePaths = [], mainWindow) {
    const trashed = [];
    for (const file of filePaths) {
      try {
        await shell.trashItem(file);
        trashed.push(file);

        const dir = dirname(file);
        const name = basename(file);
        const txtPath = join(dir, name.replace(/\.[^.]+$/, '.txt'));
        if (existsSync(txtPath)) {
          await shell.trashItem(txtPath);
        }
      } catch (error) {
        const message = `Error trashing file ${file}: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
        mainWindow?.webContents.send('app-log', { type: 'error', message });
        return { error: true, message: "Error trashing file, check the logs for more information" }
      }
    }

    mainWindow?.webContents.send('app-log', { type: 'info', message: `Sent ${trashed.length} file(s) to trash` });
    return { error: false };
  };
}
