import { dialog } from 'electron';
import { default as _ } from 'lodash';
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
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

      images.set(file.fileName, {
        tags,
        path: file.filePath,
        filePath: `${pathToFileURL(file.filePath).href}?v=${Date.now()}`
      });

      this.updateGlobalTags(globalTags, tags, file.fileName);
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

      mainWindow?.webContents.send('app-log', { type: 'info', message: 'Image cropped successfully' });
      return { error: false, message: 'Image cropped successfully' };
    } catch (error) {
      const message = `Error cropping image: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
      return { error: true, message: 'Failed to crop image, check the logs for more information.' };
    }
  }
}
