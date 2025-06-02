import { ipcMain } from 'electron';

export class IpcHandlers {
  constructor(managers) {
    this.datasetManager = managers.datasetManager;
    this.tagDatabase = managers.tagDatabase;
    this.tagGroupManager = managers.tagGroupManager;
    this.settingsManager = managers.settingsManager;
    this.taggerApiClient = managers.taggerApiClient;
    this.taggerProcessManager = managers.taggerProcessManager;
    this.windowManager = managers.windowManager;
  }

  registerHandlers() {
    ipcMain.handle('load_dataset', async (_, isAllSaved, directory) =>
      await this.datasetManager.loadDatasetDirectory(this.windowManager.getMainWindow(), isAllSaved, directory)
    );

    ipcMain.handle('save_tag_group_file', async (_, tagGroups) =>
      await this.tagGroupManager.saveTagGroupFile(this.windowManager.getMainWindow(), tagGroups)
    );

    ipcMain.handle('import_tag_group', async () =>
      await this.tagGroupManager.importTagGroup(this.windowManager.getMainWindow())
    );

    ipcMain.handle('save_tag_group', (_, tagGroups) =>
      this.tagGroupManager.saveTagGroup(tagGroups)
    );

    ipcMain.handle('load_tag_group', () =>
      this.tagGroupManager.loadTagGroups()
    );

    ipcMain.handle('load_tag_suggestions', (_, query) =>
      this.tagDatabase.loadTagCompletions(query)
    );

    ipcMain.handle('save_dataset', (_, dataset, sort) =>
      this.datasetManager.saveDataset(dataset, sort)
    );

    ipcMain.handle('get_tagger_device', async () =>
      await this.taggerApiClient.getTaggerDevice()
    );

    ipcMain.handle('tag_images', async (_, props) =>
      await this.taggerApiClient.autoTagImages(props)
    );

    ipcMain.handle('save_settings', (_, settings) =>
      this.settingsManager.saveSettings(settings)
    );

    ipcMain.handle('load_settings', () =>
      this.settingsManager.loadSettings()
    );

    ipcMain.handle('change_autotag_file', async () =>
      await this.settingsManager.changeAutocompleteFile(this.windowManager.getMainWindow(), this.tagDatabase.db)
    );

    ipcMain.handle('compare_dataset_changes', (_, images) =>
      this.datasetManager.compareDatasetChanges(images)
    );

    ipcMain.handle('compare_tag_group_changes', (_, tagGroups) =>
      this.tagGroupManager.compareTagGroupChanges(tagGroups)
    );

    ipcMain.handle('compare_settings_changes', (_, settings) =>
      this.settingsManager.compareSettingsChanges(settings)
    );

    ipcMain.handle('start_tagger_service', () =>
      this.taggerProcessManager.startTaggerService()
    );

    ipcMain.handle('stop_tagger_service', () =>
      this.taggerProcessManager.stopTaggerService()
    );
  }
}
