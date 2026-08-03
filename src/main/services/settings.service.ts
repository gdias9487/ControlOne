import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import type { SettingsUpdateInput } from '../../shared/schemas';
import type { BackupResult, SettingsDto } from '../../shared/types';
import { getPrisma, disconnectDatabase, initDatabase } from '../database/client';
import {
  getDatabasePath,
  getDefaultBackupDir,
  toAppImageUrl,
} from '../utils/paths';
import { selectAndStoreImage } from './image.service';

function mapSettings(settings: {
  id: string;
  storeName: string;
  businessType: string | null;
  storePhone: string | null;
  storeEmail: string | null;
  storeAddress: string | null;
  logoPath: string | null;
  defaultMinStock: number;
  backupFolder: string | null;
  theme: string;
  onboardingCompleted: boolean;
  updatedAt: Date;
}): SettingsDto {
  return {
    id: settings.id,
    storeName: settings.storeName,
    businessType: settings.businessType,
    storePhone: settings.storePhone,
    storeEmail: settings.storeEmail,
    storeAddress: settings.storeAddress,
    logoPath: settings.logoPath,
    logoUrl: toAppImageUrl(settings.logoPath),
    defaultMinStock: settings.defaultMinStock,
    backupFolder: settings.backupFolder,
    theme: settings.theme === 'dark' ? 'dark' : 'light',
    onboardingCompleted: Boolean(settings.onboardingCompleted),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function getSettings(): Promise<SettingsDto> {
  const prisma = getPrisma();
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (!settings) throw new Error('Configurações não encontradas.');
  return mapSettings(settings);
}

export async function updateSettings(input: SettingsUpdateInput): Promise<SettingsDto> {
  const prisma = getPrisma();
  const settings = await prisma.settings.update({
    where: { id: 'default' },
    data: {
      storeName: input.storeName,
      businessType:
        input.businessType === undefined ? undefined : input.businessType || null,
      storePhone: input.storePhone === undefined ? undefined : input.storePhone || null,
      storeEmail: input.storeEmail === undefined ? undefined : input.storeEmail || null,
      storeAddress: input.storeAddress === undefined ? undefined : input.storeAddress || null,
      logoPath: input.logoPath === undefined ? undefined : input.logoPath,
      defaultMinStock: input.defaultMinStock,
      backupFolder: input.backupFolder === undefined ? undefined : input.backupFolder,
      theme: input.theme,
      onboardingCompleted: input.onboardingCompleted,
    },
  });
  return mapSettings(settings);
}

export async function selectLogo(): Promise<{ relativePath: string; absolutePath: string } | null> {
  return selectAndStoreImage('logo');
}

function formatBackupName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.db`;
}

export async function createBackup(customFolder?: string | null): Promise<BackupResult> {
  const settings = await getSettings();
  const folder = customFolder || settings.backupFolder || getDefaultBackupDir();
  fs.mkdirSync(folder, { recursive: true });

  const source = getDatabasePath();
  if (!fs.existsSync(source)) {
    throw new Error('Arquivo de banco de dados não encontrado.');
  }

  const destination = path.join(folder, formatBackupName());
  fs.copyFileSync(source, destination);

  return {
    path: destination,
    createdAt: new Date().toISOString(),
  };
}

export async function selectBackupFolder(): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Selecionar pasta de backup',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return { path: result.filePaths[0] };
}

export async function restoreBackup(): Promise<BackupResult> {
  const selected = await dialog.showOpenDialog({
    title: 'Restaurar backup',
    filters: [{ name: 'Banco SQLite', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (selected.canceled || selected.filePaths.length === 0) {
    throw new Error('Restauração cancelada.');
  }

  const backupFile = selected.filePaths[0];
  const safety = await createBackup();

  await disconnectDatabase();
  fs.copyFileSync(backupFile, getDatabasePath());
  await initDatabase();

  return safety;
}
