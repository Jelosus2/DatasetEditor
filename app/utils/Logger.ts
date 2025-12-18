import type { BrowserWindow } from "electron";

export class Logger {
    readonly mainWindow: BrowserWindow;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    static setupLogging(mainWindow: BrowserWindow) {
        return new this(mainWindow);
    }

    info(message: string) {
        this.sendLog("info", message);
    }

    warning(message: string) {
        this.sendLog("warning", message);
    }

    error(message: string) {
        this.sendLog("error", message);
    }

    sendLog(type: "info" | "warning" | "error", message: string) {
        if (this.mainWindow && !this.mainWindow.isDestroyed())
            this.mainWindow.webContents.send("app-log", { type, message });
    }
}
