import { app } from 'electron';
import fs from 'fs';
import path from 'path';

function resolveDataRoot(): string {
  const userData = app.getPath('userData');
  const preferred = path.join(userData, 'controlone');
  const preferredDb = path.join(preferred, 'controlone.db');
  if (fs.existsSync(preferredDb)) {
    return preferred;
  }

  const legacyLocal = path.join(userData, 'cleide-pratas');
  const legacyLocalDb = path.join(legacyLocal, 'cleide-pratas.db');
  if (fs.existsSync(legacyLocalDb)) {
    return legacyLocal;
  }

  const legacyAppData = path.join(app.getPath('appData'), 'cleide-pratas', 'cleide-pratas');
  const legacyAppDataDb = path.join(legacyAppData, 'cleide-pratas.db');
  if (fs.existsSync(legacyAppDataDb)) {
    return legacyAppData;
  }

  fs.mkdirSync(preferred, { recursive: true });
  return preferred;
}

export function getAppDataDir(): string {
  const dir = resolveDataRoot();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDatabasePath(): string {
  const dir = getAppDataDir();
  const controloneDb = path.join(dir, 'controlone.db');
  const legacyDb = path.join(dir, 'cleide-pratas.db');
  if (fs.existsSync(controloneDb)) return controloneDb;
  if (fs.existsSync(legacyDb)) return legacyDb;
  return controloneDb;
}

export function getImagesDir(): string {
  const dir = path.join(getAppDataDir(), 'images');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDefaultBackupDir(): string {
  const dir = path.join(getAppDataDir(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Pasta padrão de exportação: Documents/ControlOne/relatorios */
export function getDefaultReportsDir(): string {
  const dir = path.join(app.getPath('documents'), 'ControlOne', 'relatorios');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveImageAbsolutePath(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    return null;
  }
  return path.join(getImagesDir(), path.basename(normalized));
}

/** URL para exibir imagens no renderer (protocolo cleide://). */
export function toAppImageUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  const name = path.basename(relativePath.replace(/\\/g, '/'));
  if (!name || name.includes('..')) return null;
  // Forma sem host (cleide:///arquivo) é a mais estável no Chromium/Electron
  return `cleide:///${encodeURIComponent(name)}`;
}

export function toFileUrl(absolutePath: string | null): string | null {
  if (!absolutePath) return null;
  const normalized = absolutePath.replace(/\\/g, '/');
  if (/^[A-Za-z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}
