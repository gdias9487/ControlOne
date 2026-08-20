import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../shared/constants';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  dateRangeSchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  inventoryCreateSchema,
  inventoryListFiltersSchema,
  recurringExpenseConfirmSchema,
  recurringExpenseCreateSchema,
  recurringExpenseUpdateSchema,
  productCreateSchema,
  productListFiltersSchema,
  productUpdateSchema,
  reportFiltersSchema,
  saleCreateSchema,
  salesListFiltersSchema,
  settleFiadoSchema,
  serviceCreateSchema,
  servicesListFiltersSchema,
  serviceUpdateSchema,
  serviceCatalogCreateSchema,
  serviceCatalogListFiltersSchema,
  serviceCatalogUpdateSchema,
  settingsUpdateSchema,
} from '../../shared/schemas';
import * as categoryService from '../services/category.service';
import * as customerService from '../services/customer.service';
import * as dashboardService from '../services/dashboard.service';
import * as expenseService from '../services/expense.service';
import { selectAndStoreImage } from '../services/image.service';
import * as inventoryService from '../services/inventory.service';
import * as productService from '../services/product.service';
import * as recurringExpenseService from '../services/recurring-expense.service';
import * as reportService from '../services/report.service';
import * as saleService from '../services/sale.service';
import * as serviceCatalogService from '../services/service-catalog.service';
import * as serviceService from '../services/service.service';
import * as licenseService from '../services/license.service';
import * as settingsService from '../services/settings.service';
import * as updaterService from '../services/updater.service';
import { handleIpc } from '../utils/ipc-result';
import { resolveImageAbsolutePath, toAppImageUrl, toFileUrl } from '../utils/paths';

function parse<S extends z.ZodTypeAny>(schema: S, payload: unknown): z.output<S> {
  return schema.parse(payload ?? {});
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_LIST, () => handleIpc(() => categoryService.listCategories()));
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_GET, (_e, id: unknown) =>
    handleIpc(() => categoryService.getCategory(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_CREATE, (_e, payload: unknown) =>
    handleIpc(() => categoryService.createCategory(parse(categoryCreateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_UPDATE, (_e, payload: unknown) =>
    handleIpc(() => categoryService.updateCategory(parse(categoryUpdateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_DELETE, (_e, id: unknown) =>
    handleIpc(() => categoryService.deleteCategory(z.string().parse(id))),
  );

  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_LIST, (_e, payload: unknown) =>
    handleIpc(() =>
      customerService.listCustomers(
        z
          .object({
            search: z.string().optional(),
            openFiadoOnly: z.boolean().optional(),
            noOpenFiadoOnly: z.boolean().optional(),
            page: z.number().int().min(1).optional(),
            pageSize: z.number().int().min(1).max(500).optional(),
          })
          .parse(payload ?? {}),
      ),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_GET, (_e, id: unknown) =>
    handleIpc(() => customerService.getCustomer(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_HISTORY, (_e, id: unknown) =>
    handleIpc(() => customerService.getCustomerHistory(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_CREATE, (_e, payload: unknown) =>
    handleIpc(() => customerService.createCustomer(parse(customerCreateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_UPDATE, (_e, payload: unknown) =>
    handleIpc(() => customerService.updateCustomer(parse(customerUpdateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_DELETE, (_e, id: unknown) =>
    handleIpc(() => customerService.deleteCustomer(z.string().parse(id))),
  );

  ipcMain.handle(IPC_CHANNELS.PRODUCTS_LIST, (_e, payload: unknown) =>
    handleIpc(() => productService.listProducts(parse(productListFiltersSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_GET, (_e, id: unknown) =>
    handleIpc(() => productService.getProduct(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_CREATE, (_e, payload: unknown) =>
    handleIpc(() => productService.createProduct(parse(productCreateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_UPDATE, (_e, payload: unknown) =>
    handleIpc(() => productService.updateProduct(parse(productUpdateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_DELETE, (_e, id: unknown) =>
    handleIpc(() => productService.deleteProduct(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_SELECT_IMAGE, () =>
    handleIpc(() => selectAndStoreImage('product')),
  );

  ipcMain.handle(IPC_CHANNELS.INVENTORY_LIST, (_e, payload: unknown) =>
    handleIpc(() => inventoryService.listMovements(parse(inventoryListFiltersSchema, payload ?? {}))),
  );
  ipcMain.handle(IPC_CHANNELS.INVENTORY_CREATE, (_e, payload: unknown) =>
    handleIpc(() => inventoryService.createMovement(parse(inventoryCreateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.INVENTORY_LOW_STOCK, () =>
    handleIpc(() => productService.listLowStockProducts()),
  );

  ipcMain.handle(IPC_CHANNELS.SALES_LIST, (_e, payload: unknown) =>
    handleIpc(() => saleService.listSales(parse(salesListFiltersSchema, payload ?? {}))),
  );
  ipcMain.handle(IPC_CHANNELS.SALES_GET, (_e, id: unknown) =>
    handleIpc(() => saleService.getSale(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.SALES_CREATE, (_e, payload: unknown) =>
    handleIpc(() => saleService.createSale(parse(saleCreateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.SALES_CANCEL, (_e, id: unknown) =>
    handleIpc(() => saleService.cancelSale(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.SALES_SETTLE_FIADO, (_e, payload: unknown) =>
    handleIpc(() => saleService.settleFiado(parse(settleFiadoSchema, payload))),
  );

  ipcMain.handle(IPC_CHANNELS.SERVICES_LIST, (_e, payload: unknown) =>
    handleIpc(() => serviceService.listServices(parse(servicesListFiltersSchema, payload ?? {}))),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICES_GET, (_e, id: unknown) =>
    handleIpc(() => serviceService.getService(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICES_CREATE, (_e, payload: unknown) =>
    handleIpc(() => serviceService.createService(parse(serviceCreateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICES_UPDATE, (_e, payload: unknown) =>
    handleIpc(() => serviceService.updateService(parse(serviceUpdateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICES_DELETE, (_e, id: unknown) =>
    handleIpc(() => serviceService.deleteService(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICES_SETTLE_FIADO, (_e, payload: unknown) =>
    handleIpc(() => serviceService.settleFiado(parse(settleFiadoSchema, payload))),
  );

  ipcMain.handle(IPC_CHANNELS.SERVICE_CATALOGS_LIST, (_e, payload: unknown) =>
    handleIpc(() =>
      serviceCatalogService.listServiceCatalogs(
        parse(serviceCatalogListFiltersSchema, payload ?? {}),
      ),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICE_CATALOGS_GET, (_e, id: unknown) =>
    handleIpc(() => serviceCatalogService.getServiceCatalog(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICE_CATALOGS_CREATE, (_e, payload: unknown) =>
    handleIpc(() =>
      serviceCatalogService.createServiceCatalog(parse(serviceCatalogCreateSchema, payload)),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICE_CATALOGS_UPDATE, (_e, payload: unknown) =>
    handleIpc(() =>
      serviceCatalogService.updateServiceCatalog(parse(serviceCatalogUpdateSchema, payload)),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.SERVICE_CATALOGS_DELETE, (_e, id: unknown) =>
    handleIpc(() => serviceCatalogService.deleteServiceCatalog(z.string().parse(id))),
  );

  ipcMain.handle(IPC_CHANNELS.EXPENSES_LIST, (_e, payload: unknown) =>
    handleIpc(() =>
      expenseService.listExpenses(
        z
          .object({
            page: z.number().int().min(1).optional(),
            pageSize: z.number().int().min(1).max(100).optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            sort: z.enum(['newest', 'oldest', 'amount_desc', 'amount_asc']).optional(),
          })
          .parse(payload ?? {}),
      ),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.EXPENSES_CREATE, (_e, payload: unknown) =>
    handleIpc(() => expenseService.createExpense(parse(expenseCreateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.EXPENSES_UPDATE, (_e, payload: unknown) =>
    handleIpc(() => expenseService.updateExpense(parse(expenseUpdateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.EXPENSES_DELETE, (_e, id: unknown) =>
    handleIpc(() => expenseService.deleteExpense(z.string().parse(id))),
  );

  ipcMain.handle(IPC_CHANNELS.RECURRING_EXPENSES_LIST, (_e, payload: unknown) =>
    handleIpc(() =>
      recurringExpenseService.listRecurringExpenses(
        z
          .object({
            activeOnly: z.boolean().optional(),
          })
          .parse(payload ?? {}),
      ),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.RECURRING_EXPENSES_GET, (_e, id: unknown) =>
    handleIpc(() => recurringExpenseService.getRecurringExpense(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.RECURRING_EXPENSES_CREATE, (_e, payload: unknown) =>
    handleIpc(() =>
      recurringExpenseService.createRecurringExpense(parse(recurringExpenseCreateSchema, payload)),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.RECURRING_EXPENSES_UPDATE, (_e, payload: unknown) =>
    handleIpc(() =>
      recurringExpenseService.updateRecurringExpense(parse(recurringExpenseUpdateSchema, payload)),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.RECURRING_EXPENSES_DELETE, (_e, id: unknown) =>
    handleIpc(() => recurringExpenseService.deleteRecurringExpense(z.string().parse(id))),
  );
  ipcMain.handle(IPC_CHANNELS.RECURRING_EXPENSES_PENDING, (_e, payload: unknown) =>
    handleIpc(() =>
      recurringExpenseService.listPendingRecurringExpenses(
        z
          .object({
            month: z
              .string()
              .regex(/^\d{4}-\d{2}$/)
              .optional(),
          })
          .parse(payload ?? {}).month,
      ),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.RECURRING_EXPENSES_CONFIRM, (_e, payload: unknown) =>
    handleIpc(() =>
      recurringExpenseService.confirmPendingRecurringExpenses(
        parse(recurringExpenseConfirmSchema, payload),
      ),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.DASHBOARD_GET, (_e, payload: unknown) =>
    handleIpc(() => dashboardService.getDashboard(parse(dateRangeSchema, payload))),
  );

  ipcMain.handle(IPC_CHANNELS.REPORTS_GET, (_e, payload: unknown) =>
    handleIpc(() => reportService.getReport(parse(reportFiltersSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.REPORTS_EXPORT_PDF, (_e, payload: unknown) =>
    handleIpc(() => reportService.exportReportPdf(parse(reportFiltersSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.REPORTS_EXPORT_EXCEL, (_e, payload: unknown) =>
    handleIpc(() => reportService.exportReportExcel(parse(reportFiltersSchema, payload))),
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => handleIpc(() => settingsService.getSettings()));
  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_e, payload: unknown) =>
    handleIpc(() => settingsService.updateSettings(parse(settingsUpdateSchema, payload))),
  );
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SELECT_LOGO, () =>
    handleIpc(() => settingsService.selectLogo()),
  );
  ipcMain.handle(IPC_CHANNELS.SETTINGS_BACKUP, () =>
    handleIpc(() => settingsService.createBackup()),
  );
  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESTORE, () =>
    handleIpc(() => settingsService.restoreBackup()),
  );
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SELECT_BACKUP_FOLDER, () =>
    handleIpc(async () => {
      const folder = await settingsService.selectBackupFolder();
      if (!folder) return null;
      await settingsService.updateSettings({ backupFolder: folder.path });
      return folder;
    }),
  );

  ipcMain.handle(IPC_CHANNELS.APP_GET_IMAGE_URL, (_e, relativePath: unknown) =>
    handleIpc(async () => {
      const value = z.string().nullable().parse(relativePath ?? null);
      return toAppImageUrl(value) ?? toFileUrl(resolveImageAbsolutePath(value));
    }),
  );

  ipcMain.handle(IPC_CHANNELS.LICENSE_STATUS, () =>
    handleIpc(async () => licenseService.getLicenseStatus()),
  );
  ipcMain.handle(IPC_CHANNELS.LICENSE_ACTIVATE, (_e, key: unknown) =>
    handleIpc(async () => licenseService.activateLicense(z.string().parse(key))),
  );

  ipcMain.handle(IPC_CHANNELS.UPDATER_GET_STATUS, () =>
    handleIpc(async () => updaterService.getUpdaterStatus()),
  );
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, () =>
    handleIpc(async () => updaterService.checkForUpdates()),
  );
  ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD, () =>
    handleIpc(async () => updaterService.downloadUpdate()),
  );
  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, () =>
    handleIpc(async () => updaterService.installUpdate()),
  );
}
