import { App } from "../App.js";
import pty from "@homebridge/node-pty-prebuilt-multiarch";

export class Terminal {
    isManualKilling: boolean;
    ptyProcess: pty.IPty | null;
    columns: number;
    rows: number;

    constructor () {
        this.isManualKilling = false;
        this.ptyProcess = null;
        this.columns = 0;
        this.rows = 0;
    }

    runTask(
        command: string,
        args: string[] = [],
        channel: string,
        options?: { cwd?: string; env?: NodeJS.ProcessEnv }
    ): Promise<{ exitCode: number; isManualKilling: boolean; }> {
        return new Promise((resolve, reject) => {
            try {
                this.kill();
                this.isManualKilling = false;

                this.ptyProcess = pty.spawn(command, args, {
                    name: "xterm-color",
                    cols: this.columns,
                    rows: this.rows,
                    cwd: options?.cwd,
                    env: options?.env ?? process.env
                });

                this.ptyProcess.onData((data) => {
                    App.window.ipcSend(channel, data);
                });

                this.ptyProcess.onExit(({ exitCode }) => {
                    let message = "\r\n\x1b[32mProcess exited gracefully\x1b[0m";
                    if (this.isManualKilling)
                        message = "\r\n\x1b[33mProcess stopped by user\x1b[0m";
                    else if (exitCode === undefined)
                        message = "\r\n\x1b[31mProcess exited due to an unknown error\x1b[0m";
                    else if (exitCode !== 0)
                        message = `\r\n\x1b[31mProcess exited with code ${exitCode}\x1b[0m`;

                    App.window.ipcSend(channel, message);

                    this.ptyProcess = null;
                    resolve({ exitCode, isManualKilling: this.isManualKilling });
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    resizeTerminal(columns: number, rows: number) {
        this.columns = columns;
        this.rows = rows;

        this.ptyProcess?.resize(columns, rows);
    }

    kill() {
        if (this.ptyProcess) {
            this.isManualKilling = true;
            this.ptyProcess.kill();
            this.ptyProcess = null;
        }
    }

    hasEnded() {
        return this.ptyProcess === null;
    }
}
