import { app, ipcMain, BrowserWindow, Menu } from 'electron';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import {
  _dirname,
  getOS,
  importTagGroup,
  loadCSVIntoDatabase,
  loadDatasetDirectory,
  loadTagCompletions,
  loadTagGroups,
  saveTagGroup,
  saveTagGroupFile,
  saveDataset,
  startTaggerServer,
} from './utils.js';

const __dirname = _dirname(import.meta.url);

const dbPath = join(app.getAppPath(), 'Data', 'TagAutocompletions');
if (!existsSync(dbPath)) mkdirSync(dbPath, { recursive: true });
const db = new Database(join(dbPath, 'tags.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL,
    type INTEGER NOT NULL,
    results INTEGER NOT NULL,
    alias TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tag ON tags(tag);
`);

let mainWindow;
let taggerProcess;

const IS_DEBUG = process.env.NODE_ENV === 'debug';

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    backgroundColor: '#1d232a',
    autoHideMenuBar: true,
    title: 'Dataset Editor',
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      webSecurity: !IS_DEBUG,
      devTools: IS_DEBUG,
    },
  });

  mainWindow.maximize();
  if (IS_DEBUG) mainWindow.loadURL('http://localhost:5173/');
  else mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.on('closed', () => (mainWindow = null));
}

if (!IS_DEBUG) Menu.setApplicationMenu(null);
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  loadCSVIntoDatabase(dbPath, db);
  createMainWindow();
  taggerProcess = startTaggerServer(app.getAppPath());
});

app.on('window-all-closed', () => {
  if (taggerProcess) taggerProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', async () => {
  if (!mainWindow) createMainWindow();
});

ipcMain.handle('load_dataset', async () => await loadDatasetDirectory(mainWindow));
ipcMain.handle('get_os_type', getOS);
ipcMain.handle(
  'save_tag_group_file',
  async (_, tagGroups) => await saveTagGroupFile(mainWindow, tagGroups),
);
ipcMain.handle('import_tag_group', async () => await importTagGroup(mainWindow));
ipcMain.handle('save_tag_group', (_, tagGroups) => saveTagGroup(app.getAppPath(), tagGroups));
ipcMain.handle('load_tag_group', () => loadTagGroups(app.getAppPath()));
ipcMain.handle('load_tag_suggestions', (_, query) => loadTagCompletions(db, query));
ipcMain.handle('save_dataset', (_, dataset) => saveDataset(dataset));
