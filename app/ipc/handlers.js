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

    ipcMain.handle('compare_tag_group_changes', (_, tagGroups) =>
      this.tagGroupManager.compareTagGroupChanges(tagGroups)
    );

    ipcMain.handle('start_tagger_service', () => {
      const settings = this.settingsManager.loadSettings();
      const port = settings?.taggerPort ?? 3067;
      return this.taggerProcessManager.startTaggerService(port);
    });

    ipcMain.handle('stop_tagger_service', () =>
      this.taggerProcessManager.stopTaggerService()
    );

    ipcMain.handle('crop_image', async (_, path, crop, overwrite) =>
      await this.datasetManager.cropImage(path, crop, overwrite, this.windowManager.getMainWindow())
    );

    ipcMain.handle('find_duplicates', async (_, files, method, threshold) =>
      await this.datasetManager.findDuplicates(files, this.windowManager.getMainWindow(), method, threshold)
    );

    ipcMain.handle('rename_files', async (_, files, startAt) =>
      await this.datasetManager.renameFiles(files, this.windowManager.getMainWindow(), startAt)
    );
  }
}
