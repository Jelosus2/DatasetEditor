import { dialog } from 'electron';
import { default as _ } from 'lodash';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, basename, join, dirname } from 'node:path';
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

  async loadDatasetDirectory(mainWindow, isAllSaved, directory = null) {
    if (!isAllSaved && !await this.confirmUnsavedChanges(mainWindow)) {
      return null;
    }

    const directoryPath = directory || await this.selectDirectory(mainWindow);
    if (!directoryPath) return null;

    try {
      const { images, globalTags } = await this.processDatasetDirectory(directoryPath, mainWindow);
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

  async processDatasetDirectory(directoryPath, mainWindow) {
    const images = new Map();
    const globalTags = new Map();

    const files = readdirSync(directoryPath)
      .filter(file => SUPPORTED_IMAGE_EXTENSIONS.includes(extname(file).toLowerCase()));

    for (const file of files) {
      const fileName = basename(file);
      const imagePath = join(directoryPath, file);
      const tags = this.loadImageTags(directoryPath, fileName, mainWindow);

      images.set(fileName, {
        tags,
        path: imagePath,
        filePath: pathToFileURL(imagePath).href
      });

      this.updateGlobalTags(globalTags, tags, fileName);
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
}
