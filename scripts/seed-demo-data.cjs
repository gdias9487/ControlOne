/**
 * Popula o banco local do ControlOne com o negócio Cleide Pratas
 * e dados fictícios de 12 meses (ano atual).
 * Uso: npm run seed
 *
 * Fecha o app antes de rodar (o SQLite trava se estiver aberto).
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const os = require('os');

const YEAR = new Date().getFullYear();

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

function money(n) {
  return Number(n).toFixed(2);
}

function margin(cost, price) {
  const c = Number(cost);
  const p = Number(price);
  if (c === 0) return p === 0 ? '0.00' : '100.00';
  return (((p - c) / c) * 100).toFixed(2);
}

function day(month, dayOfMonth, hour = 10, minute = 0) {
  return new Date(YEAR, month, dayOfMonth, hour, minute, 0, 0);
}

function pick(arr, index) {
  return arr[index % arr.length];
}

async function ensureCustomerTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Customer" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Sale")`);
  const hasCustomer = cols.some((c) => c.name === 'customerId');
  if (!hasCustomer) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN "customerId" TEXT`);
  }
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
    await ensureCustomerTable(prisma);

    console.log('Limpando dados anteriores...');
    await prisma.saleItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.service.deleteMany();
    if (prisma.serviceCatalog) {
      await prisma.serviceCatalog.deleteMany();
    }
    await prisma.expense.deleteMany();
    await prisma.product.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.category.deleteMany();

    console.log('Configurando negócio Cleide Pratas...');
    await prisma.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        storeName: 'Cleide Pratas',
        businessType: 'Joias e acessórios',
        storePhone: null,
        storeEmail: null,
        storeAddress: null,
        logoPath: null,
        defaultMinStock: 5,
        backupFolder: null,
        theme: 'light',
        onboardingCompleted: true,
      },
      update: {
        storeName: 'Cleide Pratas',
        businessType: 'Joias e acessórios',
        onboardingCompleted: true,
      },
    });

    console.log('Criando categorias...');
    const categoryNames = [
      { name: 'Anéis', description: 'Anéis de prata e joias' },
      { name: 'Colares', description: 'Colares e correntes' },
      { name: 'Brincos', description: 'Brincos e argolas' },
      { name: 'Pulseiras', description: 'Pulseiras e braceletes' },
      { name: 'Pingentes', description: 'Pingentes e berloques' },
      { name: 'Outros', description: 'Demais produtos' },
    ];
    const categories = [];
    for (const cat of categoryNames) {
      categories.push(await prisma.category.create({ data: cat }));
    }

    console.log('Criando catálogo de serviços...');
    const serviceCatalogDefs = [
      { name: 'Furo de orelha (lóbulo)', description: 'Piercing no lóbulo da orelha', amount: '50.00', cost: '12.00' },
      { name: 'Furo de orelha (hélix)', description: 'Piercing na cartilagem hélix', amount: '80.00', cost: '18.00' },
      { name: 'Furo de orelha (tragus)', description: 'Piercing no tragus', amount: '90.00', cost: '20.00' },
      { name: 'Furo de orelha (conch)', description: 'Piercing no conch', amount: '100.00', cost: '22.00' },
      { name: 'Furo de nariz (nostril)', description: 'Piercing na asa do nariz', amount: '70.00', cost: '15.00' },
      { name: 'Furo de septo', description: 'Piercing no septo nasal', amount: '120.00', cost: '25.00' },
      { name: 'Furo de sobrancelha', description: 'Piercing na sobrancelha', amount: '90.00', cost: '18.00' },
      { name: 'Furo de umbigo', description: 'Piercing no umbigo', amount: '110.00', cost: '24.00' },
      { name: 'Troca de piercing', description: 'Troca de joia em piercing já cicatrizado', amount: '25.00', cost: '5.00' },
      { name: 'Orientação e higiene', description: 'Consulta de cuidados pós-piercing', amount: '30.00', cost: '5.00' },
    ];
    const serviceCatalogs = [];
    for (const item of serviceCatalogDefs) {
      serviceCatalogs.push(await prisma.serviceCatalog.create({ data: { ...item, status: 'ACTIVE' } }));
    }

    console.log('Criando clientes...');
    const customerNames = [
      'Maria Silva',
      'Ana Souza',
      'Juliana Costa',
      'Fernanda Lima',
      'Patrícia Alves',
      'Camila Rocha',
      'Beatriz Mendes',
      'Larissa Nunes',
      'Renata Dias',
      'Carla Ferreira',
      'Bruno Oliveira',
      'Ricardo Santos',
    ];
    const customers = [];
    for (const name of customerNames) {
      customers.push(await prisma.customer.create({ data: { name } }));
    }

    console.log('Criando produtos...');
    const productDefs = [
      { name: 'Anel Solitário Prata 925', code: 'AN-001', cost: '45.00', price: '89.90', stock: 28, cat: 0 },
      { name: 'Anel Aparador Cravejado', code: 'AN-002', cost: '62.00', price: '129.90', stock: 18, cat: 0 },
      { name: 'Anel Falange Delicado', code: 'AN-003', cost: '22.00', price: '49.90', stock: 40, cat: 0 },
      { name: 'Colar Elo Português 45cm', code: 'CO-001', cost: '78.00', price: '159.90', stock: 15, cat: 1 },
      { name: 'Corrente Veneziana 50cm', code: 'CO-002', cost: '55.00', price: '119.90', stock: 22, cat: 1 },
      { name: 'Choker Prata Lisa', code: 'CO-003', cost: '35.00', price: '79.90', stock: 12, cat: 1 },
      { name: 'Brinco Argola Média', code: 'BR-001', cost: '28.00', price: '64.90', stock: 35, cat: 2 },
      { name: 'Brinco Ponto de Luz', code: 'BR-002', cost: '18.00', price: '39.90', stock: 50, cat: 2 },
      { name: 'Brinco Ear Cuff', code: 'BR-003', cost: '32.00', price: '74.90', stock: 8, cat: 2 },
      { name: 'Pulseira Elos Oval', code: 'PU-001', cost: '48.00', price: '99.90', stock: 20, cat: 3 },
      { name: 'Pulseira Riviera', code: 'PU-002', cost: '95.00', price: '189.90', stock: 9, cat: 3 },
      { name: 'Pulseira Infantil', code: 'PU-003', cost: '25.00', price: '54.90', stock: 16, cat: 3 },
      { name: 'Pingente Coração', code: 'PI-001', cost: '20.00', price: '44.90', stock: 30, cat: 4 },
      { name: 'Pingente Cruz', code: 'PI-002', cost: '24.00', price: '52.90', stock: 14, cat: 4 },
      { name: 'Kit Presente Pratas', code: 'OT-001', cost: '110.00', price: '229.90', stock: 7, cat: 5 },
      { name: 'Escapulário Dupla Face', code: 'OT-002', cost: '58.00', price: '124.90', stock: 11, cat: 5 },
    ];

    const products = [];
    for (const def of productDefs) {
      const product = await prisma.product.create({
        data: {
          name: def.name,
          categoryId: categories[def.cat].id,
          internalCode: def.code,
          description: `${def.name} — peça de prata 925`,
          cost: def.cost,
          salePrice: def.price,
          profitMargin: margin(def.cost, def.price),
          stockQuantity: def.stock,
          minStock: 5,
          status: 'ACTIVE',
        },
      });
      products.push(product);
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'ENTRY',
          quantity: def.stock,
          reason: 'Estoque inicial (seed)',
          previousStock: 0,
          resultingStock: def.stock,
          movedAt: day(0, 2, 9),
        },
      });
    }

    const payments = ['PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER', 'FIADO'];
    const expenseCats = ['MERCHANDISE', 'PACKAGING', 'TRANSPORT', 'FEES', 'MAINTENANCE', 'OTHER'];
    const expensePayments = ['PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER'];

    let saleSeq = 0;
    let totalSales = 0;
    let totalServices = 0;
    let totalExpenses = 0;

    console.log(`Gerando movimentações de ${YEAR} (jan–dez)...`);

    for (let month = 0; month < 12; month += 1) {
      const seasonBoost = month >= 10 || month === 4 || month === 5 ? 1.35 : month >= 6 && month <= 8 ? 0.85 : 1;
      const salesInMonth = Math.max(6, Math.round((10 + (month % 4) * 2) * seasonBoost));

      for (let s = 0; s < salesInMonth; s += 1) {
        saleSeq += 1;
        const dayOfMonth = 1 + ((s * 3 + month) % 27);
        const soldAt = day(month, dayOfMonth, 9 + (s % 8), (s * 7) % 60);
        const itemCount = 1 + (s % 3);
        const paymentMethod = pick(payments, s + month);
        const customer =
          paymentMethod === 'FIADO'
            ? pick(customers, s + month)
            : s % 4 === 0
              ? pick(customers, s)
              : null;

        const items = [];
        let subtotal = 0;
        for (let i = 0; i < itemCount; i += 1) {
          const product = pick(products, s * 3 + i + month);
          const quantity = 1 + ((s + i) % 2);
          const unitPrice = Number(product.salePrice.toString());
          const unitCost = Number(product.cost.toString());
          const lineTotal = unitPrice * quantity;
          subtotal += lineTotal;
          items.push({
            product,
            quantity,
            unitPrice: money(unitPrice),
            unitCost: money(unitCost),
            subtotal: money(lineTotal),
          });
        }

        const discount =
          s % 5 === 0 ? money(Math.min(20, subtotal * 0.05)) : '0.00';
        const total = money(Math.max(0, subtotal - Number(discount)));
        const saleNumber = `VD-${YEAR}-${String(saleSeq).padStart(5, '0')}`;

        const sale = await prisma.sale.create({
          data: {
            saleNumber,
            customerId: customer?.id ?? null,
            discount,
            subtotal: money(subtotal),
            total,
            paymentMethod,
            status: s % 17 === 0 ? 'CANCELLED' : 'COMPLETED',
            notes: paymentMethod === 'FIADO' ? 'Venda fiada (seed)' : null,
            soldAt,
            items: {
              create: items.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: item.unitCost,
                subtotal: item.subtotal,
              })),
            },
          },
        });

        if (sale.status === 'COMPLETED') {
          totalSales += 1;
          for (const item of items) {
            const current = await prisma.product.findUnique({ where: { id: item.product.id } });
            if (!current) continue;
            const previousStock = current.stockQuantity;
            const resultingStock = Math.max(0, previousStock - item.quantity);
            await prisma.product.update({
              where: { id: item.product.id },
              data: { stockQuantity: resultingStock },
            });
            await prisma.inventoryMovement.create({
              data: {
                productId: item.product.id,
                type: 'SALE',
                quantity: item.quantity,
                reason: `Venda ${saleNumber}`,
                previousStock,
                resultingStock,
                saleId: sale.id,
                movedAt: soldAt,
              },
            });
          }
        }
      }

      // Reposições mensais
      for (let r = 0; r < 3; r += 1) {
        const product = pick(products, month * 3 + r);
        const qty = 5 + ((month + r) % 8);
        const current = await prisma.product.findUnique({ where: { id: product.id } });
        if (!current) continue;
        const previousStock = current.stockQuantity;
        const resultingStock = previousStock + qty;
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: resultingStock },
        });
        await prisma.inventoryMovement.create({
          data: {
            productId: product.id,
            type: 'ENTRY',
            quantity: qty,
            reason: 'Reposição mensal (seed)',
            previousStock,
            resultingStock,
            movedAt: day(month, 5 + r, 11),
          },
        });
      }

      // Serviços
      const servicesInMonth = 3 + (month % 3);
      for (let sv = 0; sv < servicesInMonth; sv += 1) {
        totalServices += 1;
        const catalog = pick(serviceCatalogs, sv + month);
        const paymentMethod = pick(payments, sv + month * 2);
        const customer =
          paymentMethod === 'FIADO' || sv % 2 === 0
            ? pick(customers, sv + month)
            : null;
        await prisma.service.create({
          data: {
            catalogId: catalog.id,
            customerId: customer?.id ?? null,
            name: catalog.name,
            description: catalog.description,
            amount: catalog.amount,
            cost: catalog.cost,
            paymentMethod,
            status: 'COMPLETED',
            notes: paymentMethod === 'FIADO' ? 'Serviço fiado (seed)' : null,
            performedAt: day(month, 4 + sv * 7, 14, 30),
          },
        });
      }

      // Despesas
      const expensesInMonth = 4 + (month % 2);
      for (let e = 0; e < expensesInMonth; e += 1) {
        totalExpenses += 1;
        await prisma.expense.create({
          data: {
            description: pick(
              [
                'Compra de insumos',
                'Embalagens presentáveis',
                'Frete fornecedor',
                'Taxa maquininha',
                'Manutenção vitrine',
                'Material de limpeza',
              ],
              e + month,
            ),
            category: pick(expenseCats, e + month),
            amount: money(40 + ((month * 3 + e) % 12) * 25),
            paymentMethod: pick(expensePayments, e),
            notes: 'Despesa seed',
            expenseDate: day(month, 8 + e * 5, 16),
          },
        });
      }
    }

    // Alguns produtos com estoque baixo para o widget
    await prisma.product.update({
      where: { id: products[8].id },
      data: { stockQuantity: 2, minStock: 5 },
    });
    await prisma.product.update({
      where: { id: products[10].id },
      data: { stockQuantity: 3, minStock: 5 },
    });
    await prisma.product.update({
      where: { id: products[14].id },
      data: { stockQuantity: 1, minStock: 5 },
    });

    console.log('');
    console.log('Seed concluído!');
    console.log('- Negócio: Cleide Pratas');
    console.log(`- Ano: ${YEAR}`);
    console.log(`- Categorias: ${categories.length}`);
    console.log(`- Clientes: ${customers.length}`);
    console.log(`- Produtos: ${products.length}`);
    console.log(`- Vendas concluídas: ${totalSales}`);
    console.log(`- Serviços: ${totalServices}`);
    console.log(`- Despesas: ${totalExpenses}`);
    console.log('');
    console.log('Abra o app e use o filtro "Ano atual" no Dashboard.');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha no seed:', error.message || error);
  if (String(error.message || error).includes('EPERM') || String(error).includes('busy')) {
    console.error('Feche o ControlOne antes de rodar o seed.');
  }
  process.exit(1);
});
