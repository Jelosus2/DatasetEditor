import type { Settings } from "./types/settings.js";

import { SettingsManager } from "./settings/SettingsManager.js";
import { UpdateManager } from "./updater/UpdateManager.js";
import { WindowManager } from "./window/WindowManager.js";
import { TagDatabase } from "./database/TagDatabase.js";
import { PathsBuilder } from "./utils/PathsBuilder.js";
import { IpcRegistrar } from "./ipc/IpcRegistrar.js";
import { Utilities } from "./utils/Utilities.js";
import { Logger } from "./utils/Logger.js";
import "./controllers/index.js";
import { app, dialog, nativeTheme, Menu, session } from "electron";
import path from "node:path";
import url from "node:url";
import fs from "fs-extra";

export class App {
    static readonly IS_DEVELOPMENT = !app.isPackaged;
    static paths: PathsBuilder;
    static settings: SettingsManager;
    static database: TagDatabase;
    static window: WindowManager;
    static updater: UpdateManager;
    static logger: Logger;

    static async getBasePath() {
        let basePath = this.IS_DEVELOPMENT ? app.getAppPath() : app.getPath("userData");

        // Check if it's a portable installation
        const portableTestPath = path.join(path.dirname(app.getPath("exe")), "Uninstall Dataset Editor.exe");
        if (!this.IS_DEVELOPMENT && await fs.pathExists(portableTestPath))
            basePath = process.resourcesPath

        return basePath
    }

    static async isPortableInstallation() {
        return !(await fs.pathExists(App.paths.uninstallerPath));
    }

    static async loadModules(debugFlag: boolean) {
        this.paths = new PathsBuilder(await this.getBasePath());
        this.window = new WindowManager(debugFlag);
        this.settings = new SettingsManager();
        this.updater = new UpdateManager();
        IpcRegistrar.registerAll();
    }

    static async start(debugFlag: boolean) {
        try {
            if (!this.IS_DEVELOPMENT && !debugFlag)
                Menu.setApplicationMenu(null);

            await this.loadModules(debugFlag);
            this.database = await TagDatabase.start();

            const settings = await this.settings.loadSettings();
            if (settings != null && !settings.enableHardwareAcceleration)
                app.disableHardwareAcceleration();

            app.whenReady().then(() => this.onAppReady(settings));
            app.on('window-all-closed', this.onWindowAllClosed);
            app.on('activate', this.onActivate);
        } catch (error) {
            console.error(error);
        }
    }

    static async onAppReady(settings: Settings | null) {
        try {
            await this.window.createMainWindow();
            this.logger = Logger.setupLogging(this.window.mainWindow!);

            await this.database.tryLoadDefaultCsv();
            this.setupDanbooruRefererHeader();

            const isDarkThemeDefault = nativeTheme.shouldUseDarkColors;
            await this.settings.initializeWithDefaults(isDarkThemeDefault);

            if (settings?.autoCheckUpdates && !this.isPortableInstallation())
                this.updater.checkForUpdates();
        } catch (error) {
            console.error(error);
            this.logger?.error(`[App] Error during initialization: ${Utilities.getErrorMessage(error)}`);
        }
    }

    static onWindowAllClosed() {
        if (process.platform !== "darwin")
            app.quit();
    }

    static async onActivate() {
        if (!this.window.hasMainWindow())
            await this.window.createMainWindow();
    }

    static setupDanbooruRefererHeader() {
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            const { hostname } = new url.URL(details.url);
            if (hostname.endsWith("donmai.us"))
                details.requestHeaders["Referer"] = "https://danbooru.donmai.us/";

            callback({ requestHeaders: details.requestHeaders });
        });
    }

    static async showMessageBox(options: Electron.MessageBoxOptions) {
        return await dialog.showMessageBox(this.window.mainWindow!, options);
    }

    static async showOpenDialog(options: Electron.OpenDialogOptions) {
        return await dialog.showOpenDialog(this.window.mainWindow!, options);
    }
}
