import { spawn } from 'node-pty';
import { join } from 'node:path';
import stripAnsi from 'strip-ansi';

export class TaggerProcessManager {
  constructor(taggerPath, mainWindow) {
    this.taggerPath = taggerPath;
    this.mainWindow = mainWindow;
    this.installProcess = null;
    this.taggerProcess = null;
  }

  startTaggerService() {
    try {
      if (this.installProcess) return true;

      this.installProcess = this.createInstallProcess();
      this.installProcess.on('close', () => {
        this.cleanupInstallProcess();
        this.startTaggerServer();
      });

      return true;
    } catch (error) {
      console.error('Error starting tagger server:', error);
      return false;
    }
  }

  stopTaggerService() {
    if (this.taggerProcess) {
      this.taggerProcess.kill();
      this.taggerProcess = null;
    }
  }

  createInstallProcess() {
    const python = join(this.taggerPath, 'embedded_python', 'python.exe');
    const filePath = join(this.taggerPath, 'install.py');

    const ptyProcess = spawn(python, ['-u', filePath], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: this.taggerPath,
      env: process.env
    });
    this.attachProcessListeners(ptyProcess, 'Tagger install error');
    return ptyProcess;
  }

  startTaggerServer() {
    const python = join(this.taggerPath, 'embedded_python', 'python.exe');
    const filePath = join(this.taggerPath, 'main.py');

    this.taggerProcess = spawn(python, ['-u', filePath], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: this.taggerPath,
      env: process.env
    });
    this.attachProcessListeners(this.taggerProcess, 'Tagger error');
  }

  attachProcessListeners(process, errorPrefix) {
    process.onData((data) => {
      const output = this.clearOutputText(data.toString());
      this.mainWindow.webContents.send('tagger-output', output);
    });

    process.onExit(({ exitCode }) => {
      if (exitCode !== 0) {
        console.error(`${errorPrefix}: exited with code ${exitCode}`);
      }
    });
  }

  clearOutputText(str) {
    if (str.endsWith('\n')) str = str.slice(0, -1);
    return stripAnsi(str.replaceAll('\x00', '').trim());
  }

  cleanupInstallProcess() {
    if (this.installProcess) {
      this.installProcess.kill();
      this.installProcess = null;
    }
  }

  cleanup() {
    this.cleanupInstallProcess();
    this.stopTaggerService();
  }
}
