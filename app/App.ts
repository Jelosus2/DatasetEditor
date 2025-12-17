import type { Settings } from "./types/settings.js";

import { SettingsManager } from "./settings/SettingsManager.js";
import { UpdateManager } from "./updater/updateManager.js";
import { WindowManager } from "./window/WindowManager.js";
import { TagDatabase } from "./database/TagDatabase.js";
import { PathsBuilder } from "./utils/PathsBuilder.js";
import electron from "electron";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";

const { app, ipcMain, nativeTheme, Menu, session } = electron;

export class App {
    static readonly IS_DEVELOPMENT = !app.isPackaged;
    static readonly electron = electron;
    static readonly ipcMain = ipcMain;
    static paths: PathsBuilder;
    static settings: SettingsManager;
    static database: TagDatabase;
    static window: WindowManager;
    static updater: UpdateManager;

    static getBasePath() {
        let basePath = this.IS_DEVELOPMENT ? app.getAppPath() : app.getPath("userData");

        // Check if it's a portable installation
        const portableTestPath = path.join(path.dirname(app.getPath("exe")), "Uninstall Dataset Editor.exe");
        if (!this.IS_DEVELOPMENT && fs.existsSync(portableTestPath))
            basePath = process.resourcesPath

        return basePath
    }

    static isPortableInstallation(): boolean {
        return !fs.existsSync(App.paths.uninstallerPath);
    }

    static loadModules(debugFlag: boolean) {
        this.paths = new PathsBuilder(this.getBasePath());
        this.window = new WindowManager(debugFlag);
        this.settings = new SettingsManager();
        this.database = new TagDatabase();
        this.updater = new UpdateManager();
    }

    static start(debugFlag: boolean) {
        if (!this.IS_DEVELOPMENT && !debugFlag)
            Menu.setApplicationMenu(null);

        this.loadModules(debugFlag);

        const settings = this.settings.loadSettings();
        if (settings != null && !settings.enableHardwareAcceleration)
            app.disableHardwareAcceleration();

        app.whenReady().then(() => this.onAppReady(settings));
        app.on('window-all-closed', this.onWindowAllClosed);
        app.on('activate', this.onActivate);
    }

    static async onAppReady(settings: Settings | null) {
        try {
            await this.database.tryLoadDefaultCsv();
            await this.window.createMainWindow();

            this.setupDanbooruRefererHeader();

            const isDarkThemeDefault = nativeTheme.shouldUseDarkColors;
            this.settings.initializeWithDefaults(isDarkThemeDefault);

            if (settings?.autoCheckUpdates && !this.isPortableInstallation())
                this.updater.checkForUpdates();
        } catch (error: unknown) {
            console.error(error);
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
}
