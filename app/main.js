import { app, ipcMain, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';
import { _dirname, loadDatasetDirectory } from './utils.js';

const __dirname = _dirname(import.meta.url);
let mainWindow;

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      webSecurity: !(process.env.NODE_ENV === 'debug'),
      devTools: process.env.NODE_ENV === 'debug',
    },
  });

  if (process.env.NODE_ENV === 'debug') mainWindow.loadURL('http://localhost:5173/');
  else mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.on('closed', () => (mainWindow = null));
}

Menu.setApplicationMenu(null);
app.disableHardwareAcceleration();

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', async () => {
  if (!mainWindow) createMainWindow();
});

ipcMain.handle('load_dataset', async () => await loadDatasetDirectory(mainWindow));
