import { spawn } from 'node:child_process';
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

    const process = spawn(python, ['-u', filePath]);
    this.attachProcessListeners(process, 'Tagger install error');
    return process;
  }

  startTaggerServer() {
    const python = join(this.taggerPath, 'embedded_python', 'python.exe');
    const filePath = join(this.taggerPath, 'main.py');

    this.taggerProcess = spawn(python, ['-u', filePath]);
    this.attachProcessListeners(this.taggerProcess, 'Tagger error');
  }

  attachProcessListeners(process, errorPrefix) {
    process.stdout.on('data', (data) => {
      const output = this.clearOutputText(data.toString());
      this.mainWindow.webContents.send('tagger-output', output);
    });

    process.stderr.on('data', (data) => {
      const output = this.clearOutputText(data.toString());
      this.mainWindow.webContents.send('tagger-output', output);
    });

    process.on('error', (err) => {
      console.error(`${errorPrefix}: ${err}`);
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
