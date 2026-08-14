import { app } from 'electron';
import { execFileSync } from 'child_process';
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

const MACHINE_ID_PATTERN = /^[A-F0-9]{4}(-[A-F0-9]{4}){3}$/;

function licenseFilePath(): string {
  return path.join(getAppDataDir(), 'license.json');
}

/** Uma vez definido, o ID desta instalação nunca muda. */
function machineIdFilePath(): string {
  return path.join(getAppDataDir(), 'machine-id.json');
}

/** GUID de instalação do Windows: não muda com VPN, Wi-Fi ou troca de adaptador. */
function windowsMachineGuid(): string | null {
  if (process.platform !== 'win32') return null;
  const systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const regExe = path.join(systemRoot, 'System32', 'reg.exe');
  try {
    const out = execFileSync(
      regExe,
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    );
    const match = out.match(/MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]+)/i);
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

/** MACs candidatos, priorizando adaptadores físicos sobre virtuais/VPN. */
function macAddresses(): string[] {
  const ignored =
    /(virtual|vpn|hyper-v|vmware|vbox|loopback|bluetooth|teredo|isatap|nordlynx|tap-windows|wintun|wireguard|docker|vethernet)/i;
  const physical: string[] = [];
  const others: string[] = [];

  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal) continue;
      if (!entry.mac || entry.mac === '00:00:00:00:00:00') continue;
      const mac = entry.mac.toUpperCase();
      (ignored.test(name) ? others : physical).push(mac);
    }
  }

  physical.sort();
  others.sort();
  return [...new Set([...physical, ...others])];
}

function guidFingerprint(guid: string): string {
  return ['win', os.hostname(), os.arch(), guid].join('|');
}

function macFingerprint(mac: string): string {
  return [os.hostname(), os.platform(), os.arch(), mac].join('|');
}

/**
 * Todos os IDs que este computador já pôde apresentar, incluindo o formato antigo
 * baseado em MAC. Usado só para revalidar chaves emitidas antes — nunca para
 * decidir qual ID mostrar na tela.
 */
function candidateMachineIds(): string[] {
  const fingerprints: string[] = [];

  const guid = windowsMachineGuid();
  if (guid) fingerprints.push(guidFingerprint(guid));

  const macs = macAddresses();
  for (const mac of macs) fingerprints.push(macFingerprint(mac));
  if (macs.length === 0) fingerprints.push(macFingerprint('NO-MAC'));

  return [...new Set(fingerprints.map(fingerprintToMachineId))];
}

function readStoredMachineId(): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(machineIdFilePath(), 'utf8')) as {
      machineId?: string;
    };
    const id = raw?.machineId?.toUpperCase();
    return id && MACHINE_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

function writeStoredMachineId(machineId: string): void {
  try {
    fs.mkdirSync(path.dirname(machineIdFilePath()), { recursive: true });
    fs.writeFileSync(
      machineIdFilePath(),
      JSON.stringify({ machineId, createdAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
  } catch {
    // Sem permissão de escrita: segue com o ID calculado na hora
  }
}

/**
 * ID estável desta instalação. É calculado uma única vez e persistido, então
 * VPN, troca de rede ou falha ao ler o registro não alteram o valor.
 */
export function getMachineId(): string {
  const stored = readStoredMachineId();
  if (stored) return stored;

  const guid = windowsMachineGuid();
  const macs = macAddresses();
  const fingerprint = guid
    ? guidFingerprint(guid)
    : macFingerprint(macs[0] ?? 'NO-MAC');

  const machineId = fingerprintToMachineId(fingerprint);
  writeStoredMachineId(machineId);
  return machineId;
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

/** Procura um ID (atual, salvo ou legado) para o qual a chave seja válida. */
function findMatchingMachineId(key: string, currentId: string, storedId?: string): string | null {
  const ids = [currentId, ...(storedId ? [storedId] : []), ...candidateMachineIds()];
  for (const id of [...new Set(ids)]) {
    if (verifyLicenseKey(key, id)) return id;
  }
  return null;
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

  const matchedId = findMatchingMachineId(stored.key, machineId, stored.machineId);

  if (!matchedId) {
    // A licença nunca é apagada: se o ID voltar a bater, volta a valer sozinha
    return {
      valid: false,
      machineId,
      activatedAt: null,
      bypass: false,
      message: 'A licença salva não corresponde a este computador. Solicite uma nova chave.',
    };
  }

  // Congela o ID que a chave reconhece, evitando novas divergências
  if (matchedId !== machineId) {
    writeStoredMachineId(matchedId);
  }
  if (matchedId !== stored.machineId) {
    writeLicenseFile({ ...stored, machineId: matchedId });
  }

  return {
    valid: true,
    machineId: matchedId,
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

  const matchedId = findMatchingMachineId(trimmed, machineId);
  if (!matchedId) {
    throw new Error(
      'Chave inválida para este computador. Confira o ID da máquina enviado para ativação.',
    );
  }

  writeStoredMachineId(matchedId);
  writeLicenseFile({
    key: trimmed.toUpperCase(),
    machineId: matchedId,
    activatedAt: new Date().toISOString(),
  });
  return getLicenseStatus();
}
