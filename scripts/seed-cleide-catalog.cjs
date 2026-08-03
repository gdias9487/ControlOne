/**
 * Popula categorias e produtos do catálogo da Cleide Pratas
 * a partir da lista enviada (ignora compras/despesas).
 *
 * Não apaga vendas, clientes nem despesas existentes.
 * Reexecutar é seguro: categorias/produtos já existentes são pulados.
 *
 * Uso: npm run seed:catalog
 * Fecha o app antes de rodar.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CATALOG = [
  {
    category: 'Pulseiras adulto',
    products: [
      'Elo coração',
      'Ponto baiano',
      'Cartier',
      'Olho grego',
      'Dois fios',
      'Ponto de luz colorida',
    ],
  },
  {
    category: 'Pulseiras bebê',
    products: ['Plaquinha', 'Plaquinha com figa', 'Com figa'],
  },
  {
    category: 'Correntes masculinas',
    products: ['2mm', '3mm', '3mm elo duplo', '4mm', '5mm'],
  },
  {
    category: 'Pulseiras masculinas',
    products: ['2mm', '3mm', '4mm', '4,5mm'],
  },
  {
    category: 'Correntes femininas adulto',
    products: [
      'Laminada',
      'Dois fios 40cm',
      'Dois fios 45cm',
      'Trevo branco',
      'Trevo preto',
      'Cartier',
      'Singapura',
      'Bolinha Singapura',
      'Cartier 45cm',
      'Pipoca 50cm',
      'Elo coração 50cm',
      'Elo coração 45cm',
      'Elo coração 40cm',
      'Bismark 50cm',
    ],
  },
];

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

function slugCode(prefix, index) {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function categoryPrefix(name) {
  const map = {
    'Pulseiras adulto': 'PA',
    'Pulseiras bebê': 'PB',
    'Correntes masculinas': 'CM',
    'Pulseiras masculinas': 'PM',
    'Correntes femininas adulto': 'CF',
  };
  return map[name] || 'PR';
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

    await prisma.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        storeName: 'Cleide Pratas',
        businessType: 'Joias e acessórios',
        onboardingCompleted: true,
        theme: 'light',
        defaultMinStock: 5,
      },
      update: {
        storeName: 'Cleide Pratas',
        businessType: 'Joias e acessórios',
        onboardingCompleted: true,
      },
    });

    let categoriesCreated = 0;
    let productsCreated = 0;
    let productsSkipped = 0;

    for (const group of CATALOG) {
      let category = await prisma.category.findUnique({
        where: { name: group.category },
      });

      if (!category) {
        category = await prisma.category.create({
          data: {
            name: group.category,
            description: `Catálogo Cleide — ${group.category}`,
          },
        });
        categoriesCreated += 1;
        console.log(`Categoria criada: ${group.category}`);
      } else {
        console.log(`Categoria já existe: ${group.category}`);
      }

      const prefix = categoryPrefix(group.category);

      for (let i = 0; i < group.products.length; i += 1) {
        const productName = group.products[i];
        const internalCode = slugCode(prefix, i + 1);
        // Sufixo da categoria evita conflito (ex.: Cartier / 2mm em mais de um grupo)
        const name = `${productName} — ${group.category}`;

        const existingByCode = await prisma.product.findUnique({
          where: { internalCode },
        });
        const existingByName = await prisma.product.findFirst({
          where: { name, deletedAt: null },
        });

        if (existingByCode || existingByName) {
          productsSkipped += 1;
          continue;
        }

        await prisma.product.create({
          data: {
            name,
            categoryId: category.id,
            internalCode,
            description: productName,
            cost: '0.00',
            salePrice: '0.00',
            profitMargin: '0.00',
            stockQuantity: 0,
            minStock: 5,
            status: 'ACTIVE',
          },
        });
        productsCreated += 1;
        console.log(`  + ${name} [${internalCode}]`);
      }
    }

    console.log('');
    console.log('Catálogo Cleide concluído.');
    console.log(`- Categorias novas: ${categoriesCreated}`);
    console.log(`- Produtos novos: ${productsCreated}`);
    console.log(`- Produtos já existentes (pulados): ${productsSkipped}`);
    console.log('');
    console.log('Obs.: custo e preço estão em R$ 0,00 — ajuste no app.');
    console.log('Compras (Adriel, Paraíba, GG FOLHEADOS) foram ignoradas de propósito.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha no seed do catálogo:', error.message || error);
  if (String(error.message || error).includes('EPERM') || String(error).includes('busy')) {
    console.error('Feche o ControlOne antes de rodar o seed:catalog.');
  }
  process.exit(1);
});
