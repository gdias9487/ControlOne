/** Mantém só os dígitos do telefone (máx. 11). Vazio vira null. */
export function normalizePhone(value?: string | null): string | null {
  const digits = String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 11);
  return digits || null;
}

/** Formata telefone brasileiro: (11) 98765-4321 ou (11) 3456-7890. */
export function formatPhone(value?: string | null): string {
  const digits = normalizePhone(value);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
