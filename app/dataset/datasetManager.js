import { dialog } from 'electron';
import { default as _ } from 'lodash';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, basename, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

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
      const { images, globalTags } = await this.processDatasetDirectory(directoryPath);
      this.originalDataset = this.serializeDatasetImages(images);

      return { images, globalTags, directoryPath };
    } catch (error) {
      console.error('Error loading dataset directory:', error);
      throw error;
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

  async processDatasetDirectory(directoryPath) {
    const images = new Map();
    const globalTags = new Map();

    const files = readdirSync(directoryPath)
      .filter(file => SUPPORTED_IMAGE_EXTENSIONS.includes(extname(file).toLowerCase()));

    for (const file of files) {
      const fileName = basename(file);
      const imagePath = join(directoryPath, file);
      const tags = this.loadImageTags(directoryPath, fileName);

      images.set(fileName, {
        tags,
        path: imagePath,
        filePath: pathToFileURL(imagePath).href
      });

      this.updateGlobalTags(globalTags, tags, fileName);
    }

    return { images, globalTags };
  }

  loadImageTags(directoryPath, fileName) {
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
      console.warn(`Error reading tags for ${fileName}:`, error);
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

  saveDataset(dataset) {
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
        console.error(`Error saving tags for ${imageName}:`, error);
      }
    }

    this.originalDataset = Object.entries(dataset).map(([img, props]) => [img, props]);
  }

  compareDatasetChanges(images) {
    if (!this.originalDataset) return true;
    return _.isEqual(this.originalDataset, images);
  }

  serializeDatasetImages(images) {
    return [...images].map(([img, props]) => [
      img,
      { tags: [...props.tags], path: props.path }
    ]);
  }
}
