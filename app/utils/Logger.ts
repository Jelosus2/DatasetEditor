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
        if (this.mainWindow && !this.mainWindow.isDestroyed())
            this.mainWindow.webContents.send("app-log", { type: "info", message });
    }

    warning(message: string) {
        if (this.mainWindow && !this.mainWindow.isDestroyed())
            this.mainWindow.webContents.send("app-log", { type: "warning", message });
    }

    error(message: string) {
        if (this.mainWindow && !this.mainWindow.isDestroyed())
            this.mainWindow.webContents.send("app-log", { type: "error", message });
    }
}
