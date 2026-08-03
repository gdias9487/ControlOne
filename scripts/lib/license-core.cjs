/**
 * Núcleo compartilhado da licença ControlOne (modo semi-automático).
 * Usado pelo app (via cópia tipada) e pelo script `license:issue`.
 *
 * Formato da chave: CO1-XXXX-XXXX-XXXX-XXXX-YYYY-YYYY-YYYY-YYYY
 *   - primeiros 16 hex: machine id
 *   - últimos 16 hex: HMAC-SHA256
 */
const crypto = require('crypto');

/** Mantenha igual em src/shared/license-crypto.ts */
const LICENSE_SECRET =
  'ControlOne-License-v1/7f3c9e2a1b8d4f60-c5a7e91d3b2f8460-9e1c4a7b5d8f2036';

function normalizeMachineId(input) {
  const hex = String(input || '')
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '');
  if (hex.length !== 16) {
    throw new Error('ID da máquina inválido. Use o formato XXXX-XXXX-XXXX-XXXX.');
  }
  return hex.match(/.{1,4}/g).join('-');
}

function machineIdToHex(machineId) {
  return normalizeMachineId(machineId).replace(/-/g, '');
}

function formatGrouped(hex) {
  return hex.match(/.{1,4}/g).join('-');
}

function signMachineId(machineId) {
  const mid = machineIdToHex(machineId);
  return crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(`CO1|${mid}`)
    .digest('hex')
    .toUpperCase()
    .slice(0, 16);
}

function issueLicenseKey(machineId) {
  const mid = machineIdToHex(machineId);
  const sig = signMachineId(mid);
  return `CO1-${formatGrouped(mid)}-${formatGrouped(sig)}`;
}

function parseLicenseKey(key) {
  const compact = String(key || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CO1-/, 'CO1');
  const match = compact.match(/^CO1([A-F0-9]{16})([A-F0-9]{16})$/);
  if (!match) {
    // Also accept dashed form CO1-XXXX-... by stripping dashes after prefix
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
    throw new Error('Chave de licença inválida.');
  }
  return { machineIdHex: match[1], signatureHex: match[2] };
}

function verifyLicenseKey(key, machineId) {
  try {
    const parsed = parseLicenseKey(key);
    const expectedMid = machineIdToHex(machineId);
    if (parsed.machineIdHex !== expectedMid) return false;
    const expectedSig = signMachineId(expectedMid);
    const a = Buffer.from(parsed.signatureHex, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function fingerprintToMachineId(fingerprint) {
  const hex = crypto.createHash('sha256').update(fingerprint).digest('hex').toUpperCase().slice(0, 16);
  return formatGrouped(hex);
}

module.exports = {
  LICENSE_SECRET,
  normalizeMachineId,
  issueLicenseKey,
  verifyLicenseKey,
  fingerprintToMachineId,
  parseLicenseKey,
};
