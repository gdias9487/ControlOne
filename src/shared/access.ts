import type { BusinessModule } from './business-profile';

export const CASHIER_POS_MODULES: BusinessModule[] = ['pos'];
export const CASHIER_CATALOG_MODULES: BusinessModule[] = ['products', 'inventory'];

export function cashierAllowedModules(canManageCatalog: boolean): BusinessModule[] {
  return canManageCatalog
    ? [...CASHIER_POS_MODULES, ...CASHIER_CATALOG_MODULES]
    : [...CASHIER_POS_MODULES];
}

export function cashierCanUseApp(input: {
  usesPos: boolean;
  canManageCatalog: boolean;
}): boolean {
  return input.usesPos || input.canManageCatalog;
}

export function cashierHomePath(input: {
  usesPos: boolean;
  canManageCatalog: boolean;
  hasProducts: boolean;
  hasInventory: boolean;
}): string {
  if (input.usesPos) return '/caixa';
  if (input.canManageCatalog && input.hasProducts) return '/produtos';
  if (input.canManageCatalog && input.hasInventory) return '/estoque';
  return '/caixa';
}
