import { app, ipcMain, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';
import { _dirname, getOS, loadDatasetDirectory } from './utils.js';

const __dirname = _dirname(import.meta.url);
let mainWindow;

const IS_DEBUG = process.env.NODE_ENV === 'debug';

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      webSecurity: !IS_DEBUG,
      devTools: IS_DEBUG,
    },
  });

  if (IS_DEBUG) mainWindow.loadURL('http://localhost:5173/');
  else mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.on('closed', () => (mainWindow = null));
}

if (!IS_DEBUG) Menu.setApplicationMenu(null);
app.disableHardwareAcceleration();

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', async () => {
  if (!mainWindow) createMainWindow();
});

ipcMain.handle('load_dataset', async () => await loadDatasetDirectory(mainWindow));
ipcMain.handle('get_os_type', getOS);
