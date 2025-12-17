import type { BrowserWindow } from "electron";

import { App } from "../App.js";

export class WindowManager {
    readonly debugFlag: boolean;
    mainWindow: BrowserWindow | null;

    constructor(debugFlag: boolean) {
        this.debugFlag = debugFlag;
        this.mainWindow = null;
    }

    async createMainWindow() {
        this.mainWindow = new App.electron.BrowserWindow({
            backgroundColor: '#1d232a',
            autoHideMenuBar: true,
            title: 'Dataset Editor',
            width: 1280,
            height: 800,
            show: false,
            icon: App.paths.appIconPath,
            webPreferences: {
                preload: App.paths.preloadFilePath,
                webSecurity: !App.IS_DEVELOPMENT,
                devTools: App.IS_DEVELOPMENT || this.debugFlag,
            },
        });

        if (this.mainWindow.isMaximizable())
            this.mainWindow.maximize();

        if (App.IS_DEVELOPMENT)
            await this.mainWindow.loadURL("http://localhost:5173/");
        else
            await this.mainWindow.loadFile(App.paths.indexFilePath);

        this.setupWindowEventHandlers();
    }

    setupWindowEventHandlers() {
        this.mainWindow?.on('closed', () => {
            this.mainWindow = null;
        });

        this.mainWindow?.on('close', (e) => {
            e.preventDefault();
            this.handleWindowClose();
        });
    }

    handleWindowClose() {
        this.mainWindow?.webContents.send('are_changes_saved');

        App.ipcMain.once('changes_saved', async (_, allSaved) => {
            if (allSaved) {
                this.mainWindow?.destroy();
            } else {
                const result = await App.electron.dialog.showMessageBox(this.mainWindow!, {
                    type: 'question',
                    buttons: ['Yes', 'No', 'Cancel'],
                    title: 'Confirm',
                    message: 'You are about to quit, save all changes?',
                });

                if (result.response === 0) {
                    this.mainWindow?.webContents.send('save_all_changes');
                    App.ipcMain.once('save_all_done', () => this.mainWindow?.destroy());
                } else if (result.response === 1) {
                    this.mainWindow?.destroy();
                }
            }
        });
    }

    hasMainWindow(): boolean {
        return this.mainWindow !== null;
    }
}
