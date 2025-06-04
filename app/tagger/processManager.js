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

  startTaggerService(port) {
    try {
      if (this.installProcess) return true;

      this.installProcess = this.createInstallProcess();
      this.installProcess.on('close', () => {
        this.cleanupInstallProcess();
        this.startTaggerServer(port);
      });

      return true;
    } catch (error) {
      const message = `Error starting tagger server: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      this.mainWindow?.webContents.send('app-log', { type: 'error', message });
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

  startTaggerServer(port) {
    const python = join(this.taggerPath, 'embedded_python', 'python.exe');
    const filePath = join(this.taggerPath, 'main.py');

    const args = ['-u', filePath];
    if (port) args.push(port.toString());
    this.taggerProcess = spawn(python, args);
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
      const message = `${errorPrefix}: ${err.message ?? err}`;
      this.mainWindow.webContents.send('app-log', { type: 'error', message });
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
