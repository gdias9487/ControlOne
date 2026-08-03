import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fingerprintToMachineId, verifyLicenseKey } from '../../shared/license-crypto';
import { getAppDataDir } from '../utils/paths';

export interface LicenseStatusDto {
  valid: boolean;
  machineId: string;
  activatedAt: string | null;
  bypass: boolean;
  message: string;
}

interface LicenseFile {
  key: string;
  machineId: string;
  activatedAt: string;
}

function licenseFilePath(): string {
  return path.join(getAppDataDir(), 'license.json');
}

function primaryMacAddress(): string {
  const nets = os.networkInterfaces();
  const macs: string[] = [];
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.internal) continue;
      if (!entry.mac || entry.mac === '00:00:00:00:00:00') continue;
      macs.push(entry.mac.toUpperCase());
    }
  }
  macs.sort();
  return macs[0] ?? 'NO-MAC';
}

export function getMachineId(): string {
  const fingerprint = [os.hostname(), os.platform(), os.arch(), primaryMacAddress()].join('|');
  return fingerprintToMachineId(fingerprint);
}

function isBypassed(): boolean {
  if (process.env.CONTROLONE_LICENSE_BYPASS === '1') return true;
  // Desenvolvimento local (npm run dev) não exige licença
  if (!app.isPackaged) return true;
  return false;
}

function readLicenseFile(): LicenseFile | null {
  const file = licenseFilePath();
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as LicenseFile;
    if (!raw?.key || !raw?.machineId) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeLicenseFile(data: LicenseFile): void {
  fs.mkdirSync(path.dirname(licenseFilePath()), { recursive: true });
  fs.writeFileSync(licenseFilePath(), JSON.stringify(data, null, 2), 'utf8');
}

export function getLicenseStatus(): LicenseStatusDto {
  const machineId = getMachineId();

  if (isBypassed()) {
    return {
      valid: true,
      machineId,
      activatedAt: null,
      bypass: true,
      message: 'Licença liberada (modo desenvolvimento).',
    };
  }

  const stored = readLicenseFile();
  if (!stored) {
    return {
      valid: false,
      machineId,
      activatedAt: null,
      bypass: false,
      message: 'Nenhuma licença ativada neste computador.',
    };
  }

  if (stored.machineId !== machineId) {
    return {
      valid: false,
      machineId,
      activatedAt: null,
      bypass: false,
      message: 'A licença salva é de outro computador.',
    };
  }

  if (!verifyLicenseKey(stored.key, machineId)) {
    return {
      valid: false,
      machineId,
      activatedAt: null,
      bypass: false,
      message: 'Chave de licença inválida.',
    };
  }

  return {
    valid: true,
    machineId,
    activatedAt: stored.activatedAt,
    bypass: false,
    message: 'Licença ativa.',
  };
}

export function activateLicense(key: string): LicenseStatusDto {
  const machineId = getMachineId();
  const trimmed = String(key || '').trim();
  if (!trimmed) {
    throw new Error('Informe a chave de licença.');
  }
  if (!verifyLicenseKey(trimmed, machineId)) {
    throw new Error(
      'Chave inválida para este computador. Confira o ID da máquina enviado para ativação.',
    );
  }

  const activatedAt = new Date().toISOString();
  writeLicenseFile({ key: trimmed.toUpperCase(), machineId, activatedAt });
  return getLicenseStatus();
}
