import { Utilities } from "../utils/Utilities.js";
import { Terminal } from "../utils/Terminal.js";
import { App } from "../App.js";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "fs-extra";

export class TaggerManager {
    private readonly process: Terminal;
    private systemPython: { python: string, version: string } | null;

    constructor() {
        this.process = new Terminal();
        this.systemPython = null;
    }

    async runInstallProcess() {
        if (this.process && !this.process.hasEnded())
            throw new Error("A process is still running");

        if (process.platform !== "win32")
            await this.ensureLinuxVirtualEnv();

        const requirementsPath = path.join(App.paths.taggerPath, "requirements.txt");
        if (!await fs.pathExists(requirementsPath))
            throw new Error(`Couldn't find the requirements.txt file at ${requirementsPath}`);

        const args = ["-u", "-m", "pip", "install", "--no-warn-script-location", "--disable-pip-version-check", "-r", requirementsPath];
        return this.process.runTask(App.paths.pythonExecutablePath, args, "tagger:output", {
            cwd: App.paths.taggerPath
        });
    }

    async runUninstallProcess() {
        if (this.process && !this.process.hasEnded())
            throw new Error("A process is still running");
        if (process.platform !== "win32" && !await this.hasVirtualEnv())
            throw new Error("There is no virtual environment to uninstall dependencies from");

        if (process.platform !== "win32") {
            return this.process.runTask("rm", ["-rf", App.paths.venvPath], "tagger:output", {
                cwd: App.paths.taggerPath
            });
        }

        const requirementsPath = path.join(App.paths.taggerPath, "requirements.txt");
        if (!await fs.pathExists(requirementsPath))
            throw new Error(`Couldn't find the requirements.txt file at ${requirementsPath}`);

        const args = ["-u", "-m", "pip", "uninstall", "-y", "-r", requirementsPath];
        return this.process.runTask(App.paths.pythonExecutablePath, args, "tagger:output", {
            cwd: App.paths.taggerPath
        });
    }

    runTaggerProcess(port: number) {
        if (this.process && !this.process.hasEnded())
            throw new Error("A process is still running");

        const args = ["-u", App.paths.taggerScriptPath, port.toString()];
        this.process.runTask(App.paths.pythonExecutablePath, args, "tagger:output", { cwd: App.paths.taggerPath })
            .then(({ exitCode, isManualKilling }) => {
                if (!isManualKilling && exitCode !== 0)
                    App.logger.error(`[Tagger Manager] Tagger server stopped with code ${exitCode}`);

                App.window.ipcSend("tagger:service_stopped");
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

    async hasVirtualEnv() {
        if (process.platform === "win32")
            return true;

        return fs.pathExists(App.paths.venvPath);
    }

    private async ensureLinuxVirtualEnv() {
        if (process.platform === "win32" || await this.hasVirtualEnv())
            return;

        const { python, version } = this.resolveLinuxSystemPython();
        App.logger.info(`[Tagger Manager] Using Linux Python interpreter '${python}' (${version})`);

        const result = await this.process.runTask(python, ["-u", "-m", "venv", App.paths.venvPath], "tagger:output");

        if (result.isManualKilling)
            throw new Error("Virtual environment creation was cancelled");

        if (result.exitCode !== 0) {
            await fs.remove(App.paths.venvPath);
            throw new Error(`Virtual environment creation failed with exit code ${result.exitCode}. Do you have the venv module installed?`);
        }
    }

    private resolveLinuxSystemPython() {
        if (this.systemPython)
            return this.systemPython;

        const candidates = ["python3.10", "python3.11", "python3.12", "python3.13", "python3.14", "python3", "python"];
        const foundButUnsupported: string[] = [];

        for (const candidate of candidates) {
            const version = this.getPythonVersion(candidate);
            if (!version)
                continue;

            if (this.isSupportedPythonVersion(version)) {
                this.systemPython = { python: candidate, version };
                return this.systemPython;
            }

            foundButUnsupported.push(`${candidate} (${version})`);
        }

        if (foundButUnsupported.length > 0)
            throw new Error(`Found unsupported Python version(s): ${foundButUnsupported.join(", ")}. Install Python 3.10.x, 3.11.x, 3.12.x, 3.13.x or 3.14.x.`);

        throw new Error("Python 3.10.x, 3.11.x, 3.12.x, 3.13.x or 3.14.x was not found on the system. Install Python and ensure it is available in PATH.");
    }

    private getPythonVersion(candidate: string) {
        const result = spawnSync(candidate, ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"], { encoding: "utf-8" });

        if (result.status !== 0)
            return null;

        const version = result.stdout.trim();
        return version || null;
    }

    private isSupportedPythonVersion(version: string) {
        const parts = version.split(".").map(Number);
        if (parts.length !== 2 || parts.some(Number.isNaN))
            return false;

        const [major, minor] = parts;
        return major === 3 && minor >= 10 && minor <= 14;
    }
}
