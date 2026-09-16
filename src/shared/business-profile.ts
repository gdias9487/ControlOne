export const BUSINESS_PROFILES = ['commerce', 'consultancy', 'mixed'] as const;
export type BusinessProfile = (typeof BUSINESS_PROFILES)[number];

export const BUSINESS_MODULES = [
  'dashboard',
  'pos',
  'sales',
  'products',
  'services',
  'customerPlans',
  'inventory',
  'customers',
  'finance',
  'reports',
  'settings',
] as const;
export type BusinessModule = (typeof BUSINESS_MODULES)[number];

const COMMERCE_MODULES: BusinessModule[] = BUSINESS_MODULES.filter(
  (module) => module !== 'customerPlans',
);

const CONSULTANCY_MODULES: BusinessModule[] = [
  'dashboard',
  'sales',
  'products',
  'customerPlans',
  'customers',
  'finance',
  'reports',
  'settings',
];

export interface BusinessProfileOption {
  id: BusinessProfile;
  title: string;
  description: string;
  modules: readonly BusinessModule[];
}

export const BUSINESS_PROFILE_OPTIONS: BusinessProfileOption[] = [
  {
    id: 'commerce',
    title: 'Comércio',
    description: 'Produtos, caixa, estoque, vendas e serviços.',
    modules: COMMERCE_MODULES,
  },
  {
    id: 'consultancy',
    title: 'Consultoria',
    description: 'Planos, clientes e financeiro.',
    modules: CONSULTANCY_MODULES,
  },
  {
    id: 'mixed',
    title: 'Misto',
    description: 'Comércio e consultoria juntos: caixa, estoque, produtos e serviços.',
    modules: COMMERCE_MODULES,
  },
];

const PROFILE_MODULE_SET: Record<BusinessProfile, ReadonlySet<BusinessModule>> = {
  commerce: new Set(COMMERCE_MODULES),
  consultancy: new Set(CONSULTANCY_MODULES),
  mixed: new Set(COMMERCE_MODULES),
};

export function isBusinessProfile(value: unknown): value is BusinessProfile {
  return value === 'commerce' || value === 'consultancy' || value === 'mixed';
}

export function normalizeBusinessProfile(value: unknown): BusinessProfile {
  if (value === 'trainer') return 'consultancy';
  return isBusinessProfile(value) ? value : 'commerce';
}

export function profileHasModule(
  profile: BusinessProfile | string | null | undefined,
  module: BusinessModule,
): boolean {
  return PROFILE_MODULE_SET[normalizeBusinessProfile(profile)].has(module);
}

export function usesPlansLabel(profile: BusinessProfile | string | null | undefined): boolean {
  return normalizeBusinessProfile(profile) === 'consultancy';
}

export function usesCustomerPlans(profile: BusinessProfile | string | null | undefined): boolean {
  return usesPlansLabel(profile);
}

export const PLAN_DURATION_PRESETS = [
  { days: 30, label: '1 mês' },
  { days: 90, label: '3 meses' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '1 ano' },
] as const;

export interface CatalogCopy {
  singular: string;
  plural: string;
  Singular: string;
  Plural: string;
  navLabel: string;
  newItem: string;
  editItem: string;
  searchPlaceholder: string;
  loading: string;
  noneRegistered: string;
  emptyDescription: string;
  registerAction: string;
  created: string;
  updated: string;
  removed: string;
  deleteTitle: string;
  deleteDescription: string;
  formDescription: string;
  formCreateHint: string;
  dashboardSection: string;
  registeredCount: string;
  soldCount: string;
  saleHeaderSubtitle: string;
  saleSearchPlaceholder: string;
  saleSelectHint: string;
  saleNoneTitle: string;
  saleNoneDescription: string;
  saleDialogHint: string;
  saleLineLabel: string;
  saleLineDiscount: string;
  registerNew: string;
  noneInSelect: string;
  swapAria: string;
  adHocHint: string;
  categoriesDescription: string;
  categoryCount: (n: number) => string;
  categoryDeleteHint: string;
  reportsTop: string;
  reportsStale: string;
  reportsMargins: string;
  reportsTopChart: string;
  reportsMarginsChart: string;
  reportsStaleChart: string;
  reportsListAll: string;
}

const PRODUCT_COPY: CatalogCopy = {
  singular: 'produto',
  plural: 'produtos',
  Singular: 'Produto',
  Plural: 'Produtos',
  navLabel: 'Produtos',
  newItem: 'Novo produto',
  editItem: 'Editar produto',
  searchPlaceholder: 'Pesquisar produtos...',
  loading: 'Carregando produtos...',
  noneRegistered: 'Nenhum produto cadastrado',
  emptyDescription: 'Comece cadastrando anéis, colares, brincos e outras peças.',
  registerAction: 'Cadastrar produto',
  created: 'Produto cadastrado',
  updated: 'Produto atualizado',
  removed: 'Produto removido',
  deleteTitle: 'Excluir produto?',
  deleteDescription: 'Se houver histórico de vendas, o produto será apenas desativado.',
  formDescription: 'Preencha os dados da peça. A margem é calculada automaticamente.',
  formCreateHint: 'Cadastre o produto para usar nesta venda. A margem é calculada automaticamente.',
  dashboardSection: 'Produtos',
  registeredCount: 'Produtos cadastrados',
  soldCount: 'Produtos vendidos',
  saleHeaderSubtitle: 'Vendas de produtos e serviços prestados',
  saleSearchPlaceholder: 'Buscar por código, cliente ou produto...',
  saleSelectHint: 'Selecione um produto ou informe um item avulso em todas as linhas.',
  saleNoneTitle: 'Nenhum produto',
  saleNoneDescription: 'Adicione ao menos um produto para finalizar a venda.',
  saleDialogHint:
    'Os preços ficam salvos mesmo se o produto mudar depois. Digite um nome no campo do produto para vender um item avulso (sem cadastro e sem estoque).',
  saleLineLabel: 'Nome do produto',
  saleLineDiscount: 'Desconto por produto',
  registerNew: 'Cadastrar novo produto',
  noneInSelect: 'Nenhum produto. Digite um nome para venda avulsa.',
  swapAria: 'Trocar produto',
  adHocHint: 'Sem estoque / sem cadastro',
  categoriesDescription: 'Organize os produtos por tipo de peça.',
  categoryCount: (n) => `${n} produtos`,
  categoryDeleteHint: 'Só é possível excluir categorias sem produtos vinculados.',
  reportsTop: 'Produtos mais vendidos',
  reportsStale: 'Produtos parados',
  reportsMargins: 'Margem de lucro por produto',
  reportsTopChart: 'Quantidade vendida por produto',
  reportsMarginsChart: 'Margem de lucro (%) por produto',
  reportsStaleChart: 'Produtos sem saída',
  reportsListAll: 'Listar todos os produtos',
};

const PLAN_COPY: CatalogCopy = {
  singular: 'plano',
  plural: 'planos',
  Singular: 'Plano',
  Plural: 'Planos',
  navLabel: 'Planos',
  newItem: 'Novo plano',
  editItem: 'Editar plano',
  searchPlaceholder: 'Pesquisar planos...',
  loading: 'Carregando planos...',
  noneRegistered: 'Nenhum plano cadastrado',
  emptyDescription: 'Comece cadastrando os planos e pacotes que você oferece.',
  registerAction: 'Cadastrar plano',
  created: 'Plano cadastrado',
  updated: 'Plano atualizado',
  removed: 'Plano removido',
  deleteTitle: 'Excluir plano?',
  deleteDescription: 'Se houver histórico de vendas, o plano será apenas desativado.',
  formDescription: 'Preencha os dados do plano. A margem é calculada automaticamente.',
  formCreateHint: 'Cadastre o plano para usar nesta venda. A margem é calculada automaticamente.',
  dashboardSection: 'Planos',
  registeredCount: 'Planos cadastrados',
  soldCount: 'Planos vendidos',
  saleHeaderSubtitle: 'Vendas de planos e serviços prestados',
  saleSearchPlaceholder: 'Buscar por código, cliente ou plano...',
  saleSelectHint: 'Selecione um plano ou informe um item avulso em todas as linhas.',
  saleNoneTitle: 'Nenhum plano',
  saleNoneDescription: 'Adicione ao menos um plano para finalizar a venda.',
  saleDialogHint:
    'Os preços ficam salvos mesmo se o plano mudar depois. Digite um nome no campo do plano para vender um item avulso (sem cadastro).',
  saleLineLabel: 'Nome do plano',
  saleLineDiscount: 'Desconto por plano',
  registerNew: 'Cadastrar novo plano',
  noneInSelect: 'Nenhum plano. Digite um nome para venda avulsa.',
  swapAria: 'Trocar plano',
  adHocHint: 'Sem cadastro',
  categoriesDescription: 'Organize os planos por tipo de oferta.',
  categoryCount: (n) => `${n} planos`,
  categoryDeleteHint: 'Só é possível excluir categorias sem planos vinculados.',
  reportsTop: 'Planos mais vendidos',
  reportsStale: 'Planos parados',
  reportsMargins: 'Margem de lucro por plano',
  reportsTopChart: 'Quantidade vendida por plano',
  reportsMarginsChart: 'Margem de lucro (%) por plano',
  reportsStaleChart: 'Planos sem saída',
  reportsListAll: 'Listar todos os planos',
};

export function catalogCopy(profile: BusinessProfile | string | null | undefined): CatalogCopy {
  return usesPlansLabel(profile) ? PLAN_COPY : PRODUCT_COPY;
}

export const BUSINESS_TYPE_SUGGESTIONS: Record<BusinessProfile, string[]> = {
  commerce: [
    'Joias e acessórios',
    'Roupas e moda',
    'Cosméticos',
    'Mercado / mercearia',
    'Eletrônicos',
    'Serviços',
    'Outro',
  ],
  consultancy: [
    'Personal trainer',
    'Consultoria financeira',
    'Consultoria de RH',
    'Marketing',
    'Contabilidade',
    'Tecnologia',
    'Outro',
  ],
  mixed: [
    'Estética',
    'Clínica',
    'Ateliê',
    'Academia',
    'Serviços e produtos',
    'Outro',
  ],
};
