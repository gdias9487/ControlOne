import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { getDatabasePath } from '../utils/paths';

let prisma: PrismaClient | null = null;

function configurePrismaEnginePath(): void {
  if (!app.isPackaged) return;

  const candidates = [
    path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '.prisma',
      'client',
      'query_engine-windows.dll.node',
    ),
    path.join(process.resourcesPath, 'prisma-client', 'query_engine-windows.dll.node'),
  ];

  for (const enginePath of candidates) {
    if (fs.existsSync(enginePath)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
      return;
    }
  }
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Banco de dados ainda não foi inicializado.');
  }
  return prisma;
}

export async function initDatabase(): Promise<PrismaClient> {
  configurePrismaEnginePath();

  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const url = `file:${dbPath.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = url;

  prisma = new PrismaClient({
    datasources: {
      db: { url },
    },
  });

  await prisma.$connect();
  await ensureSchema(prisma);
  await seedDefaults(prisma);
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

async function ensureSchema(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Category" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Customer" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Product" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "internalCode" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "photoPath" TEXT,
      "cost" DECIMAL NOT NULL,
      "salePrice" DECIMAL NOT NULL,
      "profitMargin" DECIMAL NOT NULL,
      "stockQuantity" INTEGER NOT NULL DEFAULT 0,
      "minStock" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    );
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Sale" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "saleNumber" TEXT NOT NULL UNIQUE,
      "customerId" TEXT,
      "discount" DECIMAL NOT NULL DEFAULT 0,
      "subtotal" DECIMAL NOT NULL,
      "total" DECIMAL NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'COMPLETED',
      "notes" TEXT,
      "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    );
  `);

  await ensureColumn(client, 'Sale', 'customerId', 'TEXT');
  await ensureColumn(client, 'Sale', 'fiadoPaidAt', 'DATETIME');
  await ensureColumn(client, 'Sale', 'fiadoPaidAmount', 'DECIMAL NOT NULL DEFAULT 0');

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SaleItem" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "saleId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "productName" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitPrice" DECIMAL NOT NULL,
      "unitCost" DECIMAL NOT NULL,
      "discountPercent" DECIMAL NOT NULL DEFAULT 0,
      "subtotal" DECIMAL NOT NULL,
      FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE,
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
    );
  `);
  await ensureColumn(client, 'SaleItem', 'discountPercent', 'DECIMAL NOT NULL DEFAULT 0');

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ServiceCatalog" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "cost" DECIMAL NOT NULL DEFAULT 0,
      "amount" DECIMAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Service" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "amount" DECIMAL NOT NULL,
      "cost" DECIMAL NOT NULL DEFAULT 0,
      "paymentMethod" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'COMPLETED',
      "notes" TEXT,
      "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await ensureColumn(client, 'Service', 'catalogId', 'TEXT');
  await ensureColumn(client, 'Service', 'customerId', 'TEXT');
  await ensureColumn(client, 'Service', 'fiadoPaidAt', 'DATETIME');
  await ensureColumn(client, 'Service', 'fiadoPaidAmount', 'DECIMAL NOT NULL DEFAULT 0');

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InventoryMovement" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "productId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "reason" TEXT,
      "notes" TEXT,
      "previousStock" INTEGER NOT NULL,
      "resultingStock" INTEGER NOT NULL,
      "allowNegative" BOOLEAN NOT NULL DEFAULT false,
      "saleId" TEXT,
      "movedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
    );
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RecurringExpense" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "description" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "amount" DECIMAL NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "dayOfMonth" INTEGER NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Expense" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "description" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "amount" DECIMAL NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "notes" TEXT,
      "expenseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await ensureColumn(client, 'Expense', 'recurringExpenseId', 'TEXT');

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Settings" (
      "id" TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
      "storeName" TEXT NOT NULL DEFAULT '',
      "storePhone" TEXT,
      "storeEmail" TEXT,
      "storeAddress" TEXT,
      "logoPath" TEXT,
      "defaultMinStock" INTEGER NOT NULL DEFAULT 5,
      "backupFolder" TEXT,
      "theme" TEXT NOT NULL DEFAULT 'light',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await ensureColumn(client, 'Settings', 'businessType', 'TEXT');
  // Instalações existentes recebem true e não passam pelo onboarding de novo
  await ensureColumn(client, 'Settings', 'onboardingCompleted', 'BOOLEAN NOT NULL DEFAULT 1');
}

async function ensureColumn(
  client: PrismaClient,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const rows = await client.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("${table}")`,
  );
  const exists = rows.some((row) => row.name === column);
  if (!exists) {
    await client.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`,
    );
  }
}

async function seedDefaults(client: PrismaClient): Promise<void> {
  const settings = await client.settings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    await client.settings.create({
      data: {
        id: 'default',
        storeName: '',
        defaultMinStock: 5,
        theme: 'light',
        onboardingCompleted: false,
      },
    });
  }

  const categoryCount = await client.category.count();
  if (categoryCount === 0) {
    await client.category.createMany({
      data: [
        { name: 'Geral', description: 'Categoria padrão' },
        { name: 'Destaques', description: 'Itens em destaque' },
        { name: 'Outros', description: 'Demais itens' },
      ],
    });
  }
}
