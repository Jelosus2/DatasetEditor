import { dialog } from 'electron';
import { default as _ } from 'lodash';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export class SettingsManager {
  constructor(dataPath, tagAutocompletionsPath) {
    this.dataPath = dataPath;
    this.tagAutocompletionsPath = tagAutocompletionsPath;
    this.originalSettings = null;
  }

  getDefaultSettings() {
    return {
      showTagCount: false,
      theme: 'dark',
      autocomplete: true,
      autocompleteFile: join(this.tagAutocompletionsPath, 'danbooru.csv'),
      tagsIgnored: [],
      taggerPort: 3067,
    };
  }

  saveSettings(settings, shouldDarkBeDefault, mainWindow) {
    const settingsPath = join(this.dataPath, 'settings.json');
    const settingsDir = dirname(settingsPath);

    try {
      if (!settings && existsSync(settingsPath)) return;

      if (!existsSync(settingsDir)) {
        mkdirSync(settingsDir, { recursive: true });
      }

      const defaultSettings = this.getDefaultSettings();
      if (!settings) {
        if (!existsSync(defaultSettings.autocompleteFile)) {
          defaultSettings.autocompleteFile = '';
        }
        if (!shouldDarkBeDefault) {
          defaultSettings.theme = 'winter';
        }
      }

      const finalSettings = settings ?? defaultSettings;
      writeFileSync(settingsPath, JSON.stringify(finalSettings, null, 2));
      this.originalSettings = finalSettings;
    } catch (error) {
      const message = `Error saving settings: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
    }
  }

  loadSettings(mainWindow) {
    const settingsPath = join(this.dataPath, 'settings.json');

    if (!existsSync(settingsPath)) return null;

    try {
      const loaded = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      const merged = { ...this.getDefaultSettings(), ...loaded };

      if (!_.isEqual(merged, loaded)) {
        this.saveSettings(merged, undefined, mainWindow);
      }

      this.originalSettings = merged;
      return merged;
    } catch (error) {
      const message = `Error loading settings: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
      return null;
    }
  }

  compareSettingsChanges(settings) {
    if (!this.originalSettings) return true;
    return _.isEqual(this.originalSettings, settings);
  }

  async changeAutocompleteFile(mainWindow, database) {
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

    try {
      const tagDatabase = new (await import('../database/tagDatabase.js')).TagDatabase(database);
      await tagDatabase.insertTagsFromCSV(result.filePaths[0], true, mainWindow);
      return result.filePaths[0];
    } catch (error) {
      const message = `Error changing autocomplete file: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      mainWindow?.webContents.send('app-log', { type: 'error', message });
    }
  }

  initializeDefaultSettings(shouldDarkBeDefault, mainWindow) {
    this.saveSettings(null, shouldDarkBeDefault, mainWindow);
  }
}
