import { app, ipcMain, BrowserWindow, Menu, dialog } from 'electron';
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
  getTaggerDevice,
  autoTagImages,
  saveSettings,
  loadSettings,
  changeAutocompleteFile,
  compareDatasetChanges,
  updateOriginalDatasetHash,
  compareTagGroupChanges,
} from './utils.js';
import { setPaths } from './paths.js';

const __dirname = _dirname(import.meta.url);
const DEBUG_FLAG = process.argv.includes('--debug-mode');
const IS_DEBUG = !app.isPackaged;
const paths = setPaths(IS_DEBUG);

if (!existsSync(paths.tagAutocompletionsPath))
  mkdirSync(paths.tagAutocompletionsPath, { recursive: true });

const db = new Database(join(paths.tagAutocompletionsPath, 'tags.db'));
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
      devTools: IS_DEBUG || DEBUG_FLAG,
    },
  });

  mainWindow.maximize();
  if (IS_DEBUG) mainWindow.loadURL('http://localhost:5173/');
  else mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.on('closed', () => (mainWindow = null));
  mainWindow.on('close', (e) => {
    e.preventDefault();

    mainWindow.webContents.send('are_changes_saved');
    ipcMain.once('changes_saved', async (_, allSaved) => {
      if (allSaved) mainWindow.destroy();
      else {
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Yes', 'No', 'Cancel'],
          title: 'Confirm',
          message: 'You are about to quit, save all changes?',
        });

        if (result.response === 0) {
          mainWindow.webContents.send('save_all_changes');

          ipcMain.once('save_all_done', () => mainWindow.destroy());
        } else if (result.response === 1) {
          mainWindow.destroy();
        }
      }
    });
  });
}

if (!IS_DEBUG && !DEBUG_FLAG) Menu.setApplicationMenu(null);
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  loadCSVIntoDatabase(paths.tagAutocompletionsPath, db);
  createMainWindow();
  saveSettings(paths.dataPath, paths.tagAutocompletionsPath, null);
});

app.on('window-all-closed', () => {
  if (taggerProcess) taggerProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', async () => {
  if (!mainWindow) createMainWindow();
});

ipcMain.handle(
  'load_dataset',
  async (_, isAllSaved, directory) => await loadDatasetDirectory(mainWindow, isAllSaved, directory),
);
ipcMain.handle('get_os_type', getOS);
ipcMain.handle(
  'save_tag_group_file',
  async (_, tagGroups) => await saveTagGroupFile(mainWindow, tagGroups),
);
ipcMain.handle('import_tag_group', async () => await importTagGroup(mainWindow));
ipcMain.handle('save_tag_group', (_, tagGroups) => saveTagGroup(paths.tagGroupsPath, tagGroups));
ipcMain.handle('load_tag_group', () => loadTagGroups(paths.tagGroupsPath));
ipcMain.handle('load_tag_suggestions', (_, query) => loadTagCompletions(db, query));
ipcMain.handle('save_dataset', (_, dataset) => saveDataset(dataset));
ipcMain.handle('get_tagger_device', async () => await getTaggerDevice());
ipcMain.handle('tag_images', async (_, props) => await autoTagImages(props));
ipcMain.handle('save_settings', (_, settings) =>
  saveSettings(paths.dataPath, paths.tagAutocompletionsPath, settings),
);
ipcMain.handle('load_settings', () => loadSettings(paths.dataPath));
ipcMain.handle('change_autotag_file', async () => await changeAutocompleteFile(mainWindow, db));
ipcMain.handle('compare_dataset_changes', (_, images) => compareDatasetChanges(images));
ipcMain.handle('update_dataset_status', (_, images) => updateOriginalDatasetHash(images));
ipcMain.handle('compare_tag_group_changes', (_, tagGroups) => compareTagGroupChanges(tagGroups));
ipcMain.handle('start_tagger_service', async () => {
  try {
    if (taggerProcess) taggerProcess.kill();
    taggerProcess = await startTaggerServer(paths.taggerPath, mainWindow);
    return true;
  } catch (err) {
    console.error('Error starting tagger server: ', err);
    return false;
  }
});
ipcMain.handle('stop_tagger_service', () => {
  if (taggerProcess) {
    taggerProcess.kill();
    taggerProcess = null;
  }
});
