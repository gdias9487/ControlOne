/**
 * Lança vendas/serviços reais (jul/2026) com clientes e catálogo sob demanda.
 *
 * - Cria cliente se não existir (busca por nome, case-insensitive)
 * - Cria categoria/produto se não existir
 * - Cria serviço no catálogo se não existir
 * - Idempotente: pula lançamentos já importados (marca em notes)
 *
 * Uso: npm run seed:sales
 * Fecha o app antes de rodar (SQLite trava se estiver aberto).
 *
 * Obs.: "Adriel 15 soldas" não veio com valor unitário — use SOLDA_UNIT_PRICE abaixo.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const os = require('os');

/** Preço unitário da solda quando a lista só informa a quantidade. */
const SOLDA_UNIT_PRICE = 5;

const IMPORT_TAG = '[import:jul2026-vendas]';

function resolveDbPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const candidates = [
    path.join(appData, 'controlone', 'controlone', 'controlone.db'),
    path.join(appData, 'controlone', 'controlone', 'cleide-pratas.db'),
    path.join(appData, 'ControlOne', 'controlone', 'controlone.db'),
    path.join(appData, 'cleide-pratas', 'cleide-pratas', 'cleide-pratas.db'),
  ];

  if (process.env.SEED_DB_PATH) return process.env.SEED_DB_PATH;

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

function money(n) {
  return Number(n).toFixed(2);
}

function margin(cost, price) {
  const c = Number(cost);
  const p = Number(price);
  if (c === 0) return p === 0 ? '0.00' : '100.00';
  return (((p - c) / c) * 100).toFixed(2);
}

/** Data local (ano-mês-dia) ao meio-dia para evitar virar dia por fuso. */
function atDate(year, month1to12, day, hour = 12, minute = 0) {
  return new Date(year, month1to12 - 1, day, hour, minute, 0, 0);
}

function importKey(key) {
  return `${IMPORT_TAG} ${key}`;
}

async function ensureColumn(prisma, table, column, sqlType) {
  const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  if (!cols.some((c) => c.name === column)) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN "${column}" ${sqlType}`,
    );
  }
}

async function ensureSchema(prisma) {
  await ensureColumn(prisma, 'Sale', 'customerId', 'TEXT');
  await ensureColumn(prisma, 'Sale', 'fiadoPaidAt', 'DATETIME');
  await ensureColumn(prisma, 'Sale', 'fiadoPaidAmount', 'DECIMAL NOT NULL DEFAULT 0');
  await ensureColumn(prisma, 'Service', 'catalogId', 'TEXT');
  await ensureColumn(prisma, 'Service', 'customerId', 'TEXT');
  await ensureColumn(prisma, 'Service', 'fiadoPaidAt', 'DATETIME');
  await ensureColumn(prisma, 'Service', 'fiadoPaidAmount', 'DECIMAL NOT NULL DEFAULT 0');
}

async function ensureCustomer(prisma, name) {
  const existing = await prisma.customer.findFirst({
    where: { name: { equals: name } },
  });
  if (existing) return existing;

  // SQLite: equals é case-sensitive; tenta match ignore-case manual
  const all = await prisma.customer.findMany({ select: { id: true, name: true } });
  const found = all.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (found) return prisma.customer.findUnique({ where: { id: found.id } });

  const created = await prisma.customer.create({ data: { name: name.trim() } });
  console.log(`  Cliente criado: ${created.name}`);
  return created;
}

async function ensureCategory(prisma, name) {
  let category = await prisma.category.findUnique({ where: { name } });
  if (category) return category;
  category = await prisma.category.create({
    data: { name, description: `Criada automaticamente (${IMPORT_TAG})` },
  });
  console.log(`  Categoria criada: ${name}`);
  return category;
}

function productCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function ensureProduct(prisma, { name, category, salePrice, cost = '0.00' }) {
  const active = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      cost: true,
      salePrice: true,
      stockQuantity: true,
      categoryId: true,
      internalCode: true,
    },
  });
  const existingMeta = active.find(
    (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const existing = existingMeta
    ? await prisma.product.findUnique({ where: { id: existingMeta.id } })
    : null;

  if (existing) {
    if (Number(existing.salePrice.toString()) === 0 && Number(salePrice) > 0) {
      return prisma.product.update({
        where: { id: existing.id },
        data: {
          salePrice: money(salePrice),
          profitMargin: margin(existing.cost.toString(), salePrice),
        },
      });
    }
    return existing;
  }

  const cat = await ensureCategory(prisma, category);
  const created = await prisma.product.create({
    data: {
      name,
      categoryId: cat.id,
      internalCode: productCode('IMP'),
      description: name,
      cost: money(cost),
      salePrice: money(salePrice),
      profitMargin: margin(cost, salePrice),
      stockQuantity: 0,
      minStock: 0,
      status: 'ACTIVE',
    },
  });
  console.log(`  Produto criado: ${name} (${category}) — R$ ${money(salePrice)}`);
  return created;
}

async function ensureServiceCatalog(prisma, { name, amount, cost = '0.00', description }) {
  const existing = await prisma.serviceCatalog.findFirst({
    where: { name: { equals: name } },
  });
  if (existing) {
    if (Number(existing.amount.toString()) === 0 && Number(amount) > 0) {
      return prisma.serviceCatalog.update({
        where: { id: existing.id },
        data: { amount: money(amount), cost: money(cost) },
      });
    }
    return existing;
  }
  const created = await prisma.serviceCatalog.create({
    data: {
      name,
      description: description || name,
      amount: money(amount),
      cost: money(cost),
      status: 'ACTIVE',
    },
  });
  console.log(`  Serviço catálogo criado: ${name} — R$ ${money(amount)}`);
  return created;
}

async function alreadyImported(prisma, key) {
  const notes = importKey(key);
  const sale = await prisma.sale.findFirst({ where: { notes: { contains: key } } });
  if (sale) return true;
  const service = await prisma.service.findFirst({ where: { notes: { contains: key } } });
  return Boolean(service);
}

async function nextSaleNumber(prisma) {
  const count = await prisma.sale.count();
  const year = new Date().getFullYear();
  return `VD-${year}-${String(count + 1).padStart(5, '0')}`;
}

async function sellProductLine(prisma, product, quantity, unitPrice, soldAt) {
  const qty = quantity;
  const price = money(unitPrice);
  const cost = money(product.cost.toString());
  const line = money(Number(price) * qty);

  let previousStock = product.stockQuantity;
  if (previousStock < qty) {
    const entryQty = qty - previousStock;
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQuantity: previousStock + entryQty },
    });
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: 'ENTRY',
        quantity: entryQty,
        reason: `Entrada automática ${IMPORT_TAG}`,
        previousStock,
        resultingStock: previousStock + entryQty,
        movedAt: soldAt,
      },
    });
    previousStock += entryQty;
    product = await prisma.product.findUnique({ where: { id: product.id } });
  }

  const resultingStock = previousStock - qty;
  await prisma.product.update({
    where: { id: product.id },
    data: { stockQuantity: resultingStock },
  });

  return {
    product,
    quantity: qty,
    unitPrice: price,
    unitCost: cost,
    subtotal: line,
    previousStock,
    resultingStock,
  };
}

async function createSale(prisma, {
  key,
  customer,
  soldAt,
  paymentMethod,
  items,
  fiadoPaidAmount = '0.00',
  notesExtra = '',
}) {
  if (await alreadyImported(prisma, key)) {
    console.log(`  (já importado) ${key}`);
    return null;
  }

  const prepared = [];
  let subtotal = 0;
  for (const item of items) {
    const product = await ensureProduct(prisma, item);
    const line = await sellProductLine(
      prisma,
      product,
      item.quantity ?? 1,
      item.salePrice,
      soldAt,
    );
    prepared.push(line);
    subtotal += Number(line.subtotal);
  }

  const total = money(subtotal);
  const paid = money(fiadoPaidAmount);
  const fullyPaidFiado =
    paymentMethod === 'FIADO' && Number(paid) >= Number(total) && Number(total) > 0;

  const saleNumber = await nextSaleNumber(prisma);
  const sale = await prisma.sale.create({
    data: {
      saleNumber,
      customerId: customer.id,
      discount: '0.00',
      subtotal: total,
      total,
      paymentMethod,
      status: 'COMPLETED',
      fiadoPaidAmount: paymentMethod === 'FIADO' ? paid : '0.00',
      fiadoPaidAt: fullyPaidFiado ? soldAt : null,
      notes: `${importKey(key)}${notesExtra ? ` | ${notesExtra}` : ''}`,
      soldAt,
      items: {
        create: prepared.map((line) => ({
          productId: line.product.id,
          productName: line.product.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
          subtotal: line.subtotal,
        })),
      },
    },
  });

  for (const line of prepared) {
    await prisma.inventoryMovement.create({
      data: {
        productId: line.product.id,
        type: 'SALE',
        quantity: line.quantity,
        reason: `Venda ${saleNumber}`,
        previousStock: line.previousStock,
        resultingStock: line.resultingStock,
        saleId: sale.id,
        movedAt: soldAt,
      },
    });
  }

  console.log(
    `  Venda ${saleNumber}: ${customer.name} — R$ ${total}` +
      (paymentMethod === 'FIADO' ? ` (fiado, PG ${paid})` : ''),
  );
  return sale;
}

async function createService(prisma, {
  key,
  customer,
  performedAt,
  paymentMethod,
  catalogName,
  amount,
  cost = '0.00',
  description,
  fiadoPaidAmount = '0.00',
  notesExtra = '',
}) {
  if (await alreadyImported(prisma, key)) {
    console.log(`  (já importado) ${key}`);
    return null;
  }

  const catalog = await ensureServiceCatalog(prisma, {
    name: catalogName,
    amount,
    cost,
    description,
  });

  const total = money(amount);
  const paid = money(fiadoPaidAmount);
  const fullyPaidFiado =
    paymentMethod === 'FIADO' && Number(paid) >= Number(total) && Number(total) > 0;

  const service = await prisma.service.create({
    data: {
      catalogId: catalog.id,
      customerId: customer.id,
      name: catalog.name,
      description: description || catalog.description,
      amount: total,
      cost: money(cost),
      paymentMethod,
      status: 'COMPLETED',
      fiadoPaidAmount: paymentMethod === 'FIADO' ? paid : '0.00',
      fiadoPaidAt: fullyPaidFiado ? performedAt : null,
      notes: `${importKey(key)}${notesExtra ? ` | ${notesExtra}` : ''}`,
      performedAt,
    },
  });

  console.log(
    `  Serviço: ${customer.name} — ${catalog.name} R$ ${total}` +
      (paymentMethod === 'FIADO' ? ` (fiado, PG ${paid})` : ''),
  );
  return service;
}

async function main() {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    console.error('Banco não encontrado em:', dbPath);
    console.error('Abra o ControlOne uma vez (npm run dev) e tente de novo.');
    process.exit(1);
  }

  const url = `file:${dbPath.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = url;
  console.log('Usando banco:', dbPath);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$connect();
    await ensureSchema(prisma);

    console.log('\n=== Suelise / Onco — 10/07/2026 (total 410, PG 85) ===');
    const suelise = await ensureCustomer(prisma, 'Suelise / Onco');
    const sueliseDate = atDate(2026, 7, 10, 11, 0);

    // Produtos 180 + fiado com PG 85; piercing Helix/Trágus fiado aberto
    await createSale(prisma, {
      key: 'suelise-produtos-2026-07-10',
      customer: suelise,
      soldAt: sueliseDate,
      paymentMethod: 'FIADO',
      fiadoPaidAmount: '85.00',
      notesExtra: 'Total geral 410 (produtos+piercing); PG 85 lançado nesta venda',
      items: [
        {
          name: 'Conjunto vermelho',
          category: 'Conjuntos',
          salePrice: 150,
          quantity: 1,
        },
        {
          name: 'Anel de dedo de pé',
          category: 'Anéis',
          salePrice: 30,
          quantity: 1,
        },
      ],
    });

    await createService(prisma, {
      key: 'suelise-helix-2026-07-10',
      customer: suelise,
      performedAt: sueliseDate,
      paymentMethod: 'FIADO',
      catalogName: 'Piercing Helix',
      amount: 150,
      cost: '18.00',
      description: 'Colocação de piercing no Helix',
      fiadoPaidAmount: '0.00',
      notesExtra: 'Parte do atendimento Suelise (total 410)',
    });

    await createService(prisma, {
      key: 'suelise-tragus-2026-07-10',
      customer: suelise,
      performedAt: atDate(2026, 7, 10, 11, 15),
      paymentMethod: 'FIADO',
      catalogName: 'Piercing Trágus',
      amount: 80,
      cost: '20.00',
      description: 'Colocação de piercing no Trágus',
      fiadoPaidAmount: '0.00',
      notesExtra: 'Parte do atendimento Suelise (total 410)',
    });

    console.log('\n=== 31/07/2026 ===');
    const day31 = atDate(2026, 7, 31, 14, 0);

    const adriel = await ensureCustomer(prisma, 'Adriel');
    const soldaTotal = money(15 * SOLDA_UNIT_PRICE);
    await createService(prisma, {
      key: 'adriel-15-soldas-2026-07-31',
      customer: adriel,
      performedAt: day31,
      paymentMethod: 'PIX',
      catalogName: 'Solda',
      amount: soldaTotal,
      cost: '0.00',
      description: `15 soldas × R$ ${money(SOLDA_UNIT_PRICE)}`,
      notesExtra: `Quantidade 15; unitário configurável no script (SOLDA_UNIT_PRICE=${SOLDA_UNIT_PRICE})`,
    });

    const paraiba = await ensureCustomer(prisma, 'Paraíba Center');
    await createSale(prisma, {
      key: 'paraiba-center-2026-07-31',
      customer: paraiba,
      soldAt: atDate(2026, 7, 31, 15, 0),
      paymentMethod: 'PIX',
      items: [
        {
          name: 'Venda Paraíba Center',
          category: 'Atacado',
          salePrice: 250,
          quantity: 1,
        },
      ],
    });

    const gg = await ensureCustomer(prisma, 'GG FOLHEADOS');
    await createSale(prisma, {
      key: 'gg-folheados-2026-07-31',
      customer: gg,
      soldAt: atDate(2026, 7, 31, 16, 0),
      paymentMethod: 'PIX',
      items: [
        {
          name: 'Venda GG FOLHEADOS',
          category: 'Atacado',
          salePrice: 239,
          quantity: 1,
        },
      ],
    });

    console.log('\n=== Ingrid — 30/07/2026 (total 242) ===');
    const ingrid = await ensureCustomer(prisma, 'Ingrid');
    const ingridDate = atDate(2026, 7, 30, 11, 0);
    await createSale(prisma, {
      key: 'ingrid-2026-07-30',
      customer: ingrid,
      soldAt: ingridDate,
      paymentMethod: 'PIX',
      items: [
        {
          name: 'Argola Rommanel',
          category: 'Argolas',
          salePrice: 101,
          quantity: 1,
        },
        {
          name: 'Brinco fé',
          category: 'Brincos',
          salePrice: 71,
          quantity: 1,
        },
        {
          name: 'Argola em titânio',
          category: 'Argolas',
          salePrice: 70,
          quantity: 1,
        },
      ],
    });

    console.log('\n=== Kiwi — 30/07/2026 (520) ===');
    const kiwi = await ensureCustomer(prisma, 'Kiwi');
    await createSale(prisma, {
      key: 'kiwi-2026-07-30',
      customer: kiwi,
      soldAt: atDate(2026, 7, 30, 16, 0),
      paymentMethod: 'PIX',
      items: [
        {
          name: 'Compra Kiwi',
          category: 'Diversos',
          salePrice: 520,
          quantity: 1,
        },
      ],
      notesExtra: 'Valor total informado sem detalhamento de itens',
    });

    console.log('\nImportação concluída.');
    console.log(
      `Obs.: soldas do Adriel usaram R$ ${money(SOLDA_UNIT_PRICE)} cada (total R$ ${money(15 * SOLDA_UNIT_PRICE)}).`,
    );
    console.log('Se o valor unitário for outro, ajuste SOLDA_UNIT_PRICE e rode de novo após apagar o lançamento.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha na importação:', error.message || error);
  if (String(error.message || error).includes('EPERM') || String(error).includes('busy')) {
    console.error('Feche o ControlOne antes de rodar o script.');
  }
  process.exit(1);
});
