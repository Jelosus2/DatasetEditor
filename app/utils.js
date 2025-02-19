import { BrowserWindow, dialog } from 'electron';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, basename, join } from 'node:path';

export const _dirname = (url) => dirname(fileURLToPath(url));

export function openDevTools() {
  if (process.env.NODE_ENV === 'debug') {
    const window = BrowserWindow.getFocusedWindow();

    if (window && !window.webContents.isDevToolsOpened()) window.webContents.openDevTools();
    else if (window) window.webContents.closeDevTools();
  }
}

export async function loadDatasetDirectory(mainWindow) {
  let directoryPath;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select the dataset directory',
    buttonLabel: 'Load Dataset',
    properties: ['openDirectory'],
  });

  if (result.canceled) return null;

  directoryPath = result.filePaths[0];

  const images = new Map();
  const globalTags = new Map();

  const files = readdirSync(directoryPath);

  for (const file of files) {
    const ext = extname(file);
    const fileName = basename(file);

    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const txtPath = join(directoryPath, `${fileName}.txt`);

      if (existsSync(txtPath)) {
        const tags = new Set(
          readFileSync(txtPath, 'utf-8')
            .split(', ')
            .map((t) => t.trim().replace('_', ' ')),
        );
      }
    }
  }
  //return null;
}
