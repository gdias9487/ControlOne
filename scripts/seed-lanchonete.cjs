/**
 * Limpa o banco e popula uma lanchonete fictícia
 * (salgados, bolos, bebidas, vendas recentes).
 *
 * Uso: npm run seed:lanchonete
 * Feche o app antes de rodar.
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

function pick(arr, index) {
  return arr[index % arr.length];
}

function atDay(daysAgo, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function wipe(prisma) {
  await prisma.saleItem.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCatalog.deleteMany();
  await prisma.expense.deleteMany();
  if (prisma.recurringExpense) {
    await prisma.recurringExpense.deleteMany();
  }
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.category.deleteMany();
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

    console.log('Limpando dados anteriores...');
    await wipe(prisma);

    console.log('Configurando a lanchonete...');
    await prisma.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        storeName: 'Sabor da Esquina',
        businessType: 'Lanchonete',
        storePhone: '(11) 98888-1010',
        storeEmail: 'contato@sabordaesquina.com',
        storeAddress: 'Rua das Flores, 120 — Centro',
        logoPath: null,
        defaultMinStock: 8,
        backupFolder: null,
        theme: 'light',
        onboardingCompleted: true,
      },
      update: {
        storeName: 'Sabor da Esquina',
        businessType: 'Lanchonete',
        storePhone: '(11) 98888-1010',
        storeEmail: 'contato@sabordaesquina.com',
        storeAddress: 'Rua das Flores, 120 — Centro',
        logoPath: null,
        defaultMinStock: 8,
        onboardingCompleted: true,
      },
    });

    const categoryDefs = [
      { name: 'Salgados fritos', description: 'Salgados de frigideira e fritadeira' },
      { name: 'Salgados de forno', description: 'Assados e massas de forno' },
      { name: 'Bolos e doces', description: 'Fatias, brigadeiros e sobremesas' },
      { name: 'Bebidas', description: 'Sucos, café e refrigerantes' },
      { name: 'Combos', description: 'Combinações do dia' },
    ];
    const categories = [];
    for (const cat of categoryDefs) {
      categories.push(await prisma.category.create({ data: cat }));
    }

    const productDefs = [
      { name: 'Coxinha de frango', code: 'SF-001', cost: '2.10', price: '7.50', stock: 48, min: 12, cat: 0 },
      { name: 'Coxinha de costela', code: 'SF-002', cost: '2.80', price: '9.00', stock: 30, min: 10, cat: 0 },
      { name: 'Enroladinho de salsicha', code: 'SF-003', cost: '1.40', price: '5.50', stock: 60, min: 15, cat: 0 },
      { name: 'Enroladinho de queijo', code: 'SF-004', cost: '1.60', price: '6.00', stock: 40, min: 12, cat: 0 },
      { name: 'Risole de camarão', code: 'SF-005', cost: '3.20', price: '10.00', stock: 18, min: 8, cat: 0 },
      { name: 'Quibe', code: 'SF-006', cost: '1.90', price: '6.50', stock: 36, min: 10, cat: 0 },
      { name: 'Bolinha de queijo', code: 'SF-007', cost: '1.30', price: '5.00', stock: 55, min: 15, cat: 0 },
      { name: 'Pastel frito de carne', code: 'SF-008', cost: '2.40', price: '8.00', stock: 22, min: 8, cat: 0 },
      { name: 'Pastel frito de queijo', code: 'SF-009', cost: '2.20', price: '8.00', stock: 20, min: 8, cat: 0 },

      { name: 'Pastel de forno de frango', code: 'FO-001', cost: '3.40', price: '12.00', stock: 24, min: 8, cat: 1 },
      { name: 'Pastel de forno de palmito', code: 'FO-002', cost: '3.60', price: '12.50', stock: 16, min: 6, cat: 1 },
      { name: 'Esfiha de carne', code: 'FO-003', cost: '2.00', price: '7.00', stock: 42, min: 12, cat: 1 },
      { name: 'Esfiha de queijo', code: 'FO-004', cost: '1.90', price: '7.00', stock: 38, min: 12, cat: 1 },
      { name: 'Empada de frango', code: 'FO-005', cost: '2.50', price: '8.50', stock: 28, min: 8, cat: 1 },
      { name: 'Empada de palmito', code: 'FO-006', cost: '2.70', price: '8.50', stock: 14, min: 6, cat: 1 },
      { name: 'Pão de queijo', code: 'FO-007', cost: '1.10', price: '4.50', stock: 70, min: 20, cat: 1 },

      { name: 'Bolo de chocolate (fatia)', code: 'DO-001', cost: '3.00', price: '9.50', stock: 16, min: 6, cat: 2 },
      { name: 'Bolo de cenoura (fatia)', code: 'DO-002', cost: '2.80', price: '9.00', stock: 14, min: 6, cat: 2 },
      { name: 'Bolo de milho (fatia)', code: 'DO-003', cost: '2.60', price: '8.50', stock: 12, min: 5, cat: 2 },
      { name: 'Bolo de pote', code: 'DO-004', cost: '3.20', price: '11.00', stock: 18, min: 6, cat: 2 },
      { name: 'Brigadeiro', code: 'DO-005', cost: '0.80', price: '3.50', stock: 80, min: 20, cat: 2 },
      { name: 'Beijinho', code: 'DO-006', cost: '0.75', price: '3.50', stock: 64, min: 16, cat: 2 },
      { name: 'Sonho de creme', code: 'DO-007', cost: '2.20', price: '7.50', stock: 10, min: 6, cat: 2 },

      { name: 'Café', code: 'BE-001', cost: '0.70', price: '4.00', stock: 90, min: 20, cat: 3 },
      { name: 'Suco de laranja', code: 'BE-002', cost: '2.00', price: '8.00', stock: 25, min: 8, cat: 3 },
      { name: 'Refrigerante lata', code: 'BE-003', cost: '2.40', price: '6.00', stock: 48, min: 12, cat: 3 },
      { name: 'Água 500ml', code: 'BE-004', cost: '1.00', price: '4.00', stock: 60, min: 12, cat: 3 },
      { name: 'Chocolate quente', code: 'BE-005', cost: '1.80', price: '7.50', stock: 20, min: 6, cat: 3 },
      { name: 'Vitamina de banana', code: 'BE-006', cost: '2.80', price: '10.00', stock: 12, min: 5, cat: 3 },

      { name: 'Combo coxinha + refri', code: 'CB-001', cost: '4.50', price: '12.00', stock: 20, min: 6, cat: 4 },
      { name: 'Combo pastel de forno + suco', code: 'CB-002', cost: '5.40', price: '18.00', stock: 12, min: 4, cat: 4 },
      { name: 'Kit festa 25 salgados', code: 'CB-003', cost: '28.00', price: '65.00', stock: 6, min: 3, cat: 4 },
    ];

    const products = [];
    for (const def of productDefs) {
      const product = await prisma.product.create({
        data: {
          name: def.name,
          categoryId: categories[def.cat].id,
          internalCode: def.code,
          description: `${def.name} — produção da casa`,
          cost: def.cost,
          salePrice: def.price,
          profitMargin: margin(def.cost, def.price),
          stockQuantity: def.stock,
          minStock: def.min,
          status: 'ACTIVE',
        },
      });
      products.push(product);
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'ENTRY',
          quantity: def.stock,
          reason: 'Produção do dia (seed)',
          previousStock: 0,
          resultingStock: def.stock,
          movedAt: atDay(20, 7, 30),
        },
      });
    }

    const serviceCatalogDefs = [
      { name: 'Bolo encomenda (kg)', description: 'Bolo caseiro sob encomenda, valor por kg', amount: '55.00', cost: '22.00' },
      { name: 'Kit festa 50 salgados', description: 'Salgados sortidos para festa', amount: '120.00', cost: '52.00' },
      { name: 'Kit festa 100 salgados', description: 'Salgados sortidos para festa', amount: '220.00', cost: '95.00' },
      { name: 'Coffee break 10 pessoas', description: 'Café, bolo e salgados para reunião', amount: '180.00', cost: '75.00' },
    ];
    const serviceCatalogs = [];
    for (const item of serviceCatalogDefs) {
      serviceCatalogs.push(
        await prisma.serviceCatalog.create({ data: { ...item, status: 'ACTIVE' } }),
      );
    }

    const customerNames = [
      'João Pedreiro',
      'Maria da Padaria',
      'Ana da Escola',
      'Carlos do Escritório',
      'Fernanda',
      'Seu Antônio',
      'Patrícia RH',
      'Bruno Motoboy',
      'Luciana',
      'Dona Helena',
    ];
    const customers = [];
    for (const name of customerNames) {
      customers.push(await prisma.customer.create({ data: { name } }));
    }

    const payments = ['PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'CASH', 'FIADO'];
    const year = new Date().getFullYear();
    let saleSeq = 0;
    let totalSales = 0;

    console.log('Gerando vendas dos últimos 20 dias...');
    for (let dayOffset = 20; dayOffset >= 0; dayOffset -= 1) {
      const salesInDay = 4 + (dayOffset % 4);
      for (let s = 0; s < salesInDay; s += 1) {
        saleSeq += 1;
        const soldAt = atDay(dayOffset, 7 + (s % 12), (s * 11) % 60);
        const itemCount = 1 + (s % 3);
        const paymentMethod = pick(payments, s + dayOffset);
        const customer =
          paymentMethod === 'FIADO'
            ? pick(customers, s + dayOffset)
            : s % 5 === 0
              ? pick(customers, s)
              : null;

        const items = [];
        let subtotal = 0;
        for (let i = 0; i < itemCount; i += 1) {
          const product = pick(products, s * 4 + i + dayOffset);
          const quantity = 1 + ((s + i) % 3);
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

        const discount = s % 8 === 0 ? money(Math.min(5, subtotal * 0.05)) : '0.00';
        const total = money(Math.max(0, subtotal - Number(discount)));
        const saleNumber = `VD-${year}-${String(saleSeq).padStart(5, '0')}`;

        const sale = await prisma.sale.create({
          data: {
            saleNumber,
            customerId: customer?.id ?? null,
            discount,
            subtotal: money(subtotal),
            total,
            paymentMethod,
            status: s % 19 === 0 ? 'CANCELLED' : 'COMPLETED',
            notes: paymentMethod === 'FIADO' ? 'Fiado da semana' : null,
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

        if (sale.status !== 'COMPLETED') continue;
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

    console.log('Lançando serviços e despesas...');
    for (let i = 0; i < 8; i += 1) {
      const catalog = pick(serviceCatalogs, i);
      const paymentMethod = pick(payments, i + 3);
      await prisma.service.create({
        data: {
          catalogId: catalog.id,
          customerId: pick(customers, i).id,
          name: catalog.name,
          description: catalog.description,
          amount: catalog.amount,
          cost: catalog.cost,
          paymentMethod,
          status: 'COMPLETED',
          notes: paymentMethod === 'FIADO' ? 'Encomenda fiada' : null,
          performedAt: atDay(18 - i * 2, 15, 0),
        },
      });
    }

    const expenseDefs = [
      { description: 'Farinha e óleo', category: 'MERCHANDISE', amount: '220.00' },
      { description: 'Frango e recheios', category: 'MERCHANDISE', amount: '310.00' },
      { description: 'Embalagens e saquinhos', category: 'PACKAGING', amount: '85.00' },
      { description: 'Gás de cozinha', category: 'MAINTENANCE', amount: '130.00' },
      { description: 'Taxa da maquininha', category: 'FEES', amount: '46.00' },
      { description: 'Entrega de encomenda', category: 'TRANSPORT', amount: '35.00' },
    ];
    for (let i = 0; i < expenseDefs.length; i += 1) {
      const exp = expenseDefs[i];
      await prisma.expense.create({
        data: {
          description: exp.description,
          category: exp.category,
          amount: exp.amount,
          paymentMethod: pick(['PIX', 'CASH', 'DEBIT_CARD'], i),
          expenseDate: atDay(12 - i, 10, 0),
        },
      });
    }

    if (prisma.recurringExpense) {
      await prisma.recurringExpense.createMany({
        data: [
          {
            description: 'Aluguel do ponto',
            category: 'OTHER',
            amount: '1800.00',
            paymentMethod: 'PIX',
            dayOfMonth: 5,
            active: true,
          },
          {
            description: 'Energia elétrica',
            category: 'MAINTENANCE',
            amount: '420.00',
            paymentMethod: 'PIX',
            dayOfMonth: 10,
            active: true,
          },
        ],
      });
    }

    console.log('');
    console.log('Lanchonete pronta: Sabor da Esquina');
    console.log(`Produtos: ${products.length}`);
    console.log(`Vendas concluídas: ${totalSales}`);
    console.log('Abra o Caixa e teste coxinha, enroladinho, pastel de forno e bolo.');
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
