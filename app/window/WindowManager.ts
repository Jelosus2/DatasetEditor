import type { AppCloseAction, AppCloseRequestPayload, AppCloseResponsePayload } from "../../shared/app-close.js";
import type { AppStatusPayload } from "../../shared/app-status.js";
import type { PendingCloseRequest } from "../types/app-close.js";

import { Utilities } from "../utils/Utilities.js";
import { Logger } from "../utils/Logger.js";
import { App } from "../App.js";
import { ipcMain, BrowserWindow } from "electron";

export class WindowManager {
    private readonly debugFlag: boolean;
    mainWindow: BrowserWindow | null;
    private isForceClosing = false;
    private closeInProgress = false;
    private closeRequestId = 0;
    private pendingCloseRequests = new Map<number, PendingCloseRequest>();
    private readonly CLOSE_RESPONSE_TIMEOUT_MS = 8000;

    constructor(debugFlag: boolean) {
        this.debugFlag = debugFlag;
        this.mainWindow = null;
    }

    async createMainWindow() {
        this.mainWindow = new BrowserWindow({
            backgroundColor: "#1d232a",
            autoHideMenuBar: true,
            title: "Dataset Editor",
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

        App.logger = Logger.setupLogging(this.mainWindow);

        if (this.mainWindow.isMaximizable())
            this.mainWindow.maximize();

        if (App.IS_DEVELOPMENT)
            await this.mainWindow.loadURL("http://localhost:5173/");
        else
            await this.mainWindow.loadFile(App.paths.indexFilePath);

        this.setupWindowEventHandlers();
    }

    private setupWindowEventHandlers() {
        ipcMain.removeListener("app:close_response", this.handleCloseResponse);
        ipcMain.on("app:close_response", this.handleCloseResponse);

        this.mainWindow?.on("close", (event) => {
            this.handleWindowClose(event);
        });

        this.mainWindow?.on("closed", () => {
            this.cleanupPendingCloseRequests("Window closed");
            ipcMain.removeListener("app:close_response", this.handleCloseResponse);

            this.mainWindow = null;
            this.isForceClosing = false;
            this.closeInProgress = false;
        });
    }

    hasMainWindow(): boolean {
        return this.mainWindow !== null;
    }

    ipcSend(channel: string, ...args: unknown[]) {
        this.mainWindow?.webContents.send(channel, ...args);
    }

    sendStatus(payload: AppStatusPayload) {
        this.ipcSend("app:status", payload);
    }

    private async handleWindowClose(event: Electron.Event) {
        if (this.isForceClosing)
            return;
        event.preventDefault();

        if (this.closeInProgress)
            return;
        this.closeInProgress = true;

        try {
            const checkResult = await this.requestRendererCloseAction("check");
            if (checkResult.allSaved) {
                this.forceCloseWindow();
                return;
            }

            const decision = await App.showMessageBox({
                type: "question",
                title: "Unsaved Changes",
                message: "You have unsaved changes. Save before closing?",
                buttons: ["Save", "Don't Save", "Cancel"],
                defaultId: 0,
                cancelId: 2
            });

            if (decision.response === 0) {
                const saveResult = await this.requestRendererCloseAction("save");
                if (saveResult.allSaved) {
                    this.forceCloseWindow();
                    return;
                }

                if (saveResult.error)
                    App.logger.warning(`[Window Manager] Close-save failed: ${saveResult.error}`);

                await App.showMessageBox({
                    type: "warning",
                    title: "Close Canceled",
                    message: "Could not save all changes. Save pending changes and try again.",
                    buttons: ["OK"]
                });
            } else if (decision.response === 1) {
                this.forceCloseWindow();
            }
        } catch (error) {
            App.logger.error(`[Window Manager] Error during close flow: ${Utilities.getErrorMessage(error)}`);
        } finally {
            this.closeInProgress = false;
        }
    }

    private requestRendererCloseAction(action: AppCloseAction): Promise<AppCloseResponsePayload> {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return Promise.resolve({ requestId: -1, allSaved: true });

        const requestId = ++this.closeRequestId;
        const payload: AppCloseRequestPayload = { requestId, action };

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingCloseRequests.delete(requestId);
                resolve({
                    requestId,
                    allSaved: false,
                    error: "Timed out waiting for renderer close response"
                });
            }, this.CLOSE_RESPONSE_TIMEOUT_MS);

            this.pendingCloseRequests.set(requestId, { resolve, timeout });
            this.ipcSend("app:close_request", payload);
        });
    }

    private forceCloseWindow() {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return;

        this.isForceClosing = true;
        this.mainWindow.close();
    }

    private cleanupPendingCloseRequests(reason: string) {
        for (const [requestId, pending] of this.pendingCloseRequests) {
            clearTimeout(pending.timeout);
            pending.resolve({ requestId, allSaved: false, error: reason });
        }

        this.pendingCloseRequests.clear();
    }

    private handleCloseResponse = (event: Electron.IpcMainEvent, payload: AppCloseResponsePayload) => {
        if (!this.mainWindow || event.sender.id !== this.mainWindow.webContents.id)
            return;

        const pending = this.pendingCloseRequests.get(payload.requestId);
        if (!pending)
            return;

        clearTimeout(pending.timeout);
        this.pendingCloseRequests.delete(payload.requestId);
        pending.resolve(payload);
    }
}
