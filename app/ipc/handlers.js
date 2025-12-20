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
    this.updateManager = managers.updateManager;
  }

  registerHandlers() {

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
  }
}
