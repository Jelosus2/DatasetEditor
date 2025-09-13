import { ipcMain, shell } from 'electron';
import { fetchDanbooruWiki, fetchDanbooruPosts } from '../utils/wiki.js';

export class IpcHandlers {
  constructor(managers) {
    this.datasetManager = managers.datasetManager;
    this.tagDatabase = managers.tagDatabase;
    this.tagGroupManager = managers.tagGroupManager;
    this.settingsManager = managers.settingsManager;
    this.taggerApiClient = managers.taggerApiClient;
    this.taggerProcessManager = managers.taggerProcessManager;
    this.windowManager = managers.windowManager;
    this.updateManager = managers.updateManager;
  }

  registerHandlers() {
    ipcMain.handle('load_dataset', async (_, isAllSaved, directory, recursive, sortOnLoad) =>
      await this.datasetManager.loadDatasetDirectory(this.windowManager.getMainWindow(), isAllSaved, directory, recursive, sortOnLoad)
    );

    ipcMain.handle('save_tag_group_file', async (_, tagGroups) =>
      await this.tagGroupManager.saveTagGroupFile(this.windowManager.getMainWindow(), tagGroups)
    );

    ipcMain.handle('import_tag_group', async () =>
      await this.tagGroupManager.importTagGroup(this.windowManager.getMainWindow())
    );

    ipcMain.handle('save_tag_group', (_, tagGroups) =>
      this.tagGroupManager.saveTagGroup(tagGroups, this.windowManager.getMainWindow())
    );

    ipcMain.handle('load_tag_group', () =>
      this.tagGroupManager.loadTagGroups(this.windowManager.getMainWindow())
    );

    ipcMain.handle('load_tag_suggestions', (_, query) =>
      this.tagDatabase.loadTagCompletions(query)
    );

    ipcMain.handle('save_dataset', (_, dataset, sort) =>
      this.datasetManager.saveDataset(dataset, sort, this.windowManager.getMainWindow())
    );

    ipcMain.handle('get_tagger_device', async () => {
      const settings = this.settingsManager.loadSettings(this.windowManager.getMainWindow());
      const port = settings?.taggerPort ?? 3067;
      return await this.taggerApiClient.getTaggerDevice(port);
    });

    ipcMain.handle('tag_images', async (_, props) => {
      const settings = this.settingsManager.loadSettings(this.windowManager.getMainWindow());
      const port = settings?.taggerPort ?? 3067;
      return await this.taggerApiClient.autoTagImages(props, port);
    });

    ipcMain.handle('save_settings', (_, settings) =>
      this.settingsManager.saveSettings(settings, undefined, this.windowManager.getMainWindow())
    );

    ipcMain.handle('load_settings', () =>
      this.settingsManager.loadSettings(this.windowManager.getMainWindow())
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

    ipcMain.handle('start_tagger_service', () => {
      const settings = this.settingsManager.loadSettings();
      const port = settings?.taggerPort ?? 3067;
      return this.taggerProcessManager.startTaggerService(port);
    });

    ipcMain.handle('stop_tagger_service', () =>
      this.taggerProcessManager.stopTaggerService()
    );

    ipcMain.handle('open-url', (_, url) =>
      shell.openExternal(url)
    );

    ipcMain.handle('check_for_updates', () =>
      this.updateManager.checkForUpdates()
    );

    ipcMain.handle('download_update', () =>
      this.updateManager.downloadUpdate()
    );

    ipcMain.handle('install_update', () =>
      this.updateManager.installUpdate()
    );

    ipcMain.handle('are_updates_available', () =>
      this.updateManager.areUpdatesAvailable()
    );

    ipcMain.handle('apply_background_color', async (_, images, color) =>
      await this.datasetManager.applyBackgroundColor(images, color, this.windowManager.getMainWindow())
    );

    ipcMain.handle('get_thumbnail', async (_, filePath, size) =>
      await this.datasetManager.getThumbnail(filePath, this.windowManager.getMainWindow(), size)
    );

    ipcMain.handle('get_image_dimensions', async (_, filePath) =>
      await this.datasetManager.getImageDimensions(filePath, this.windowManager.getMainWindow())
    );

    ipcMain.handle('fetch_danbooru_wiki', async (_, tag) =>
      await fetchDanbooruWiki(tag)
    );

    ipcMain.handle('fetch_danbooru_posts', async (_, tag) =>
      await fetchDanbooruPosts(tag)
    );

    ipcMain.handle('crop_image', async (_, path, crop, overwrite) =>
      await this.datasetManager.cropImage(path, crop, overwrite, this.windowManager.getMainWindow())
    );

    ipcMain.handle('find_duplicates', async (_, files, method, threshold) =>
      await this.datasetManager.findDuplicates(files, this.windowManager.getMainWindow(), method, threshold)
    );

    ipcMain.handle('trash_files', async (_, files) =>
      await this.datasetManager.trashFiles(files, this.windowManager.getMainWindow())
    );

    ipcMain.handle('rename_files', async (_, files, startAt) =>
      await this.datasetManager.renameFiles(files, this.windowManager.getMainWindow(), startAt)
    );
  }
}
