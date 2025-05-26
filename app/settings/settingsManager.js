import { dialog } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export class SettingsManager {
  constructor(dataPath, tagAutocompletionsPath) {
    this.dataPath = dataPath;
    this.tagAutocompletionsPath = tagAutocompletionsPath;
  }

  getDefaultSettings() {
    return {
      showTagCount: false,
      theme: 'auto',
      autocomplete: true,
      autocompleteFile: join(this.tagAutocompletionsPath, 'danbooru.csv'),
      tagsIgnored: [],
    };
  }

  saveSettings(settings) {
    const settingsPath = join(this.dataPath, 'settings.json');
    const settingsDir = dirname(settingsPath);

    try {
      if (!settings && existsSync(settingsPath)) return;

      if (!existsSync(settingsDir)) {
        mkdirSync(settingsDir, { recursive: true });
      }

      const defaultSettings = this.getDefaultSettings();
      if (!settings && !existsSync(defaultSettings.autocompleteFile)) {
        defaultSettings.autocompleteFile = '';
      }

      const finalSettings = settings ?? defaultSettings;
      writeFileSync(settingsPath, JSON.stringify(finalSettings, null, 2));
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  loadSettings() {
    const settingsPath = join(this.dataPath, 'settings.json');

    if (!existsSync(settingsPath)) return null;

    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      return settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return null;
    }
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
      await tagDatabase.insertTagsFromCSV(result.filePaths[0], true);
      return result.filePaths[0];
    } catch (error) {
      console.error('Error changing autocomplete file:', error);
      throw error;
    }
  }

  initializeDefaultSettings() {
    this.saveSettings(null);
  }
}
