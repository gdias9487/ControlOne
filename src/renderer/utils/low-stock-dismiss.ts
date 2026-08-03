const STORAGE_KEY = 'controlone:low-stock-dismissed';

type DismissMap = Record<string, number>;

function readMap(): DismissMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    const now = Date.now();
    const cleaned: DismissMap = {};
    for (const [id, expires] of Object.entries(parsed)) {
      if (typeof expires === 'number' && expires > now) cleaned[id] = expires;
    }
    if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeMap(map: DismissMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Silencia alerta do produto por `days` dias (padrão 1). */
export function dismissLowStockProduct(productId: string, days = 1) {
  const map = readMap();
  map[productId] = Date.now() + days * 24 * 60 * 60 * 1000;
  writeMap(map);
}

export function isLowStockDismissed(productId: string): boolean {
  const map = readMap();
  return (map[productId] ?? 0) > Date.now();
}

export function filterVisibleLowStock<T extends { id: string }>(items: T[]): T[] {
  return items.filter((item) => !isLowStockDismissed(item.id));
}

const STARTUP_SKIP_KEY = 'controlone:low-stock-startup-skip';

export function skipLowStockStartupToday() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  localStorage.setItem(STARTUP_SKIP_KEY, String(end.getTime()));
}

export function shouldShowLowStockStartup(): boolean {
  const raw = localStorage.getItem(STARTUP_SKIP_KEY);
  if (!raw) return true;
  const until = Number(raw);
  if (!Number.isFinite(until) || until < Date.now()) {
    localStorage.removeItem(STARTUP_SKIP_KEY);
    return true;
  }
  return false;
}
