/**
 * Núcleo de licença (TypeScript) — manter algoritmo/secret alinhados a
 * scripts/lib/license-core.cjs
 */
import { createHmac, createHash, timingSafeEqual } from 'crypto';

const LICENSE_SECRET =
  'ControlOne-License-v1/7f3c9e2a1b8d4f60-c5a7e91d3b2f8460-9e1c4a7b5d8f2036';

export function normalizeMachineId(input: string): string {
  const hex = String(input || '')
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '');
  if (hex.length !== 16) {
    throw new Error('ID da máquina inválido. Use o formato XXXX-XXXX-XXXX-XXXX.');
  }
  return hex.match(/.{1,4}/g)!.join('-');
}

function machineIdToHex(machineId: string): string {
  return normalizeMachineId(machineId).replace(/-/g, '');
}

function formatGrouped(hex: string): string {
  return hex.match(/.{1,4}/g)!.join('-');
}

function signMachineId(machineId: string): string {
  const mid = machineIdToHex(machineId);
  return createHmac('sha256', LICENSE_SECRET)
    .update(`CO1|${mid}`)
    .digest('hex')
    .toUpperCase()
    .slice(0, 16);
}

export function issueLicenseKey(machineId: string): string {
  const mid = machineIdToHex(machineId);
  const sig = signMachineId(mid);
  return `CO1-${formatGrouped(mid)}-${formatGrouped(sig)}`;
}

function parseLicenseKey(key: string): { machineIdHex: string; signatureHex: string } {
  const dashed = String(key || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  const parts = dashed.split('-');
  if (parts[0] === 'CO1' && parts.length === 9) {
    const mid = parts.slice(1, 5).join('');
    const sig = parts.slice(5, 9).join('');
    if (/^[A-F0-9]{16}$/.test(mid) && /^[A-F0-9]{16}$/.test(sig)) {
      return { machineIdHex: mid, signatureHex: sig };
    }
  }

  const compact = dashed.replace(/^CO1-/, 'CO1').replace(/-/g, '');
  const match = compact.match(/^CO1([A-F0-9]{16})([A-F0-9]{16})$/);
  if (!match) {
    throw new Error('Chave de licença inválida.');
  }
  return { machineIdHex: match[1], signatureHex: match[2] };
}

export function verifyLicenseKey(key: string, machineId: string): boolean {
  try {
    const parsed = parseLicenseKey(key);
    const expectedMid = machineIdToHex(machineId);
    if (parsed.machineIdHex !== expectedMid) return false;
    const expectedSig = signMachineId(expectedMid);
    const a = Buffer.from(parsed.signatureHex, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function fingerprintToMachineId(fingerprint: string): string {
  const hex = createHash('sha256').update(fingerprint).digest('hex').toUpperCase().slice(0, 16);
  return formatGrouped(hex);
}
