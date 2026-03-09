import type { Settings } from "../shared/settings-schema.js";

import { TaggerModelManager } from "./tagger/TaggerModelManager.js";
import { SettingsManager } from "./settings/SettingsManager.js";
import { UpdateManager } from "./updater/UpdateManager.js";
import { WindowManager } from "./window/WindowManager.js";
import { TaggerManager } from "./tagger/TaggerManager.js";
import { TagDatabase } from "./database/TagDatabase.js";
import { PathsBuilder } from "./utils/PathsBuilder.js";
import { IpcRegistrar } from "./ipc/IpcRegistrar.js";
import { Utilities } from "./utils/Utilities.js";
import { Logger } from "./utils/Logger.js";
import "./controllers/index.js";
import { app, dialog, nativeTheme, Menu, session } from "electron";
import path from "node:path";
import fs from "fs-extra";

export class App {
    static readonly IS_DEVELOPMENT = !app.isPackaged;
    static paths: PathsBuilder;
    static settings: SettingsManager;
    static database: TagDatabase;
    static window: WindowManager;
    static updater: UpdateManager;
    static logger: Logger;
    static tagger: TaggerManager;
    static taggerModels: TaggerModelManager;

    static async isPortableInstallation() {
        if (process.platform !== "win32")
            return false;

        const uninstallerPath = path.join(path.dirname(app.getPath("exe")), "Uninstall Dataset Editor.exe");
        return !(await fs.pathExists(uninstallerPath));
    }

    static async loadModules(debugFlag: boolean) {
        this.paths = new PathsBuilder(await this.getInstallScope());
        this.window = new WindowManager(debugFlag);
        this.settings = new SettingsManager();
        this.updater = new UpdateManager();
        this.tagger = new TaggerManager();
        this.taggerModels = new TaggerModelManager();
        IpcRegistrar.registerAll();
    }

    static async start(debugFlag: boolean) {
        try {
            if (!this.IS_DEVELOPMENT && !debugFlag)
                Menu.setApplicationMenu(null);

            await this.loadModules(debugFlag);

            this.database = await TagDatabase.start();
            const isDarkThemeDefault = nativeTheme.shouldUseDarkColors;
            await this.settings.initializeWithDefaults(isDarkThemeDefault);
            await this.taggerModels.initializeWithDefaults();

            const settings = await this.settings.loadSettings();
            if (!settings.enableHardwareAcceleration)
                app.disableHardwareAcceleration();

            app.whenReady().then(() => this.onAppReady(settings));
            app.on("window-all-closed", this.onWindowAllClosed);
            app.on("activate", this.onActivate);
        } catch (error) {
            console.error(error);
        }
    }

    static async onAppReady(settings: Settings) {
        try {
            await this.window.createMainWindow();

            this.database.tryLoadDefaultCsv();
            this.setupDanbooruRefererHeader();

            if (settings.autoCheckUpdates && !await this.isPortableInstallation())
                this.updater.checkForUpdates();
        } catch (error) {
            console.error(error);
            this.logger.error(`[App] Error during initialization: ${Utilities.getErrorMessage(error)}`);
        }
    }

    static onWindowAllClosed = () => {
        this.tagger.cleanup();
        if (process.platform !== "darwin")
            app.quit();
    }

    static onActivate = async () => {
        if (!this.window.hasMainWindow())
            await this.window.createMainWindow();
    }

    static setupDanbooruRefererHeader() {
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            const { hostname } = new URL(details.url);
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

    static async showSaveDialog(options: Electron.SaveDialogOptions) {
        return await dialog.showSaveDialog(this.window.mainWindow!, options);
    }

    static async importTagsCsvFromDialog() {
        try {
            const result = await this.showOpenDialog({
                title: "Select the tags CSV file",
                properties: ["openFile"],
                filters: [
                    {
                        name: "CSV File",
                        extensions: ["csv"]
                    }
                ],
            });

            const filePath = result.filePaths[0];
            if (!filePath)
                return { error: false, canceled: true }

            await this.database.loadCsv(filePath, /* resetTable = */ true);

            this.logger.info("[Database Manager] Successfully inserted tags into the database");
            return { error: false }
        } catch (error) {
            console.error(error);
            this.logger.error(`[Database Manager] Failed to insert tags into database: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to insert tags, check the logs for more information" }
        }
    }

    static async getInstallScope() {
        if (this.IS_DEVELOPMENT)
            return "dev";
        if (process.platform !== "win32")
            return "user";
        if (await this.isPortableInstallation())
            return "portable";

        try {
            const scopeFilePath = path.join(path.dirname(app.getPath("exe")), "install-scope.json");
            const payload: { scope: string } = await fs.readJSON(scopeFilePath);
            return payload.scope;
        } catch {
            const taggerDirectoryTest = path.join(process.env.ProgramData!, "dataset-editor", "tagger");
            return await fs.pathExists(taggerDirectoryTest) ? "machine" : "user";
        }
    }
}
