const fs = require('fs');
const path = require('path');

/**
 * Garante que node_modules/.prisma/client inteiro entre no pacote Electron.
 * Pastas com ponto (.prisma) costumam ser ignoradas pelo electron-builder.
 */
exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const appOutDir = context.appOutDir;
  const resourcesDir = path.join(appOutDir, 'resources');

  const source = path.join(projectDir, 'node_modules', '.prisma', 'client');
  if (!fs.existsSync(source)) {
    throw new Error('Prisma client não encontrado. Rode: npx prisma generate');
  }

  const targets = [
    path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', '.prisma', 'client'),
    path.join(resourcesDir, 'prisma-client'),
  ];

  for (const target of targets) {
    fs.mkdirSync(target, { recursive: true });
    copyDir(source, target);
  }

  // Também coloca ao lado do asar em node_modules para resolução do require
  const asarNodeModules = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules');
  fs.mkdirSync(path.join(asarNodeModules, '@prisma'), { recursive: true });

  console.log('✓ Prisma client copiado para o pacote Electron');
};

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}
