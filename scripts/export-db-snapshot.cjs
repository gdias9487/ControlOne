/**
 * Exporta o banco atual do ControlOne para um snapshot reutilizável.
 * Uso: npm run snapshot:export
 * Fecha o app antes de rodar.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function resolveLiveDbPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const candidates = [
    path.join(appData, 'controlone', 'controlone', 'controlone.db'),
    path.join(appData, 'controlone', 'controlone', 'cleide-pratas.db'),
    path.join(appData, 'ControlOne', 'controlone', 'controlone.db'),
    path.join(appData, 'cleide-pratas', 'cleide-pratas', 'cleide-pratas.db'),
  ];
  if (process.env.SEED_DB_PATH && fs.existsSync(process.env.SEED_DB_PATH)) {
    return process.env.SEED_DB_PATH;
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
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

function main() {
  const liveDb = resolveLiveDbPath();
  if (!liveDb) {
    console.error('Banco atual não encontrado em %APPDATA%\\controlone\\...');
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'build', 'seed-data');
  fs.mkdirSync(outDir, { recursive: true });

  const outDb = path.join(outDir, 'controlone-seed.db');
  fs.copyFileSync(liveDb, outDb);

  const liveImages = path.join(path.dirname(liveDb), 'images');
  const outImages = path.join(outDir, 'images');
  if (fs.existsSync(outImages)) {
    fs.rmSync(outImages, { recursive: true, force: true });
  }
  const imageCount = copyDir(liveImages, outImages);

  const meta = {
    exportedAt: new Date().toISOString(),
    sourceDb: liveDb,
    sizeBytes: fs.statSync(outDb).size,
    imageFiles: imageCount,
  };
  fs.writeFileSync(path.join(outDir, 'snapshot-meta.json'), JSON.stringify(meta, null, 2));

  console.log('Snapshot exportado:');
  console.log('  DB     :', outDb);
  console.log('  Imagens:', imageCount);
  console.log('  Origem :', liveDb);
  console.log('');
  console.log('Agora rode: npm run snapshot:exe');
}

main();
