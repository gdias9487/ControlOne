/**
 * Sobe a versão (patch), gera o instalador e publica o Release no GitHub.
 *
 * Uso:
 *   npm run release
 *   npm run release -- minor
 *   npm run release -- --notes "Venda avulsa e correções"
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bumpPackageVersion, readPackage } = require('./bump-version.cjs');

const root = path.join(__dirname, '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function findGh() {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['gh'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const first = String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().endsWith('.exe') || line.includes('/gh'));
  return first || (process.platform === 'win32' ? 'gh.exe' : 'gh');
}

function runGh(args) {
  const gh = findGh();
  try {
    execFileSync(gh, args, { cwd: root, stdio: 'inherit' });
  } catch {
    fail(`Falha ao executar: ${gh} ${args.join(' ')}`);
  }
}

function commandExists() {
  try {
    execFileSync(findGh(), ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensureGh() {
  if (commandExists()) return;
  fail(
    [
      'GitHub CLI (gh) não está instalado ou não está no PATH.',
      '',
      'Instale e autentique uma vez:',
      '  winget install --id GitHub.cli',
      '  (feche e abra o terminal)',
      '  gh auth login',
      '',
      'O instalador já pode ter sido gerado em release/.',
      'Depois rode: npm run release -- --no-bump --skip-build',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let kind = 'patch';
  let notes = '';
  let bump = true;
  let skipBuild = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--no-bump') {
      bump = false;
      continue;
    }
    if (arg === '--skip-build') {
      skipBuild = true;
      continue;
    }
    if (arg === '--notes') {
      notes = args[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === 'patch' || arg === 'minor' || arg === 'major') {
      kind = arg;
      continue;
    }
    fail(`Argumento inválido: ${arg}`);
  }

  return { kind, notes, bump, skipBuild };
}

function stageAssets(version) {
  const setupSource = path.join(root, 'release', `ControlOne Setup ${version}.exe`);
  const blockmapSource = `${setupSource}.blockmap`;
  const latestSource = path.join(root, 'release', 'latest.yml');

  if (!fs.existsSync(setupSource) || !fs.existsSync(blockmapSource) || !fs.existsSync(latestSource)) {
    fail(`Arquivo não gerado. Esperado em release/: ControlOne Setup ${version}.exe`);
  }

  const staging = path.join(os.tmpdir(), `controlone-release-${version}`);
  fs.mkdirSync(staging, { recursive: true });

  const setup = path.join(staging, `ControlOne-Setup-${version}.exe`);
  const blockmap = `${setup}.blockmap`;
  const latest = path.join(staging, 'latest.yml');

  fs.copyFileSync(setupSource, setup);
  fs.copyFileSync(blockmapSource, blockmap);
  fs.copyFileSync(latestSource, latest);

  return { setup, blockmap, latest };
}

function main() {
  const { kind, notes, bump, skipBuild } = parseArgs(process.argv);
  ensureGh();

  const before = readPackage().version;
  const { version } = bump ? bumpPackageVersion(kind) : { version: before };

  if (bump) {
    console.log(`\n==> Versão ${before} → ${version}\n`);
  } else {
    console.log(`\n==> Publicando versão atual ${version} (sem bump)\n`);
  }

  if (!skipBuild) {
    const result = spawnSync('npm', ['run', 'dist'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    if (result.status !== 0) fail('Falha ao gerar o instalador (npm run dist).');
  } else {
    console.log('==> Pulando build (--skip-build)\n');
  }

  console.log('==> Enviando arquivos ao GitHub (pode demorar)...\n');
  const assets = stageAssets(version);

  const tag = `v${version}`;
  const title = `ControlOne ${version}`;
  const body = notes.trim() || 'Correções e melhorias';

  runGh([
    'release',
    'create',
    tag,
    assets.setup,
    assets.blockmap,
    assets.latest,
    '--title',
    title,
    '--notes',
    body,
    '--repo',
    'gdias9487/ControlOne',
  ]);

  console.log(`\nRelease ${tag} publicado.`);
  console.log('No cliente: Configurações → Atualizações → Verificar atualizações');
  if (bump) {
    console.log(`Lembre de commitar o package.json com a versão ${version}.`);
  }
}

main();
