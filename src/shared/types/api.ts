import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CustomerCreateInput,
  CustomerUpdateInput,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  InventoryCreateInput,
  InventoryListFilters,
  RecurringExpenseConfirmInput,
  RecurringExpenseCreateInput,
  RecurringExpenseUpdateInput,
  ProductCreateInput,
  ProductListFilters,
  ProductUpdateInput,
  ReportFiltersInput,
  SaleCreateInput,
  SalesListFilters,
  ServicesListFilters,
  SettleFiadoInput,
  ServiceCatalogCreateInput,
  ServiceCatalogListFilters,
  ServiceCatalogUpdateInput,
  ServiceCreateInput,
  ServiceUpdateInput,
  SettingsUpdateInput,
  DateRangeInput,
} from '../schemas';
import type {
  ApiResult,
  BackupResult,
  CategoryDto,
  CustomerDto,
  CustomerHistoryDto,
  DashboardDto,
  ExpenseDto,
  ImageSelectResult,
  InventoryMovementDto,
  LicenseStatusDto,
  PaginatedResult,
  PendingRecurringExpenseDto,
  ProductDto,
  RecurringExpenseDto,
  ReportDto,
  SaleDto,
  ServiceCatalogDto,
  ServiceDto,
  SettingsDto,
  LowStockProductDto,
  UpdaterStatusDto,
} from '../types';

export interface CleideApi {
  categories: {
    list: () => Promise<ApiResult<CategoryDto[]>>;
    get: (id: string) => Promise<ApiResult<CategoryDto>>;
    create: (input: CategoryCreateInput) => Promise<ApiResult<CategoryDto>>;
    update: (input: CategoryUpdateInput) => Promise<ApiResult<CategoryDto>>;
    delete: (id: string) => Promise<ApiResult<{ id: string }>>;
  };
  customers: {
    list: (filters?: {
      search?: string;
      openFiadoOnly?: boolean;
      noOpenFiadoOnly?: boolean;
      page?: number;
      pageSize?: number;
    }) => Promise<ApiResult<PaginatedResult<CustomerDto>>>;
    get: (id: string) => Promise<ApiResult<CustomerDto>>;
    history: (id: string) => Promise<ApiResult<CustomerHistoryDto>>;
    create: (input: CustomerCreateInput) => Promise<ApiResult<CustomerDto>>;
    update: (input: CustomerUpdateInput) => Promise<ApiResult<CustomerDto>>;
    delete: (id: string) => Promise<ApiResult<{ id: string }>>;
  };
  products: {
    list: (filters: ProductListFilters) => Promise<ApiResult<PaginatedResult<ProductDto>>>;
    get: (id: string) => Promise<ApiResult<ProductDto>>;
    create: (input: ProductCreateInput) => Promise<ApiResult<ProductDto>>;
    update: (input: ProductUpdateInput) => Promise<ApiResult<ProductDto>>;
    delete: (id: string) => Promise<ApiResult<{ id: string }>>;
    selectImage: () => Promise<ApiResult<ImageSelectResult | null>>;
  };
  inventory: {
    list: (filters?: InventoryListFilters) => Promise<ApiResult<PaginatedResult<InventoryMovementDto>>>;
    create: (input: InventoryCreateInput) => Promise<ApiResult<InventoryMovementDto>>;
    lowStock: () => Promise<ApiResult<LowStockProductDto[]>>;
  };
  sales: {
    list: (filters?: SalesListFilters) => Promise<ApiResult<PaginatedResult<SaleDto>>>;
    get: (id: string) => Promise<ApiResult<SaleDto>>;
    create: (input: SaleCreateInput) => Promise<ApiResult<SaleDto>>;
    cancel: (id: string) => Promise<ApiResult<SaleDto>>;
    settleFiado: (input: SettleFiadoInput) => Promise<ApiResult<SaleDto>>;
  };
  services: {
    list: (filters?: ServicesListFilters) => Promise<ApiResult<PaginatedResult<ServiceDto>>>;
    get: (id: string) => Promise<ApiResult<ServiceDto>>;
    create: (input: ServiceCreateInput) => Promise<ApiResult<ServiceDto>>;
    update: (input: ServiceUpdateInput) => Promise<ApiResult<ServiceDto>>;
    delete: (id: string) => Promise<ApiResult<{ id: string }>>;
    settleFiado: (input: SettleFiadoInput) => Promise<ApiResult<ServiceDto>>;
  };
  serviceCatalogs: {
    list: (
      filters?: ServiceCatalogListFilters,
    ) => Promise<ApiResult<PaginatedResult<ServiceCatalogDto>>>;
    get: (id: string) => Promise<ApiResult<ServiceCatalogDto>>;
    create: (input: ServiceCatalogCreateInput) => Promise<ApiResult<ServiceCatalogDto>>;
    update: (input: ServiceCatalogUpdateInput) => Promise<ApiResult<ServiceCatalogDto>>;
    delete: (id: string) => Promise<ApiResult<{ id: string }>>;
  };
  expenses: {
    list: (filters?: {
      page?: number;
      pageSize?: number;
      startDate?: string;
      endDate?: string;
      sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
    }) => Promise<ApiResult<PaginatedResult<ExpenseDto>>>;
    create: (input: ExpenseCreateInput) => Promise<ApiResult<ExpenseDto>>;
    update: (input: ExpenseUpdateInput) => Promise<ApiResult<ExpenseDto>>;
    delete: (id: string) => Promise<ApiResult<{ id: string }>>;
  };
  recurringExpenses: {
    list: (filters?: { activeOnly?: boolean }) => Promise<ApiResult<RecurringExpenseDto[]>>;
    get: (id: string) => Promise<ApiResult<RecurringExpenseDto>>;
    create: (input: RecurringExpenseCreateInput) => Promise<ApiResult<RecurringExpenseDto>>;
    update: (input: RecurringExpenseUpdateInput) => Promise<ApiResult<RecurringExpenseDto>>;
    delete: (id: string) => Promise<ApiResult<{ id: string }>>;
    pending: (filters?: { month?: string }) => Promise<ApiResult<PendingRecurringExpenseDto[]>>;
    confirm: (input: RecurringExpenseConfirmInput) => Promise<ApiResult<ExpenseDto[]>>;
  };
  dashboard: {
    get: (range: DateRangeInput) => Promise<ApiResult<DashboardDto>>;
  };
  reports: {
    get: (filters: ReportFiltersInput) => Promise<ApiResult<ReportDto>>;
    exportPdf: (filters: ReportFiltersInput) => Promise<ApiResult<{ path: string }>>;
    exportExcel: (filters: ReportFiltersInput) => Promise<ApiResult<{ path: string }>>;
  };
  settings: {
    get: () => Promise<ApiResult<SettingsDto>>;
    update: (input: SettingsUpdateInput) => Promise<ApiResult<SettingsDto>>;
    selectLogo: () => Promise<ApiResult<ImageSelectResult | null>>;
    backup: () => Promise<ApiResult<BackupResult>>;
    restore: () => Promise<ApiResult<BackupResult>>;
    selectBackupFolder: () => Promise<ApiResult<{ path: string } | null>>;
  };
  app: {
    getImageUrl: (relativePath: string | null) => Promise<ApiResult<string | null>>;
  };
  license: {
    status: () => Promise<ApiResult<LicenseStatusDto>>;
    activate: (key: string) => Promise<ApiResult<LicenseStatusDto>>;
  };
  updater: {
    getStatus: () => Promise<ApiResult<UpdaterStatusDto>>;
    check: () => Promise<ApiResult<UpdaterStatusDto>>;
    download: () => Promise<ApiResult<UpdaterStatusDto>>;
    install: () => Promise<ApiResult<UpdaterStatusDto>>;
    onStatus: (listener: (status: UpdaterStatusDto) => void) => () => void;
  };
}

declare global {
  interface Window {
    cleideApi: CleideApi;
  }
}

export {};
