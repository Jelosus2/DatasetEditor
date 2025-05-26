import { dialog } from 'electron';
import { default as _ } from 'lodash';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export class TagGroupManager {
  constructor(tagGroupsPath) {
    this.tagGroupsPath = tagGroupsPath;
    this.originalTagGroups = null;
  }

  async saveTagGroupFile(mainWindow, tagGroups) {
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

    try {
      writeFileSync(result.filePath, JSON.stringify(tagGroups, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving tag group file:', error);
      throw error;
    }
  }

  async importTagGroup(mainWindow) {
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

    try {
      const filePath = result.filePaths[0];
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));

      if (!this.validateTagGroupData(data)) {
        return false;
      }

      return new Map(Object.entries(data).map(([name, tags]) => [name, new Set(tags)]));
    } catch (error) {
      console.error('Error importing tag group:', error);
      return false;
    }
  }

  saveTagGroup(tagGroups) {
    const tagGroupFilePath = join(this.tagGroupsPath, 'tag_groups.json');

    try {
      if (!existsSync(this.tagGroupsPath)) {
        mkdirSync(this.tagGroupsPath, { recursive: true });
      }

      writeFileSync(tagGroupFilePath, JSON.stringify(tagGroups));

      this.originalTagGroups = tagGroups;
    } catch (error) {
      console.error('Error saving tag group:', error);
      throw error;
    }
  }

  loadTagGroups() {
    const tagGroupFilePath = join(this.tagGroupsPath, 'tag_groups.json');

    if (!existsSync(tagGroupFilePath)) return null;

    try {
      const data = JSON.parse(readFileSync(tagGroupFilePath, 'utf-8'));
      this.originalTagGroups = data;
      return new Map(Object.entries(data).map(([name, tags]) => [name, new Set(tags)]));
    } catch (error) {
      console.error('Error loading tag groups:', error);
      return null;
    }
  }

  compareTagGroupChanges(tagGroups) {
    if (!this.originalTagGroups) return true;
    return _.isEqual(this.originalTagGroups, tagGroups);
  }

  validateTagGroupData(data) {
    if (Array.isArray(data)) return false;

    for (const key in data) {
      if (!Array.isArray(data[key])) return false;
      for (const value of data[key]) {
        if (typeof value !== 'string') return false;
      }
    }
    return true;
  }
}
