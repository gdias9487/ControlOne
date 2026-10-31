import type { BusinessModule } from './business-profile';

export const CASHIER_GRANTABLE_MODULES = [
  'pos',
  'sales',
  'products',
  'services',
  'customerPlans',
  'inventory',
  'customers',
] as const;

export type CashierGrantableModule = (typeof CASHIER_GRANTABLE_MODULES)[number];

export const DEFAULT_CASHIER_MODULES: CashierGrantableModule[] = [
  'pos',
  'products',
  'inventory',
];

export const CASHIER_MODULE_LABELS: Record<CashierGrantableModule, string> = {
  pos: 'Caixa',
  sales: 'Vendas',
  products: 'Produtos',
  services: 'Serviços',
  customerPlans: 'Planos ativos',
  inventory: 'Estoque',
  customers: 'Clientes',
};

export function isCashierGrantableModule(value: unknown): value is CashierGrantableModule {
  return CASHIER_GRANTABLE_MODULES.includes(value as CashierGrantableModule);
}

export function parseCashierModules(
  raw: unknown,
  fallbackCatalog = false,
): CashierGrantableModule[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      value = null;
    }
  }
  if (Array.isArray(value)) {
    const unique = [...new Set(value.filter(isCashierGrantableModule))];
    if (unique.length > 0) return unique;
  }
  return fallbackCatalog ? [...DEFAULT_CASHIER_MODULES] : ['pos'];
}

export function defaultCashierModules(
  hasModule: (module: BusinessModule) => boolean,
): CashierGrantableModule[] {
  const defaults = DEFAULT_CASHIER_MODULES.filter((module) => hasModule(module));
  return defaults.length > 0 ? defaults : CASHIER_GRANTABLE_MODULES.filter((module) => hasModule(module)).slice(0, 1);
}

export function cashierCanManageCatalog(modules: readonly string[]): boolean {
  return modules.includes('products') || modules.includes('inventory');
}

export function cashierAllowedModules(
  modules: readonly string[],
): CashierGrantableModule[] {
  return modules.filter(isCashierGrantableModule);
}

export function cashierCanUseApp(input: {
  modules: readonly string[];
  hasModule: (module: BusinessModule) => boolean;
}): boolean {
  return cashierAllowedModules(input.modules).some((module) => input.hasModule(module));
}

export function cashierPosOnly(modules: readonly string[]): boolean {
  const granted = cashierAllowedModules(modules);
  return granted.length === 1 && granted[0] === 'pos';
}

export function cashierHomePath(input: {
  modules: readonly string[];
  hasModule: (module: BusinessModule) => boolean;
}): string {
  const order: Array<{ module: CashierGrantableModule; path: string }> = [
    { module: 'pos', path: '/caixa' },
    { module: 'products', path: '/produtos' },
    { module: 'inventory', path: '/estoque' },
    { module: 'sales', path: '/vendas' },
    { module: 'customers', path: '/clientes' },
    { module: 'services', path: '/servicos' },
    { module: 'customerPlans', path: '/planos-ativos' },
  ];
  for (const item of order) {
    if (input.modules.includes(item.module) && input.hasModule(item.module)) {
      return item.path;
    }
  }
  return '/caixa';
}
