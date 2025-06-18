import { app, nativeTheme, Menu, session } from 'electron';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

import { setPaths } from './paths.js';
import { TagDatabase } from './database/tagDatabase.js';
import { DatasetManager } from './dataset/datasetManager.js';
import { TaggerProcessManager } from './tagger/processManager.js';
import { TagGroupManager } from './tagGroups/tagGroupManager.js';
import { SettingsManager } from './settings/settingsManager.js';
import { TaggerApiClient } from './tagger/apiClient.js';
import { WindowManager } from './window/windowManager.js';
import { IpcHandlers } from './ipc/handlers.js';
import { UpdateManager } from './updater/updateManager.js';

const DEBUG_FLAG = process.argv.includes('--debug-mode');
const IS_DEBUG = !app.isPackaged;
const paths = setPaths(IS_DEBUG);

let tagDatabase;
let datasetManager;
let tagGroupManager;
let settingsManager;
let taggerApiClient;
let windowManager;
let taggerProcessManager;
let ipcHandlers;
let updateManager;

function initializeDatabase() {
  if (!existsSync(paths.tagAutocompletionsPath)) {
    mkdirSync(paths.tagAutocompletionsPath, { recursive: true });
  }

  const db = new Database(join(paths.tagAutocompletionsPath, 'tags.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      type INTEGER NOT NULL,
      results INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tag ON tags(tag);
  `);

  tagDatabase = new TagDatabase(db);
}

function initializeManagers() {
  datasetManager = new DatasetManager();
  tagGroupManager = new TagGroupManager(paths.tagGroupsPath);
  settingsManager = new SettingsManager(paths.dataPath, paths.tagAutocompletionsPath);
  taggerApiClient = new TaggerApiClient();
  windowManager = new WindowManager(IS_DEBUG, DEBUG_FLAG);
}

function setupApp() {
  if (!IS_DEBUG && !DEBUG_FLAG) {
    Menu.setApplicationMenu(null);
  }

  app.disableHardwareAcceleration();

  app.whenReady().then(onAppReady);
  app.on('window-all-closed', onWindowAllClosed);
  app.on('activate', onActivate);
}

function setupDanbooruRefererHeader() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const { hostname } = new URL(details.url);
    if (hostname.endsWith('donmai.us')) {
      details.requestHeaders['Referer'] = 'https://danbooru.donmai.us/';
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

async function onAppReady() {
  try {
    await tagDatabase.loadCSVIntoDatabase(settingsManager, windowManager.getMainWindow());

    const mainWindow = await windowManager.createMainWindow();
    setupDanbooruRefererHeader();
    taggerApiClient.mainWindow = mainWindow;
    taggerProcessManager = new TaggerProcessManager(paths.taggerPath, mainWindow);
    updateManager = new UpdateManager(mainWindow);

    ipcHandlers = new IpcHandlers({
      datasetManager,
      tagDatabase,
      tagGroupManager,
      settingsManager,
      taggerApiClient,
      taggerProcessManager,
      windowManager,
      updateManager,
    });

    ipcHandlers.registerHandlers();
    settingsManager.initializeDefaultSettings(
      nativeTheme.shouldUseDarkColors,
      windowManager.getMainWindow()
    );

    const settings = settingsManager.loadSettings(mainWindow);
    if (settings?.autoCheckUpdates && updateManager.areUpdatesAvailable()) {
      updateManager.checkForUpdates();
    }
  } catch (error) {
    const message = `Error during app initialization: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
    windowManager.getMainWindow()?.webContents.send('app-log', { type: 'error', message });
    console.error(error);
  }
}

function onWindowAllClosed() {
  taggerProcessManager?.cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

async function onActivate() {
  if (!windowManager.hasMainWindow()) {
    await windowManager.createMainWindow();
  }
}

initializeDatabase();
initializeManagers();
setupApp();
