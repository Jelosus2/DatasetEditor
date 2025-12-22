import { App } from "../App.js";
import pty from "@homebridge/node-pty-prebuilt-multiarch";

export class Terminal {
    ptyProcess: pty.IPty | null;

    constructor () {
        this.ptyProcess = null;
    }

    runPythonTask(scriptPath: string, args: string[] = [], channel: string): Promise<number> {
        return new Promise((resolve, reject) => {
            try {
                this.kill();

                this.ptyProcess = pty.spawn("python.exe", ["-u", scriptPath, ...args], {
                    name: "xterm-color",
                    cols: 80,
                    rows: 30,
                    cwd: App.paths.pythonPath,
                    env: process.env
                });

                this.ptyProcess.onData((data) => {
                    App.window.ipcSend(channel, data);
                });

                this.ptyProcess.onExit(({ exitCode }) => {
                    App.window.ipcSend(channel, `\r\n\x1b[33mProcess exited with code ${exitCode}\x1b[0m`);
                    this.kill();
                    resolve(exitCode);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    resizeTerminal(columms: number, rows: number) {
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
