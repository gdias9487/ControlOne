/**
 * Limpa o banco e popula um estúdio de personal trainer fictício
 * (planos, alunos, vendas com vencimento e despesas).
 *
 * Uso: npm run seed:trainer
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

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysAgo(offset, hour = 10, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - offset);
  return date;
}

async function ensurePlanTables(prisma) {
  const productCols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Product")`);
  if (!productCols.some((col) => col.name === 'durationDays')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "durationDays" INTEGER`);
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CustomerPlan" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "customerId" TEXT NOT NULL,
      "productId" TEXT,
      "productName" TEXT NOT NULL,
      "saleId" TEXT,
      "durationDays" INTEGER NOT NULL,
      "startsAt" DATETIME NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "cancelledAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function wipe(prisma) {
  await prisma.saleItem.deleteMany();
  if (prisma.salePayment) await prisma.salePayment.deleteMany();
  if (prisma.customerPlan) await prisma.customerPlan.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCatalog.deleteMany();
  await prisma.expense.deleteMany();
  if (prisma.recurringExpense) await prisma.recurringExpense.deleteMany();
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
    await ensurePlanTables(prisma);

    console.log('Limpando dados anteriores...');
    await wipe(prisma);

    console.log('Configurando o estúdio...');
    await prisma.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        storeName: 'Studio Move Personal',
        businessType: 'Personal trainer',
        businessProfile: 'consultancy',
        storePhone: '(11) 98821-4470',
        storeEmail: 'contato@studiomove.com.br',
        storeAddress: 'Rua Harmonia, 318 — Vila Madalena, São Paulo',
        logoPath: null,
        defaultMinStock: 0,
        backupFolder: null,
        theme: 'light',
        onboardingCompleted: true,
      },
      update: {
        storeName: 'Studio Move Personal',
        businessType: 'Personal trainer',
        businessProfile: 'consultancy',
        storePhone: '(11) 98821-4470',
        storeEmail: 'contato@studiomove.com.br',
        storeAddress: 'Rua Harmonia, 318 — Vila Madalena, São Paulo',
        logoPath: null,
        defaultMinStock: 0,
        onboardingCompleted: true,
      },
    });

    const categoryDefs = [
      { name: 'Planos individuais', description: 'Treino presencial 1 a 1' },
      { name: 'Planos em dupla', description: 'Treino compartilhado' },
      { name: 'Planos online', description: 'Acompanhamento remoto' },
      { name: 'Avaliações', description: 'Avaliação física e consultoria avulsa' },
    ];
    const categories = [];
    for (const cat of categoryDefs) {
      categories.push(await prisma.category.create({ data: cat }));
    }

    const planDefs = [
      {
        key: 'mensal3',
        name: 'Mensal 3x na semana',
        code: 'PL-M3',
        cost: '180.00',
        price: '450.00',
        days: 30,
        cat: 0,
        description: '12 sessões presenciais no mês, treino individual.',
      },
      {
        key: 'mensal5',
        name: 'Mensal 5x na semana',
        code: 'PL-M5',
        cost: '260.00',
        price: '650.00',
        days: 30,
        cat: 0,
        description: '20 sessões presenciais no mês, foco em hipertrofia.',
      },
      {
        key: 'trimestral',
        name: 'Trimestral 3x na semana',
        code: 'PL-T3',
        cost: '480.00',
        price: '1200.00',
        days: 90,
        cat: 0,
        description: '36 sessões em 3 meses, com reavaliação no meio do ciclo.',
      },
      {
        key: 'semestral',
        name: 'Semestral performance',
        code: 'PL-S6',
        cost: '900.00',
        price: '2200.00',
        days: 180,
        cat: 0,
        description: 'Ciclo de 6 meses com periodização e ajuste quinzenal.',
      },
      {
        key: 'anual',
        name: 'Anual completo',
        code: 'PL-A1',
        cost: '1600.00',
        price: '4200.00',
        days: 365,
        cat: 0,
        description: '12 meses de treino, avaliações trimestrais inclusas.',
      },
      {
        key: 'dupla',
        name: 'Dupla mensal',
        code: 'PL-D2',
        cost: '240.00',
        price: '800.00',
        days: 30,
        cat: 1,
        description: 'Treino em dupla, 3x na semana no mesmo horário.',
      },
      {
        key: 'online',
        name: 'Online mensal',
        code: 'PL-ON',
        cost: '40.00',
        price: '250.00',
        days: 30,
        cat: 2,
        description: 'Planilha + check-in semanal por WhatsApp e vídeo.',
      },
      {
        key: 'avaliacao',
        name: 'Avaliação física',
        code: 'PL-AV',
        cost: '35.00',
        price: '180.00',
        days: 30,
        cat: 3,
        description: 'Anamnese, medidas e prescrição inicial válidas por 30 dias.',
      },
    ];

    const plans = {};
    for (const def of planDefs) {
      const product = await prisma.product.create({
        data: {
          name: def.name,
          categoryId: categories[def.cat].id,
          internalCode: def.code,
          description: def.description,
          cost: def.cost,
          salePrice: def.price,
          profitMargin: margin(def.cost, def.price),
          stockQuantity: 0,
          minStock: 0,
          durationDays: def.days,
          status: 'ACTIVE',
        },
      });
      plans[def.key] = product;
    }

    const studentDefs = [
      { name: 'Ana Beatriz Lopes', phone: '(11) 99841-2201' },
      { name: 'Lucas Ferreira', phone: '(11) 98765-4410' },
      { name: 'Marina Costa', phone: '(11) 99612-7788' },
      { name: 'Pedro Henrique Alves', phone: '(11) 98123-0098' },
      { name: 'Juliana Mendes', phone: '(11) 99234-5567' },
      { name: 'Thiago Nogueira', phone: '(11) 98450-1122' },
      { name: 'Camila Duarte', phone: '(11) 99771-3344' },
      { name: 'Rafael Souza', phone: '(11) 98890-2211' },
      { name: 'Beatriz Lima', phone: '(11) 99567-8890' },
      { name: 'Gustavo Rocha', phone: '(11) 98109-4455' },
      { name: 'Fernanda Dias', phone: '(11) 99321-6677' },
      { name: 'Henrique Castro', phone: '(11) 98654-7781' },
      { name: 'Larissa Pires', phone: '(11) 99112-3345' },
      { name: 'Bruno Carvalho', phone: '(11) 98222-5566' },
      { name: 'Patrícia Gomes', phone: '(11) 99448-1010' },
      { name: 'Eduardo Martins', phone: '(11) 98701-9090' },
    ];
    const students = [];
    for (const student of studentDefs) {
      students.push(await prisma.customer.create({ data: student }));
    }

    const year = new Date().getFullYear();
    const saleDefs = [
      { student: 0, plan: 'mensal3', daysAgo: 26, hour: 7, payment: 'PIX' },
      { student: 1, plan: 'mensal3', daysAgo: 24, hour: 8, payment: 'PIX' },
      { student: 2, plan: 'mensal5', daysAgo: 28, hour: 6, payment: 'CREDIT_CARD' },
      { student: 3, plan: 'trimestral', daysAgo: 40, hour: 18, payment: 'PIX' },
      { student: 4, plan: 'anual', daysAgo: 80, hour: 9, payment: 'PIX' },
      { student: 5, plan: 'mensal3', daysAgo: 50, hour: 7, payment: 'PIX' },
      { student: 5, plan: 'mensal3', daysAgo: 8, hour: 7, payment: 'PIX' },
      { student: 6, plan: 'dupla', daysAgo: 10, hour: 19, payment: 'PIX' },
      { student: 7, plan: 'online', daysAgo: 5, hour: 11, payment: 'PIX' },
      { student: 8, plan: 'mensal5', daysAgo: 2, hour: 6, payment: 'CASH' },
      { student: 9, plan: 'avaliacao', daysAgo: 1, hour: 15, payment: 'PIX' },
      { student: 10, plan: 'semestral', daysAgo: 60, hour: 8, payment: 'CREDIT_CARD' },
      { student: 11, plan: 'mensal3', daysAgo: 12, hour: 20, payment: 'FIADO' },
      { student: 12, plan: 'mensal3', daysAgo: 70, hour: 9, payment: 'PIX', cancelled: true },
      { student: 13, plan: 'trimestral', daysAgo: 8, hour: 17, payment: 'DEBIT_CARD' },
      { student: 14, plan: 'online', daysAgo: 20, hour: 12, payment: 'PIX' },
      { student: 15, plan: 'mensal5', daysAgo: 3, hour: 6, payment: 'PIX' },
      { student: 0, plan: 'avaliacao', daysAgo: 90, hour: 14, payment: 'PIX' },
      { student: 7, plan: 'avaliacao', daysAgo: 35, hour: 16, payment: 'CASH' },
      { student: 6, plan: 'dupla', daysAgo: 95, hour: 19, payment: 'PIX' },
      { student: 2, plan: 'mensal5', daysAgo: 58, hour: 6, payment: 'CREDIT_CARD' },
      { student: 8, plan: 'mensal5', daysAgo: 33, hour: 6, payment: 'PIX' },
      { student: 1, plan: 'online', daysAgo: 4, hour: 21, payment: 'PIX' },
      { student: 9, plan: 'mensal3', daysAgo: 0, hour: 10, payment: 'PIX' },
      { student: 11, plan: 'avaliacao', daysAgo: 18, hour: 15, payment: 'FIADO', fiadoPaid: '80.00' },
    ];

    let saleSeq = 0;
    let totalSales = 0;
    let totalPlans = 0;
    let cancelledSales = 0;

    console.log('Criando vendas e planos ativos...');
    for (const def of saleDefs) {
      saleSeq += 1;
      const student = students[def.student];
      const plan = plans[def.plan];
      const soldAt = daysAgo(def.daysAgo, def.hour, (saleSeq * 11) % 60);
      const unitPrice = Number(plan.salePrice.toString());
      const unitCost = Number(plan.cost.toString());
      const total = money(unitPrice);
      const saleNumber = `VD-${year}-${String(saleSeq).padStart(5, '0')}`;
      const cancelled = Boolean(def.cancelled);
      const fiadoPaid = def.payment === 'FIADO' ? money(def.fiadoPaid ?? 0) : '0.00';

      const sale = await prisma.sale.create({
        data: {
          saleNumber,
          customerId: student.id,
          discount: '0.00',
          subtotal: total,
          total,
          paymentMethod: def.payment,
          status: cancelled ? 'CANCELLED' : 'COMPLETED',
          fiadoPaidAmount: fiadoPaid,
          fiadoPaidAt: Number(fiadoPaid) > 0 ? addDays(soldAt, 5) : null,
          notes: def.payment === 'FIADO' ? 'Aluno vai quitar no próximo treino.' : null,
          soldAt,
          items: {
            create: {
              productId: plan.id,
              productName: plan.name,
              quantity: 1,
              unitPrice: money(unitPrice),
              unitCost: money(unitCost),
              subtotal: total,
            },
          },
          payments: {
            create: {
              method: def.payment,
              amount: total,
            },
          },
        },
      });

      const startsAt = soldAt;
      const expiresAt = addDays(startsAt, plan.durationDays);
      await prisma.customerPlan.create({
        data: {
          customerId: student.id,
          productId: plan.id,
          productName: plan.name,
          saleId: sale.id,
          durationDays: plan.durationDays,
          startsAt,
          expiresAt,
          cancelledAt: cancelled ? soldAt : null,
        },
      });
      totalPlans += 1;
      if (cancelled) cancelledSales += 1;
      else totalSales += 1;
    }

    const recurringDefs = [
      {
        description: 'Aluguel do estúdio',
        category: 'OTHER',
        amount: '1800.00',
        paymentMethod: 'PIX',
        dayOfMonth: 5,
      },
      {
        description: 'App de treino e planilha',
        category: 'FEES',
        amount: '89.90',
        paymentMethod: 'CREDIT_CARD',
        dayOfMonth: 10,
      },
      {
        description: 'Contador',
        category: 'FEES',
        amount: '250.00',
        paymentMethod: 'PIX',
        dayOfMonth: 8,
      },
    ];
    const recurring = [];
    for (const def of recurringDefs) {
      recurring.push(await prisma.recurringExpense.create({ data: { ...def, active: true } }));
    }

    const extraExpenses = [
      { description: 'Anúncio Instagram', category: 'OTHER', amount: '180.00', daysAgo: 6, method: 'CREDIT_CARD' },
      { description: 'Faixas e colchonetes', category: 'MERCHANDISE', amount: '320.00', daysAgo: 21, method: 'PIX' },
      { description: 'Manutenção esteira', category: 'MAINTENANCE', amount: '150.00', daysAgo: 14, method: 'PIX' },
      { description: 'Material de limpeza', category: 'OTHER', amount: '64.90', daysAgo: 3, method: 'CASH' },
      { description: 'Curso de avaliação postural', category: 'OTHER', amount: '390.00', daysAgo: 45, method: 'PIX' },
    ];

    console.log('Criando despesas...');
    for (let monthOffset = 0; monthOffset < 3; monthOffset += 1) {
      for (const rec of recurring) {
        const date = new Date();
        date.setMonth(date.getMonth() - monthOffset, rec.dayOfMonth);
        date.setHours(9, 0, 0, 0);
        if (date > new Date()) continue;
        await prisma.expense.create({
          data: {
            description: rec.description,
            category: rec.category,
            amount: rec.amount,
            paymentMethod: rec.paymentMethod,
            notes: 'Despesa fixa',
            expenseDate: date,
            recurringExpenseId: rec.id,
          },
        });
      }
    }
    for (const extra of extraExpenses) {
      await prisma.expense.create({
        data: {
          description: extra.description,
          category: extra.category,
          amount: extra.amount,
          paymentMethod: extra.method,
          notes: 'Despesa do estúdio',
          expenseDate: daysAgo(extra.daysAgo, 16),
        },
      });
    }

    const expenseCount = await prisma.expense.count();

    console.log('');
    console.log('Seed de personal trainer concluído!');
    console.log('- Negócio: Studio Move Personal');
    console.log('- Perfil: Consultoria');
    console.log(`- Alunos: ${students.length}`);
    console.log(`- Planos no catálogo: ${planDefs.length}`);
    console.log(`- Vendas concluídas: ${totalSales}`);
    console.log(`- Vendas canceladas: ${cancelledSales}`);
    console.log(`- Planos vinculados: ${totalPlans}`);
    console.log(`- Despesas: ${expenseCount}`);
    console.log('');
    console.log('Abra o app para ver alunos, planos ativos e vencimentos.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha no seed:', error.message || error);
  if (String(error.message || error).includes('EPERM') || String(error).includes('busy')) {
    console.error('Feche o ControlOne antes de rodar o seed:trainer.');
  }
  process.exit(1);
});
