/**
 * Gera a pasta/auxiliar executável para popular o banco.
 * Uso: npm run snapshot:exe
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const seedData = path.join(root, 'build', 'seed-data');
const seedDb = path.join(seedData, 'controlone-seed.db');
const outDir = path.join(root, 'release', 'ControlOne-PopularDados');
const exeName = 'ControlOne-PopularDados.exe';

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function main() {
  if (!fs.existsSync(seedDb)) {
    console.log('Snapshot ausente — exportando banco atual...');
    run('node scripts/export-db-snapshot.cjs');
  }

  if (!fs.existsSync(seedDb)) {
    console.error('Falha ao obter controlone-seed.db');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outSeed = path.join(outDir, 'seed-data');
  if (fs.existsSync(outSeed)) {
    fs.rmSync(outSeed, { recursive: true, force: true });
  }
  fs.mkdirSync(outSeed, { recursive: true });
  fs.copyFileSync(seedDb, path.join(outSeed, 'controlone-seed.db'));
  copyDir(path.join(seedData, 'images'), path.join(outSeed, 'images'));
  if (fs.existsSync(path.join(seedData, 'snapshot-meta.json'))) {
    fs.copyFileSync(
      path.join(seedData, 'snapshot-meta.json'),
      path.join(outSeed, 'snapshot-meta.json'),
    );
  }

  const exePath = path.join(outDir, exeName);
  run(
    `npx --yes pkg scripts/populate-from-snapshot.cjs -t node18-win-x64 -o "${exePath}"`,
  );

  const readme = `ControlOne — Popular dados
=========================

1. Feche o ControlOne se estiver aberto.
2. Execute ControlOne-PopularDados.exe
3. Confirme com "s"
4. Abra o ControlOne

Isso substitui o banco local pelos dados deste snapshot
(um backup automático é criado antes).

A licença NÃO é copiada — ative neste PC com o ID da máquina.
`;
  fs.writeFileSync(path.join(outDir, 'LEIA-ME.txt'), readme, 'utf8');

  console.log('');
  console.log('Pacote pronto em:');
  console.log(' ', outDir);
  console.log('Envie a pasta inteira (exe + seed-data).');
}

main();
