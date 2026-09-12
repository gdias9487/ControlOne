/**
 * Sobe a versão do package.json (patch por padrão).
 *
 * Uso:
 *   node scripts/bump-version.cjs
 *   node scripts/bump-version.cjs patch|minor|major
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');

function parseVersion(raw) {
  const parts = String(raw).split('.').map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Versão inválida no package.json: ${raw}`);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function nextVersion(current, kind) {
  const v = parseVersion(current);
  if (kind === 'major') return `${v.major + 1}.0.0`;
  if (kind === 'minor') return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

function readPackage() {
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function bumpPackageVersion(kind = 'patch') {
  const pkg = readPackage();
  const previous = pkg.version;
  const version = nextVersion(previous, kind);
  pkg.version = version;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return { previous, version };
}

function main() {
  const kind = (process.argv[2] || 'patch').toLowerCase();
  if (!['patch', 'minor', 'major'].includes(kind)) {
    console.error('Uso: node scripts/bump-version.cjs [patch|minor|major]');
    process.exit(1);
  }
  const { previous, version } = bumpPackageVersion(kind);
  console.log(`Versão: ${previous} → ${version}`);
}

if (require.main === module) {
  main();
}

module.exports = { bumpPackageVersion, readPackage, pkgPath };
