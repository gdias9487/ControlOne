import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { IPC_CHANNELS } from '../../shared/constants';
import type {
  AccessDisableInput,
  AccessLoginInput,
  AccessRole,
  AccessSetupInput,
  AccessUpdateInput,
} from '../../shared/schemas';
import type { AccessStatusDto } from '../../shared/types';
import { getPrisma } from '../database/client';

const PUBLIC_CHANNELS = new Set<string>([
  IPC_CHANNELS.ACCESS_STATUS,
  IPC_CHANNELS.ACCESS_LOGIN,
  IPC_CHANNELS.ACCESS_LOGOUT,
  IPC_CHANNELS.ACCESS_SETUP,
  IPC_CHANNELS.ACCESS_UPDATE,
  IPC_CHANNELS.ACCESS_DISABLE,
  IPC_CHANNELS.LICENSE_STATUS,
  IPC_CHANNELS.LICENSE_ACTIVATE,
  IPC_CHANNELS.SETTINGS_GET,
  IPC_CHANNELS.APP_GET_IMAGE_URL,
  IPC_CHANNELS.APP_GET_PATH,
  IPC_CHANNELS.UPDATER_GET_STATUS,
  IPC_CHANNELS.UPDATER_CHECK,
  IPC_CHANNELS.UPDATER_DOWNLOAD,
  IPC_CHANNELS.UPDATER_INSTALL,
]);

const CASHIER_CHANNELS = new Set<string>([
  ...PUBLIC_CHANNELS,
  IPC_CHANNELS.CUSTOMERS_LIST,
  IPC_CHANNELS.CUSTOMERS_GET,
  IPC_CHANNELS.CUSTOMERS_CREATE,
  IPC_CHANNELS.PRODUCTS_LIST,
  IPC_CHANNELS.PRODUCTS_GET,
  IPC_CHANNELS.SALES_CREATE,
  IPC_CHANNELS.SALES_GET,
]);

const OWNER_ONLY_ACCESS = new Set<string>([
  IPC_CHANNELS.ACCESS_UPDATE,
  IPC_CHANNELS.ACCESS_DISABLE,
]);

let sessionRole: AccessRole | null = null;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== next.length) return false;
  return timingSafeEqual(expected, next);
}

async function readHashes(): Promise<{
  ownerPasswordHash: string | null;
  cashierPasswordHash: string | null;
}> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ ownerPasswordHash: string | null; cashierPasswordHash: string | null }>
  >(
    `SELECT "ownerPasswordHash", "cashierPasswordHash" FROM "Settings" WHERE "id" = 'default'`,
  );
  return rows[0] ?? { ownerPasswordHash: null, cashierPasswordHash: null };
}

async function writeHashes(input: {
  ownerPasswordHash?: string | null;
  cashierPasswordHash?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const current = await readHashes();
  const owner =
    input.ownerPasswordHash === undefined ? current.ownerPasswordHash : input.ownerPasswordHash;
  const cashier =
    input.cashierPasswordHash === undefined
      ? current.cashierPasswordHash
      : input.cashierPasswordHash;
  await prisma.$executeRawUnsafe(
    `UPDATE "Settings" SET "ownerPasswordHash" = ?, "cashierPasswordHash" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'default'`,
    owner,
    cashier,
  );
}

function isEnabled(hashes: { ownerPasswordHash: string | null }): boolean {
  return Boolean(hashes.ownerPasswordHash);
}

export async function getAccessStatus(): Promise<AccessStatusDto> {
  const hashes = await readHashes();
  const enabled = isEnabled(hashes);
  return {
    enabled,
    hasCashierPassword: Boolean(hashes.cashierPasswordHash),
    role: enabled ? sessionRole : 'owner',
  };
}

export async function assertIpcAccessAsync(channel: string): Promise<void> {
  const hashes = await readHashes();
  const enabled = isEnabled(hashes);

  if (channel === IPC_CHANNELS.ACCESS_SETUP) {
    if (enabled && sessionRole === 'cashier') {
      throw new Error('Apenas o dono pode configurar o acesso.');
    }
    return;
  }

  if (OWNER_ONLY_ACCESS.has(channel)) {
    if (enabled && sessionRole !== 'owner') {
      throw new Error('Apenas o dono pode alterar o acesso.');
    }
    if (enabled && sessionRole === null) {
      throw new Error('Entre como dono para alterar o acesso.');
    }
    return;
  }

  if (PUBLIC_CHANNELS.has(channel)) return;

  if (!enabled) return;

  if (!sessionRole) {
    throw new Error('Entre com a senha para continuar.');
  }

  if (sessionRole === 'owner') return;

  if (!CASHIER_CHANNELS.has(channel)) {
    throw new Error('O caixa não tem permissão para esta ação.');
  }
}

export async function login(input: AccessLoginInput): Promise<AccessStatusDto> {
  const hashes = await readHashes();
  if (!isEnabled(hashes)) {
    throw new Error('O acesso por senha ainda não foi ativado.');
  }

  const stored =
    input.role === 'owner' ? hashes.ownerPasswordHash : hashes.cashierPasswordHash;
  if (input.role === 'cashier' && !stored) {
    throw new Error('A senha do caixa ainda não foi definida.');
  }
  if (!verifyPassword(input.password, stored)) {
    throw new Error('Senha incorreta.');
  }

  sessionRole = input.role;
  return getAccessStatus();
}

export async function logout(): Promise<AccessStatusDto> {
  const hashes = await readHashes();
  sessionRole = isEnabled(hashes) ? null : 'owner';
  return getAccessStatus();
}

export async function setupAccess(input: AccessSetupInput): Promise<AccessStatusDto> {
  const hashes = await readHashes();
  if (isEnabled(hashes)) {
    throw new Error('O acesso já está ativo. Use a alteração de senha.');
  }
  const cashierPassword = input.cashierPassword?.trim() || '';
  if (cashierPassword && input.ownerPassword === cashierPassword) {
    throw new Error('Use senhas diferentes para dono e caixa.');
  }
  await writeHashes({
    ownerPasswordHash: hashPassword(input.ownerPassword),
    cashierPasswordHash: cashierPassword ? hashPassword(cashierPassword) : null,
  });
  sessionRole = 'owner';
  return getAccessStatus();
}

export async function updateAccess(input: AccessUpdateInput): Promise<AccessStatusDto> {
  const hashes = await readHashes();
  if (!isEnabled(hashes)) {
    throw new Error('Ative o acesso antes de alterar as senhas.');
  }
  if (!verifyPassword(input.currentOwnerPassword, hashes.ownerPasswordHash)) {
    throw new Error('Senha atual do dono incorreta.');
  }
  if (!input.ownerPassword && !input.cashierPassword) {
    throw new Error('Informe a nova senha do dono ou do caixa.');
  }
  const nextOwner = input.ownerPassword ? hashPassword(input.ownerPassword) : undefined;
  const nextCashier = input.cashierPassword ? hashPassword(input.cashierPassword) : undefined;
  if (
    input.ownerPassword &&
    input.cashierPassword &&
    input.ownerPassword === input.cashierPassword
  ) {
    throw new Error('Use senhas diferentes para dono e caixa.');
  }
  await writeHashes({
    ownerPasswordHash: nextOwner,
    cashierPasswordHash: nextCashier,
  });
  sessionRole = 'owner';
  return getAccessStatus();
}

export async function disableAccess(input: AccessDisableInput): Promise<AccessStatusDto> {
  const hashes = await readHashes();
  if (!isEnabled(hashes)) {
    return getAccessStatus();
  }
  if (!verifyPassword(input.currentOwnerPassword, hashes.ownerPasswordHash)) {
    throw new Error('Senha do dono incorreta.');
  }
  await writeHashes({ ownerPasswordHash: null, cashierPasswordHash: null });
  sessionRole = null;
  return getAccessStatus();
}
