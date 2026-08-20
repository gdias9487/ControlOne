import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

export type UpdaterStatusState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterStatusDto {
  state: UpdaterStatusState;
  currentVersion: string;
  availableVersion: string | null;
  percent: number | null;
  message: string | null;
  canCheck: boolean;
}

let latestStatus: UpdaterStatusDto = {
  state: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: null,
  message: null,
  canCheck: false,
};

let configured = false;

function broadcast(status: UpdaterStatusDto): void {
  latestStatus = status;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('updater:status', status);
    }
  }
}

function baseStatus(patch: Partial<UpdaterStatusDto>): UpdaterStatusDto {
  return {
    ...latestStatus,
    currentVersion: app.getVersion(),
    canCheck: app.isPackaged,
    ...patch,
  };
}

export function getUpdaterStatus(): UpdaterStatusDto {
  return {
    ...latestStatus,
    currentVersion: app.getVersion(),
    canCheck: app.isPackaged,
  };
}

export function setupAutoUpdater(): void {
  if (configured) return;
  configured = true;

  if (!app.isPackaged) {
    broadcast(
      baseStatus({
        state: 'idle',
        message: 'Atualizações só são verificadas na versão instalada.',
        canCheck: false,
      }),
    );
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    broadcast(
      baseStatus({
        state: 'checking',
        message: 'Verificando atualizações...',
        percent: null,
      }),
    );
  });

  autoUpdater.on('update-available', (info) => {
    broadcast(
      baseStatus({
        state: 'available',
        availableVersion: info.version,
        message: `Nova versão ${info.version} disponível.`,
        percent: null,
      }),
    );
  });

  autoUpdater.on('update-not-available', () => {
    broadcast(
      baseStatus({
        state: 'not-available',
        availableVersion: null,
        message: 'Você já está na versão mais recente.',
        percent: null,
      }),
    );
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcast(
      baseStatus({
        state: 'downloading',
        percent: Math.round(progress.percent),
        message: `Baixando atualização... ${Math.round(progress.percent)}%`,
      }),
    );
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcast(
      baseStatus({
        state: 'downloaded',
        availableVersion: info.version,
        percent: 100,
        message: `Versão ${info.version} pronta. Reinicie para instalar.`,
      }),
    );
  });

  autoUpdater.on('error', (err) => {
    broadcast(
      baseStatus({
        state: 'error',
        message: err?.message || 'Falha ao verificar atualizações.',
        percent: null,
      }),
    );
  });

  // Checagem silenciosa ao abrir (não mostra erro agressivo se offline)
  void checkForUpdates().catch(() => {
    // erro já tratado no evento "error"
  });
}

export async function checkForUpdates(): Promise<UpdaterStatusDto> {
  if (!app.isPackaged) {
    const status = baseStatus({
      state: 'idle',
      message: 'Atualizações só são verificadas na versão instalada.',
      canCheck: false,
    });
    broadcast(status);
    return status;
  }

  broadcast(
    baseStatus({
      state: 'checking',
      message: 'Verificando atualizações...',
      percent: null,
    }),
  );

  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao verificar atualizações.';
    broadcast(baseStatus({ state: 'error', message, percent: null }));
  }

  return getUpdaterStatus();
}

export async function downloadUpdate(): Promise<UpdaterStatusDto> {
  if (!app.isPackaged) {
    throw new Error('Download de atualização disponível apenas na versão instalada.');
  }
  if (latestStatus.state !== 'available' && latestStatus.state !== 'error') {
    // permite retentar após erro se já havia versão conhecida
    if (latestStatus.state !== 'downloading') {
      await checkForUpdates();
    }
  }

  broadcast(
    baseStatus({
      state: 'downloading',
      percent: 0,
      message: 'Iniciando download...',
    }),
  );

  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao baixar atualização.';
    broadcast(baseStatus({ state: 'error', message, percent: null }));
    throw new Error(message);
  }

  return getUpdaterStatus();
}

export function installUpdate(): UpdaterStatusDto {
  if (!app.isPackaged) {
    throw new Error('Instalação de atualização disponível apenas na versão instalada.');
  }
  if (latestStatus.state !== 'downloaded') {
    throw new Error('Nenhuma atualização baixada para instalar.');
  }
  // isSilent=false, isForceRunAfter=true
  autoUpdater.quitAndInstall(false, true);
  return getUpdaterStatus();
}
