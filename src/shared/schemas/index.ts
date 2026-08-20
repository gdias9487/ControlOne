import { z } from 'zod';

export const paymentMethodSchema = z.enum([
  'PIX',
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'OTHER',
  'FIADO',
]);

export const saleStatusSchema = z.enum(['COMPLETED', 'CANCELLED']);
export const serviceStatusSchema = z.enum(['COMPLETED', 'CANCELLED']);
export const productStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const inventoryMovementTypeSchema = z.enum([
  'ENTRY',
  'EXIT',
  'LOSS',
  'ADJUSTMENT',
  'RETURN',
  'SALE',
]);

export const expenseCategorySchema = z.enum([
  'MERCHANDISE',
  'PACKAGING',
  'TRANSPORT',
  'FEES',
  'MAINTENANCE',
  'OTHER',
]);

export const periodPresetSchema = z.enum([
  'TODAY',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'CURRENT_MONTH',
  'CURRENT_YEAR',
  'CUSTOM',
]);

export const moneyStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Valor monetário inválido');

export const percentStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Porcentagem inválida')
  .refine((value) => {
    const n = Number(value);
    return n >= 0 && n <= 100;
  }, 'Porcentagem deve ser entre 0 e 100');

export const dateRangeSchema = z.object({
  preset: periodPresetSchema,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100),
  description: z.string().trim().max(500).optional().nullable(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(200),
});

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(200),
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  internalCode: z.string().trim().min(1, 'Código obrigatório').max(50),
  description: z.string().trim().max(2000).optional().nullable(),
  photoPath: z.string().optional().nullable(),
  cost: moneyStringSchema,
  salePrice: moneyStringSchema,
  stockQuantity: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  status: productStatusSchema.default('ACTIVE'),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const productListFiltersSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  status: productStatusSchema.optional(),
  sortBy: z.enum(['name', 'stock', 'price', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const salesListSortSchema = z.enum([
  'newest',
  'oldest',
  'amount_desc',
  'amount_asc',
]);

export const salesListStatusFilterSchema = z.enum([
  'COMPLETED',
  'CANCELLED',
  'FIADO_OPEN',
]);

export const salesListFiltersSchema = z.object({
  search: z.string().optional(),
  customerName: z.string().optional(),
  code: z.string().optional(),
  status: salesListStatusFilterSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sort: salesListSortSchema.default('newest'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const servicesListFiltersSchema = salesListFiltersSchema;

export const inventoryListTypeFilterSchema = z.enum([
  'ENTRY',
  'EXIT',
  'LOSS',
  'ADJUSTMENT',
  'RETURN',
  'SALE',
]);

export const inventoryListFiltersSchema = z.object({
  search: z.string().optional(),
  productId: z.string().optional(),
  type: inventoryListTypeFilterSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const inventoryManualTypeSchema = z.enum([
  'ENTRY',
  'EXIT',
  'LOSS',
  'ADJUSTMENT',
  'RETURN',
]);

export const inventoryCreateSchema = z.object({
  productId: z.string().min(1),
  type: inventoryManualTypeSchema,
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  reason: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  allowNegative: z.boolean().default(false),
  movedAt: z.string().datetime().optional(),
});

export const saleItemInputSchema = z
  .object({
    productId: z.string().min(1).optional().nullable(),
    /** Nome livre para venda avulsa (sem cadastro / sem estoque). */
    productName: z.string().trim().min(1).max(200).optional().nullable(),
    quantity: z.number().int().positive(),
    unitPrice: moneyStringSchema.optional(),
    discountPercent: percentStringSchema.default('0'),
  })
  .superRefine((data, ctx) => {
    const hasProduct = Boolean(data.productId);
    const hasAdHocName = Boolean(data.productName?.trim());
    if (!hasProduct && !hasAdHocName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione um produto ou informe um nome para venda avulsa.',
        path: ['productId'],
      });
    }
    if (!hasProduct && hasAdHocName && data.unitPrice == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o valor do item avulso.',
        path: ['unitPrice'],
      });
    }
  });

export const saleCreateSchema = z
  .object({
    items: z.array(saleItemInputSchema).min(1, 'Adicione ao menos um produto'),
    discountPercent: percentStringSchema.default('0'),
    paymentMethod: paymentMethodSchema,
    customerId: z.string().min(1).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    soldAt: z.string().datetime().optional(),
    allowNegativeStock: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === 'FIADO' && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione o cliente para venda fiada.',
        path: ['customerId'],
      });
    }
  });

export const settleFiadoSchema = z.object({
  id: z.string().min(1),
  amount: moneyStringSchema,
});

export const serviceBaseSchema = z.object({
  catalogId: z.string().min(1).optional().nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  amount: moneyStringSchema,
  cost: moneyStringSchema.default('0'),
  discountPercent: percentStringSchema.default('0'),
  paymentMethod: paymentMethodSchema,
  customerId: z.string().min(1).optional().nullable(),
  status: serviceStatusSchema.default('COMPLETED'),
  notes: z.string().trim().max(1000).optional().nullable(),
  performedAt: z.string().datetime().optional(),
});

export const serviceCreateSchema = serviceBaseSchema.superRefine((data, ctx) => {
  if (data.paymentMethod === 'FIADO' && !data.customerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione o cliente para serviço fiado.',
      path: ['customerId'],
    });
  }
});

export const serviceUpdateSchema = serviceBaseSchema.partial().extend({
  id: z.string().min(1),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'FIADO' && data.customerId === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione o cliente para serviço fiado.',
      path: ['customerId'],
    });
  }
});

export const serviceCatalogCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  cost: moneyStringSchema.default('0'),
  amount: moneyStringSchema,
  status: productStatusSchema.default('ACTIVE'),
});

export const serviceCatalogUpdateSchema = serviceCatalogCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const serviceCatalogListFiltersSchema = z.object({
  search: z.string().optional(),
  status: productStatusSchema.optional(),
  sortBy: z.enum(['name', 'cost', 'amount', 'margin']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const expenseCreateSchema = z.object({
  description: z.string().trim().min(1).max(300),
  category: expenseCategorySchema,
  amount: moneyStringSchema,
  paymentMethod: paymentMethodSchema,
  notes: z.string().trim().max(1000).optional().nullable(),
  expenseDate: z.string().datetime().optional(),
  recurringExpenseId: z.string().min(1).optional().nullable(),
});

export const expenseUpdateSchema = expenseCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const recurringExpenseCreateSchema = z.object({
  description: z.string().trim().min(1).max(300),
  category: expenseCategorySchema,
  amount: moneyStringSchema,
  paymentMethod: paymentMethodSchema,
  dayOfMonth: z.number().int().min(1).max(28),
  active: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const recurringExpenseUpdateSchema = recurringExpenseCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const recurringExpenseConfirmSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        amount: moneyStringSchema.optional(),
        expenseDate: z.string().datetime().optional(),
        updateTemplateAmount: z.boolean().optional(),
      }),
    )
    .min(1),
});

export const settingsUpdateSchema = z.object({
  storeName: z.string().trim().min(1).max(200).optional(),
  businessType: z.string().trim().max(100).optional().nullable(),
  storePhone: z.string().trim().max(50).optional().nullable(),
  storeEmail: z.string().trim().email().optional().nullable().or(z.literal('')),
  storeAddress: z.string().trim().max(500).optional().nullable(),
  logoPath: z.string().optional().nullable(),
  defaultMinStock: z.number().int().min(0).optional(),
  backupFolder: z.string().optional().nullable(),
  theme: z.enum(['light', 'dark']).optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const onboardingSchema = z.object({
  storeName: z.string().trim().min(1, 'Informe o nome do negócio').max(200),
  businessType: z.string().trim().max(100).optional().nullable(),
  storePhone: z.string().trim().max(50).optional().nullable(),
  storeEmail: z.string().trim().email('E-mail inválido').optional().nullable().or(z.literal('')),
  storeAddress: z.string().trim().max(500).optional().nullable(),
  logoPath: z.string().optional().nullable(),
});

export const reportFiltersSchema = z.object({
  preset: periodPresetSchema.default('CURRENT_MONTH'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  reportType: z
    .enum([
      'DAILY_REVENUE',
      'MONTHLY_REVENUE',
      'MONTHLY_EXPENSES',
      'TOP_PRODUCTS',
      'STALE_PRODUCTS',
      'PAYMENT_METHODS',
      'INVENTORY_HISTORY',
      'STOCK_VALUE',
      'PRODUCT_MARGINS',
      'SERVICE_REVENUE',
    ])
    .default('MONTHLY_REVENUE'),
});

export type CategoryCreateInput = z.input<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.input<typeof categoryUpdateSchema>;
export type CustomerCreateInput = z.input<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.input<typeof customerUpdateSchema>;
export type ProductCreateInput = z.input<typeof productCreateSchema>;
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;
export type ProductListFilters = z.input<typeof productListFiltersSchema>;
export type SalesListFilters = z.input<typeof salesListFiltersSchema>;
export type ServicesListFilters = z.input<typeof servicesListFiltersSchema>;
export type InventoryListFilters = z.input<typeof inventoryListFiltersSchema>;
export type InventoryCreateInput = z.input<typeof inventoryCreateSchema>;
export type SaleCreateInput = z.input<typeof saleCreateSchema>;
export type SettleFiadoInput = z.input<typeof settleFiadoSchema>;
export type ServiceCreateInput = z.input<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.input<typeof serviceUpdateSchema>;
export type ServiceCatalogCreateInput = z.input<typeof serviceCatalogCreateSchema>;
export type ServiceCatalogUpdateInput = z.input<typeof serviceCatalogUpdateSchema>;
export type ServiceCatalogListFilters = z.input<typeof serviceCatalogListFiltersSchema>;
export type ExpenseCreateInput = z.input<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.input<typeof expenseUpdateSchema>;
export type RecurringExpenseCreateInput = z.input<typeof recurringExpenseCreateSchema>;
export type RecurringExpenseUpdateInput = z.input<typeof recurringExpenseUpdateSchema>;
export type RecurringExpenseConfirmInput = z.input<typeof recurringExpenseConfirmSchema>;
export type SettingsUpdateInput = z.input<typeof settingsUpdateSchema>;
export type OnboardingInput = z.input<typeof onboardingSchema>;
export type DateRangeInput = z.input<typeof dateRangeSchema>;
export type ReportFiltersInput = z.input<typeof reportFiltersSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type SaleStatus = z.infer<typeof saleStatusSchema>;
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>;
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type PeriodPreset = z.infer<typeof periodPresetSchema>;
export type SalesListSort = z.infer<typeof salesListSortSchema>;
export type SalesListStatusFilter = z.infer<typeof salesListStatusFilterSchema>;