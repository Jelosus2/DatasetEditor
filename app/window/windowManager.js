import { BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { _dirname } from '../utils/helpers.js';

const __dirname = _dirname(import.meta.url);

export class WindowManager {
  constructor(isDebug, debugFlag) {
    this.isDebug = isDebug;
    this.debugFlag = debugFlag;
    this.mainWindow = null;
  }

  async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      backgroundColor: '#1d232a',
      autoHideMenuBar: true,
      title: 'Dataset Editor',
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        preload: join(__dirname, '..', 'preload.js'),
        webSecurity: !this.isDebug,
        devTools: this.isDebug || this.debugFlag,
      },
    });

    this.mainWindow.maximize();

    if (this.isDebug) {
      this.mainWindow.loadURL('http://localhost:5173/');
    } else {
      this.mainWindow.loadFile(join(__dirname, '..', '..', 'dist', 'index.html'));
    }

    this.setupWindowEventHandlers();
    return this.mainWindow;
  }

  setupWindowEventHandlers() {
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.on('close', (e) => {
      e.preventDefault();
      this.handleWindowClose();
    });
  }

  handleWindowClose() {
    this.mainWindow.webContents.send('are_changes_saved');

    ipcMain.once('changes_saved', async (_, allSaved) => {
      if (allSaved) {
        this.mainWindow.destroy();
      } else {
        const result = await dialog.showMessageBox(this.mainWindow, {
          type: 'question',
          buttons: ['Yes', 'No', 'Cancel'],
          title: 'Confirm',
          message: 'You are about to quit, save all changes?',
        });

        if (result.response === 0) {
          this.mainWindow.webContents.send('save_all_changes');
          ipcMain.once('save_all_done', () => this.mainWindow.destroy());
        } else if (result.response === 1) {
          this.mainWindow.destroy();
        }
      }
    });
  }

  hasMainWindow() {
    return this.mainWindow !== null;
  }

  getMainWindow() {
    return this.mainWindow;
  }
}
