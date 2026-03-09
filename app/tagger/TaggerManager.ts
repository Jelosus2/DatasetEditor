import { Utilities } from "../utils/Utilities.js";
import { Terminal } from "../utils/Terminal.js";
import { App } from "../App.js";

export class TaggerManager {
    process: Terminal;

    constructor() {
        this.process = new Terminal();
    }

    async runInstallProcess() {
        if (this.process && !this.process.hasEnded())
            throw new Error("A process is still running");

        const args = ["pip", "install", "--no-warn-script-location", "--disable-pip-version-check", "-r", "requirements.txt"]
        return this.process.runPythonTask("-m", args, "tagger:output");
    }

    runTaggerProcess(port: number) {
        if (this.process && !this.process.hasEnded())
            throw new Error("A process is still running");

        this.process.runPythonTask(App.paths.taggerScriptPath, [port.toString()], "tagger:output")
            .then(({ exitCode, isManualKilling }) => {
                if (!isManualKilling && exitCode !== 0)
                    App.logger.error(`[Tagger Manager] Tagger server stopped with code ${exitCode}`)

                App.window.ipcSend("tagger:service_stopped")
            })
            .catch((error) => {
                console.error(error);
                App.logger.error(`[Tagger Manager] Error in tagger server: ${Utilities.getErrorMessage(error)}`);
            });
    }

    cleanup() {
        this.process.kill();
    }

    resizeTerminal(columns: number, rows: number) {
        this.process?.resizeTerminal(columns, rows);
    }
}
