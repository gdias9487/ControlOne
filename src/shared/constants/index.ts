export const APP_NAME = 'ControlOne';
export const APP_VERSION = '1.0.0';

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const PAYMENT_METHOD_LABELS = {
  PIX: 'Pix',
  CASH: 'Dinheiro',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
  OTHER: 'Outra',
  FIADO: 'Fiado',
} as const;

export const SALE_STATUS_LABELS = {
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
} as const;

export const SERVICE_STATUS_LABELS = {
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
} as const;

export const PRODUCT_STATUS_LABELS = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
} as const;

export const INVENTORY_MOVEMENT_LABELS = {
  ENTRY: 'Entrada',
  EXIT: 'Saída',
  LOSS: 'Perda',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolução',
  SALE: 'Venda',
} as const;

export const EXPENSE_CATEGORY_LABELS = {
  MERCHANDISE: 'Compra de mercadoria',
  PACKAGING: 'Embalagens',
  TRANSPORT: 'Transporte',
  FEES: 'Taxas',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outros',
} as const;

export const PERIOD_PRESETS = {
  TODAY: 'Hoje',
  LAST_7_DAYS: 'Últimos 7 dias',
  LAST_30_DAYS: 'Últimos 30 dias',
  CURRENT_MONTH: 'Mês atual',
  CURRENT_YEAR: 'Ano atual',
  CUSTOM: 'Período personalizado',
} as const;

export const IPC_CHANNELS = {
  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_GET: 'categories:get',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  PRODUCTS_LIST: 'products:list',
  PRODUCTS_GET: 'products:get',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_SELECT_IMAGE: 'products:selectImage',

  INVENTORY_LIST: 'inventory:list',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_LOW_STOCK: 'inventory:lowStock',

  SALES_LIST: 'sales:list',
  SALES_GET: 'sales:get',
  SALES_CREATE: 'sales:create',
  SALES_CANCEL: 'sales:cancel',
  SALES_SETTLE_FIADO: 'sales:settleFiado',

  CUSTOMERS_LIST: 'customers:list',
  CUSTOMERS_GET: 'customers:get',
  CUSTOMERS_HISTORY: 'customers:history',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',

  SERVICES_LIST: 'services:list',
  SERVICES_GET: 'services:get',
  SERVICES_CREATE: 'services:create',
  SERVICES_UPDATE: 'services:update',
  SERVICES_DELETE: 'services:delete',
  SERVICES_SETTLE_FIADO: 'services:settleFiado',

  SERVICE_CATALOGS_LIST: 'serviceCatalogs:list',
  SERVICE_CATALOGS_GET: 'serviceCatalogs:get',
  SERVICE_CATALOGS_CREATE: 'serviceCatalogs:create',
  SERVICE_CATALOGS_UPDATE: 'serviceCatalogs:update',
  SERVICE_CATALOGS_DELETE: 'serviceCatalogs:delete',

  EXPENSES_LIST: 'expenses:list',
  EXPENSES_CREATE: 'expenses:create',
  EXPENSES_UPDATE: 'expenses:update',
  EXPENSES_DELETE: 'expenses:delete',

  RECURRING_EXPENSES_LIST: 'recurringExpenses:list',
  RECURRING_EXPENSES_GET: 'recurringExpenses:get',
  RECURRING_EXPENSES_CREATE: 'recurringExpenses:create',
  RECURRING_EXPENSES_UPDATE: 'recurringExpenses:update',
  RECURRING_EXPENSES_DELETE: 'recurringExpenses:delete',
  RECURRING_EXPENSES_PENDING: 'recurringExpenses:pending',
  RECURRING_EXPENSES_CONFIRM: 'recurringExpenses:confirm',

  DASHBOARD_GET: 'dashboard:get',
  REPORTS_GET: 'reports:get',
  REPORTS_EXPORT_PDF: 'reports:exportPdf',
  REPORTS_EXPORT_EXCEL: 'reports:exportExcel',

  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_SELECT_LOGO: 'settings:selectLogo',
  SETTINGS_BACKUP: 'settings:backup',
  SETTINGS_RESTORE: 'settings:restore',
  SETTINGS_SELECT_BACKUP_FOLDER: 'settings:selectBackupFolder',

  APP_GET_IMAGE_URL: 'app:getImageUrl',
  APP_GET_PATH: 'app:getPath',

  LICENSE_STATUS: 'license:status',
  LICENSE_ACTIVATE: 'license:activate',

  UPDATER_GET_STATUS: 'updater:getStatus',
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
