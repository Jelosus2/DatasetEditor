import { app, nativeTheme, Menu } from 'electron';
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

async function onAppReady() {
  try {
    await tagDatabase.loadCSVIntoDatabase(settingsManager);

    const mainWindow = await windowManager.createMainWindow();
    taggerProcessManager = new TaggerProcessManager(paths.taggerPath, mainWindow);

    ipcHandlers = new IpcHandlers({
      datasetManager,
      tagDatabase,
      tagGroupManager,
      settingsManager,
      taggerApiClient,
      taggerProcessManager,
      windowManager
    });

    ipcHandlers.registerHandlers();
    settingsManager.initializeDefaultSettings(nativeTheme.shouldUseDarkColors);
  } catch (error) {
    console.error('Error during app initialization:', error);
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
