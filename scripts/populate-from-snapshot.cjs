/**
 * Popula o banco do ControlOne com o snapshot embutido/ao lado do executável.
 *
 * Uso (dev):
 *   node scripts/populate-from-snapshot.cjs
 *
 * Uso (exe):
 *   ControlOne-PopularDados.exe
 *
 * Fecha o ControlOne antes de rodar.
 * Faz backup do banco atual (se existir) e substitui pelos dados do snapshot.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

function resolveTargetPaths() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const dir = path.join(appData, 'controlone', 'controlone');
  return {
    dir,
    db: path.join(dir, 'controlone.db'),
    images: path.join(dir, 'images'),
    backups: path.join(dir, 'backups'),
  };
}

function resolveSnapshotRoot() {
  // 1) Pasta ao lado do .exe (distribuição)
  const exeDir = path.dirname(process.execPath);
  const besideExe = path.join(exeDir, 'seed-data');
  if (fs.existsSync(path.join(besideExe, 'controlone-seed.db'))) {
    return besideExe;
  }
  if (fs.existsSync(path.join(exeDir, 'controlone-seed.db'))) {
    return exeDir;
  }

  // 2) Snapshot do projeto (dev)
  const fromScript = path.join(__dirname, '..', 'build', 'seed-data');
  if (fs.existsSync(path.join(fromScript, 'controlone-seed.db'))) {
    return fromScript;
  }

  return null;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
      count += 1;
    }
  }
  return count;
}

function askConfirm(question) {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) {
    return Promise.resolve(true);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = String(answer || '')
        .trim()
        .toLowerCase();
      resolve(normalized === 's' || normalized === 'sim' || normalized === 'y' || normalized === 'yes');
    });
  });
}

async function main() {
  console.log('');
  console.log('=== ControlOne — Popular dados ===');
  console.log('');

  const snapshotRoot = resolveSnapshotRoot();
  if (!snapshotRoot) {
    console.error('Snapshot não encontrado (controlone-seed.db).');
    console.error('Rode antes: npm run snapshot:export');
    process.exit(1);
  }

  const seedDb = path.join(snapshotRoot, 'controlone-seed.db');
  const seedImages = path.join(snapshotRoot, 'images');
  const target = resolveTargetPaths();

  console.log('Snapshot :', seedDb);
  console.log('Destino  :', target.db);
  console.log('');
  console.log('ATENÇÃO: o banco atual será substituído.');
  console.log('Um backup automático será criado antes.');
  console.log('Feche o ControlOne antes de continuar.');
  console.log('');

  const ok = await askConfirm('Continuar? (s/N) ');
  if (!ok) {
    console.log('Cancelado.');
    process.exit(0);
  }

  fs.mkdirSync(target.dir, { recursive: true });
  fs.mkdirSync(target.backups, { recursive: true });

  if (fs.existsSync(target.db)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(target.backups, `pre-seed_${stamp}.db`);
    fs.copyFileSync(target.db, backupPath);
    console.log('Backup criado:', backupPath);
  }

  fs.copyFileSync(seedDb, target.db);
  console.log('Banco populado.');

  if (fs.existsSync(seedImages)) {
    const count = copyDir(seedImages, target.images);
    console.log(`Imagens copiadas: ${count}`);
  }

  console.log('');
  console.log('Concluído. Abra o ControlOne normalmente.');
  console.log('(A licença NÃO é copiada — cada PC precisa da própria ativação.)');
  console.log('');
}

main().catch((error) => {
  console.error('Falha:', error.message || error);
  if (String(error.message || error).includes('EBUSY') || String(error).includes('locked')) {
    console.error('Feche o ControlOne e tente de novo.');
  }
  process.exit(1);
});
