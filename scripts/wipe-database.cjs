/**
 * Limpa todos os dados do banco local do ControlOne,
 * incluindo o cadastro do negócio (volta ao onboarding).
 *
 * Uso: npm run wipe
 * Fecha o app antes de rodar.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const os = require('os');

function resolveDbPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const candidates = [
    path.join(appData, 'controlone', 'controlone', 'controlone.db'),
    path.join(appData, 'controlone', 'controlone', 'cleide-pratas.db'),
    path.join(appData, 'ControlOne', 'controlone', 'controlone.db'),
    path.join(appData, 'cleide-pratas', 'cleide-pratas', 'cleide-pratas.db'),
  ];

  if (process.env.SEED_DB_PATH) {
    return process.env.SEED_DB_PATH;
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  if (process.env.DATABASE_URL?.startsWith('file:')) {
    const fromEnv = process.env.DATABASE_URL.replace(/^file:/, '');
    const absolute = path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv);
    if (fs.existsSync(absolute)) return absolute;
  }

  return candidates[0];
}

async function main() {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    console.error('Banco não encontrado em:', dbPath);
    process.exit(1);
  }

  const url = `file:${dbPath.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = url;
  console.log('Limpando banco:', dbPath);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$connect();

    await prisma.saleItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.service.deleteMany();
    await prisma.serviceCatalog.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.product.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.category.deleteMany();

    await prisma.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        storeName: '',
        businessType: null,
        storePhone: null,
        storeEmail: null,
        storeAddress: null,
        logoPath: null,
        defaultMinStock: 5,
        backupFolder: null,
        theme: 'light',
        onboardingCompleted: false,
      },
      update: {
        storeName: '',
        businessType: null,
        storePhone: null,
        storeEmail: null,
        storeAddress: null,
        logoPath: null,
        defaultMinStock: 5,
        backupFolder: null,
        theme: 'light',
        onboardingCompleted: false,
      },
    });

    console.log('Banco limpo com sucesso.');
    console.log('Negócio removido — o onboarding será exibido na próxima abertura.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha ao limpar o banco:', error.message || error);
  if (String(error.message || error).includes('EPERM') || String(error).includes('busy')) {
    console.error('Feche o ControlOne antes de rodar o wipe.');
  }
  process.exit(1);
});
