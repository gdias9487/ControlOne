import { app, BrowserWindow, Menu, protocol } from 'electron';
import fs from 'fs';
import path from 'path';
import { disconnectDatabase, initDatabase } from './database/client';
import { registerIpcHandlers } from './ipc/handlers';
import { getSettings } from './services/settings.service';
import { setupAutoUpdater } from './services/updater.service';
import { getImagesDir } from './utils/paths';
import { applyWindowChromeTheme, windowChromeColors } from './utils/window-chrome';

// Remove a barra de menu nativa (Arquivo / Editar / etc.)
Menu.setApplicationMenu(null);
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cleide',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function resolveCleideImagePath(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const candidates = [
    decodeURIComponent(url.pathname || ''),
    decodeURIComponent(url.hostname || ''),
  ];
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/^\/+/, '').trim();
    if (!cleaned || cleaned === 'images' || cleaned === 'local') continue;
    const fileName = path.basename(cleaned);
    if (!fileName || fileName.includes('..')) continue;
    return fileName;
  }
  return null;
}

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../../build/icon.ico');

  let chrome = windowChromeColors('light');
  try {
    const settings = await getSettings();
    chrome = windowChromeColors(settings.theme);
  } catch {
    // Banco ainda não pronto: usa o tema claro até as configurações carregarem.
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: chrome.color,
    title: 'ControlOne',
    icon: iconPath,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 14, y: 14 } }
      : {
          titleBarOverlay: {
            color: chrome.color,
            symbolColor: chrome.symbolColor,
            height: 36,
          },
        }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  // Sem isso o Windows agrupa a janela sob o ícone genérico do Electron
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.controlone.app');
  }

  protocol.handle('cleide', (request) => {
    try {
      const fileName = resolveCleideImagePath(request.url);
      if (!fileName) {
        return new Response('Forbidden', { status: 403 });
      }

      const imagesDir = path.resolve(getImagesDir());
      const filePath = path.resolve(path.join(imagesDir, fileName));
      const allowedPrefix = imagesDir.endsWith(path.sep) ? imagesDir : `${imagesDir}${path.sep}`;
      if (filePath !== imagesDir && !filePath.startsWith(allowedPrefix)) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }

      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = IMAGE_MIME[ext] || 'application/octet-stream';
      return new Response(data, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(data.byteLength),
          'Cache-Control': 'public, max-age=60',
        },
      });
    } catch {
      return new Response('Error', { status: 500 });
    }
  });

  await initDatabase();
  registerIpcHandlers();
  await createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void disconnectDatabase();
});
