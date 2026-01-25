import { Utilities } from "./Utilities.js";
import { App } from "../App.js";
import pty from "@homebridge/node-pty-prebuilt-multiarch";

export class Terminal {
    ptyProcess: pty.IPty | null;
    columns: number;
    rows: number;

    constructor () {
        this.ptyProcess = null;
        this.columns = 0;
        this.rows = 0;
    }

    runPythonTask(scriptPath: string, args: string[] = [], channel: string): Promise<number> {
        return new Promise((resolve, reject) => {
            try {
                this.kill();

                this.ptyProcess = pty.spawn(App.paths.pythonExecutablePath, ["-u", scriptPath, ...args], {
                    name: "xterm-color",
                    cols: this.columns,
                    rows: this.rows,
                    cwd: App.paths.pythonPath,
                    env: process.env
                });

                this.ptyProcess.onData((data) => {
                    App.window.ipcSend(channel, data);
                });

                this.ptyProcess.onExit(({ exitCode }) => {
                    App.window.ipcSend(channel, `\r\n\x1b[33mProcess exited with code ${exitCode} (${Utilities.exitCodeToMessage(exitCode)})\x1b[0m`);
                    this.kill();
                    resolve(exitCode);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    resizeTerminal(columms: number, rows: number) {
        this.columns = columms;
        this.rows = rows;

        this.ptyProcess?.resize(columms, rows);
    }

    kill() {
        if (this.ptyProcess) {
            this.ptyProcess.kill();
            this.ptyProcess = null;
        }
    }

    hasEnded() {
        return this.ptyProcess === null;
    }
}
