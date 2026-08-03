import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import type { CleideApi } from '../shared/types/api';

const api: CleideApi = {
  categories: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_LIST),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_DELETE, id),
  },
  customers: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMERS_LIST, filters),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMERS_GET, id),
    history: (id) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMERS_HISTORY, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMERS_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMERS_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMERS_DELETE, id),
  },
  products: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCTS_LIST, filters),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCTS_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCTS_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCTS_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCTS_DELETE, id),
    selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.PRODUCTS_SELECT_IMAGE),
  },
  inventory: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_LIST, filters),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_CREATE, input),
    lowStock: () => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_LOW_STOCK),
  },
  sales: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.SALES_LIST, filters),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.SALES_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.SALES_CREATE, input),
    cancel: (id) => ipcRenderer.invoke(IPC_CHANNELS.SALES_CANCEL, id),
    settleFiado: (input) => ipcRenderer.invoke(IPC_CHANNELS.SALES_SETTLE_FIADO, input),
  },
  services: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_LIST, filters),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_DELETE, id),
    settleFiado: (input) => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_SETTLE_FIADO, input),
  },
  serviceCatalogs: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.SERVICE_CATALOGS_LIST, filters),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.SERVICE_CATALOGS_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.SERVICE_CATALOGS_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.SERVICE_CATALOGS_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.SERVICE_CATALOGS_DELETE, id),
  },
  expenses: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_LIST, filters),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_DELETE, id),
  },
  recurringExpenses: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.RECURRING_EXPENSES_LIST, filters),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.RECURRING_EXPENSES_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.RECURRING_EXPENSES_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.RECURRING_EXPENSES_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.RECURRING_EXPENSES_DELETE, id),
    pending: (filters) => ipcRenderer.invoke(IPC_CHANNELS.RECURRING_EXPENSES_PENDING, filters),
    confirm: (input) => ipcRenderer.invoke(IPC_CHANNELS.RECURRING_EXPENSES_CONFIRM, input),
  },
  dashboard: {
    get: (range) => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_GET, range),
  },
  reports: {
    get: (filters) => ipcRenderer.invoke(IPC_CHANNELS.REPORTS_GET, filters),
    exportPdf: (filters) => ipcRenderer.invoke(IPC_CHANNELS.REPORTS_EXPORT_PDF, filters),
    exportExcel: (filters) => ipcRenderer.invoke(IPC_CHANNELS.REPORTS_EXPORT_EXCEL, filters),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, input),
    selectLogo: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_LOGO),
    backup: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_BACKUP),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESTORE),
    selectBackupFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_BACKUP_FOLDER),
  },
  app: {
    getImageUrl: (relativePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_IMAGE_URL, relativePath),
  },
  license: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_STATUS),
    activate: (key) => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_ACTIVATE, key),
  },
};

contextBridge.exposeInMainWorld('cleideApi', api);
