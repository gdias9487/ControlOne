import type {
  ExpenseCategory,
  InventoryMovementType,
  PaymentMethod,
  PeriodPreset,
  ProductStatus,
  SaleStatus,
  ServiceStatus,
} from '../schemas';

export type Money = string;

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

export interface CustomerDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  salesCount?: number;
  openFiadoTotal?: Money;
}

export interface CustomerHistoryDto {
  customer: CustomerDto;
  sales: SaleDto[];
  services: ServiceDto[];
  totals: {
    salesCount: number;
    salesTotal: Money;
    servicesCount: number;
    servicesTotal: Money;
    openFiadoTotal: Money;
    openFiadoCount: number;
    paidFiadoTotal: Money;
  };
}

export interface ProductDto {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  internalCode: string;
  description: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  cost: Money;
  salePrice: Money;
  profitMargin: Money;
  stockQuantity: number;
  minStock: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  isLowStock: boolean;
}

/** Produto em alerta de estoque, com prioridade e contexto. */
export interface LowStockProductDto extends ProductDto {
  /** zerado = crítico; abaixo do mínimo = atenção */
  urgency: 'critical' | 'warning';
  /** Unidades faltando para atingir o mínimo (0 se já zerado e min=0). */
  unitsShort: number;
  /** Entre os mais vendidos recentes — risco maior de ruptura. */
  isHighDemand: boolean;
}

export interface InventoryMovementDto {
  id: string;
  productId: string;
  productName: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string | null;
  notes: string | null;
  previousStock: number;
  resultingStock: number;
  allowNegative: boolean;
  saleId: string | null;
  movedAt: string;
  createdAt: string;
}

export interface SaleItemDto {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  unitCost: Money;
  discountPercent: Money;
  subtotal: Money;
}

export interface SaleDto {
  id: string;
  saleNumber: string;
  customerId: string | null;
  customerName: string | null;
  discount: Money;
  subtotal: Money;
  total: Money;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  fiadoPaidAmount: Money;
  fiadoRemaining: Money;
  fiadoPaidAt: string | null;
  isFiadoOpen: boolean;
  notes: string | null;
  soldAt: string;
  createdAt: string;
  updatedAt: string;
  items: SaleItemDto[];
  /** Produtos que ficaram com estoque baixo/zerado após esta venda. */
  lowStockTriggered?: LowStockProductDto[];
}

export interface ServiceCatalogDto {
  id: string;
  name: string;
  description: string | null;
  cost: Money;
  amount: Money;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDto {
  id: string;
  catalogId: string | null;
  customerId: string | null;
  customerName: string | null;
  name: string;
  description: string | null;
  amount: Money;
  cost: Money;
  paymentMethod: PaymentMethod;
  status: ServiceStatus;
  fiadoPaidAmount: Money;
  fiadoRemaining: Money;
  fiadoPaidAt: string | null;
  isFiadoOpen: boolean;
  notes: string | null;
  performedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseDto {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: Money;
  paymentMethod: PaymentMethod;
  notes: string | null;
  expenseDate: string;
  recurringExpenseId: string | null;
  isFixed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpenseDto {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: Money;
  paymentMethod: PaymentMethod;
  dayOfMonth: number;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingRecurringExpenseDto extends RecurringExpenseDto {
  month: string;
  suggestedDate: string;
}

export interface SettingsDto {
  id: string;
  storeName: string;
  businessType: string | null;
  storePhone: string | null;
  storeEmail: string | null;
  storeAddress: string | null;
  logoPath: string | null;
  logoUrl: string | null;
  defaultMinStock: number;
  backupFolder: string | null;
  theme: 'light' | 'dark';
  onboardingCompleted: boolean;
  updatedAt: string;
}

export interface ChartPoint {
  label: string;
  value: Money;
  secondaryValue?: Money;
}

export interface BreakdownLine {
  label: string;
  detail?: string;
  amount: Money;
  /** '+' soma no total; '-' subtrai. */
  sign: '+' | '-';
}

export interface MetricBreakdown {
  id: string;
  title: string;
  description?: string;
  lines: BreakdownLine[];
  total: Money;
  totalLabel?: string;
  /** Linha informativa extra (não entra no total), ex.: fiado pendente. */
  note?: { label: string; amount: Money };
}

export interface NamedMetric {
  id: string;
  name: string;
  value: Money | number;
  extra?: string;
}

export interface DashboardDto {
  period: {
    preset: PeriodPreset;
    startDate: string;
    endDate: string;
  };
  cards: {
    monthlyRevenue: Money;
    openFiado: Money;
    estimatedProfit: Money;
    monthlyExpenses: Money;
    soldCosts: Money;
    soldCostsFiado: Money;
    totalAfterExpenses: Money;
    productsCount: number;
    productsSold: number;
    stockValue: Money;
  };
  breakdowns: {
    monthlyRevenue: MetricBreakdown;
    openFiado: MetricBreakdown;
    monthlyExpenses: MetricBreakdown;
    soldCosts: MetricBreakdown;
    soldCostsFiado: MetricBreakdown;
    totalAfterExpenses: MetricBreakdown;
  };
  charts: {
    salesByPeriod: ChartPoint[];
    monthlyRevenue: ChartPoint[];
    monthlyProfit: ChartPoint[];
    cashFlow: ChartPoint[];
  };
  widgets: {
    topProducts: NamedMetric[];
    bottomProducts: NamedMetric[];
    lowStock: LowStockProductDto[];
    recentSales: SaleDto[];
    recentMovements: InventoryMovementDto[];
    recentExpenses: ExpenseDto[];
  };
}

export interface ReportDto {
  title: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: NamedMetric[];
  rows: Array<Record<string, string | number>>;
  charts: ChartPoint[];
}

export interface ImageSelectResult {
  relativePath: string;
  absolutePath: string;
  url: string;
}

export interface BackupResult {
  path: string;
  createdAt: string;
}

export interface LicenseStatusDto {
  valid: boolean;
  machineId: string;
  activatedAt: string | null;
  bypass: boolean;
  message: string;
}

export type UpdaterStatusState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterStatusDto {
  state: UpdaterStatusState;
  currentVersion: string;
  availableVersion: string | null;
  percent: number | null;
  message: string | null;
  canCheck: boolean;
}
