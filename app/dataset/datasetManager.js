import { dialog, shell } from 'electron';
import { default as _ } from 'lodash';
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

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
        const outputBuffer = await sharp(image)
          .flatten({ background: color })
          .toBuffer();

        writeFileSync(image, outputBuffer);

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
        const buffer = await sharp(path).extract(extractOptions).toBuffer();
        writeFileSync(outPath, buffer);
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

      const entries = [];
      for (const file of filePaths) {
        try {
          const bytes = method === 'dhash' ? await this.computeDHashBytes(file) : await this.computePHashBytes(file);
          if (!bytes) continue;
          entries.push({ file, bytes });
        } catch (error) {
          const message = `Error hashing (${method}) ${file}: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
          mainWindow?.webContents.send('app-log', { type: 'warning', message });
        }
      }

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

  async computeDHashBytes(filePath) {
    const input = readFileSync(filePath);
    const pixels = await sharp(input)
      .rotate()
      .grayscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();

    const out = new Uint8Array(8);
    let bitIndex = 0;
    for (let y = 0; y < 8; y++) {
      const rowStart = y * 9;
      for (let x = 0; x < 8; x++) {
        const left = pixels[rowStart + x];
        const right = pixels[rowStart + x + 1];
        const bit = left < right ? 1 : 0;
        const byteIndex = (bitIndex / 8) | 0;
        out[byteIndex] = (out[byteIndex] << 1) | bit;
        bitIndex++;
      }
    }

    const remaining = 8 - (bitIndex % 8);
    if (remaining !== 8) out[(bitIndex / 8) | 0] <<= remaining;
    return out;
  }

  async computePHashBytes(filePath) {
    const size = 32;
    const small = 8;

    const input = readFileSync(filePath);
    const pixels = await sharp(input)
      .rotate()
      .grayscale()
      .resize(size, size, { fit: 'fill' })
      .raw()
      .toBuffer();

    const img = Array.from({ length: size }, (_, y) => {
      const row = new Array(size);
      for (let x = 0; x < size; x++) row[x] = pixels[y * size + x];
      return row;
    });

    const dct = this.dct2D(img);

    const block = [];
    for (let y = 0; y < small; y++) {
      for (let x = 0; x < small; x++) block.push(dct[y][x]);
    }

    const vals = block.slice(1);
    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted[(sorted.length / 2) | 0];

    const out = new Uint8Array(8);
    let bitIndex = 0;
    for (let i = 0; i < block.length; i++) {
      const v = block[i];
      const bit = v > median ? 1 : 0;
      const byteIndex = (bitIndex / 8) | 0;
      out[byteIndex] = (out[byteIndex] << 1) | bit;
      bitIndex++;
    }
    const remaining = 8 - (bitIndex % 8);
    if (remaining !== 8) out[(bitIndex / 8) | 0] <<= remaining;
    return out;
  }

  dct2D(matrix) {
    const N = matrix.length;
    const M = matrix[0].length;

    const cosX = Array.from({ length: N }, () => new Array(N));
    const cosY = Array.from({ length: M }, () => new Array(M));
    for (let u = 0; u < N; u++)
      for (let x = 0; x < N; x++)
        cosX[u][x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
    for (let v = 0; v < M; v++)
      for (let y = 0; y < M; y++)
        cosY[v][y] = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * M));

    const result = Array.from({ length: N }, () => new Array(M).fill(0));
    for (let u = 0; u < N; u++) {
      const Cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      for (let v = 0; v < M; v++) {
        const Cv = v === 0 ? 1 / Math.sqrt(2) : 1;
        let sum = 0;
        for (let x = 0; x < N; x++) {
          for (let y = 0; y < M; y++) {
            sum += matrix[x][y] * cosX[u][x] * cosY[v][y];
          }
        }
        result[u][v] = 0.25 * Cu * Cv * sum;
      }
    }
    return result;
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
