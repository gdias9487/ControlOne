/**
 * Emite uma chave de licença para um ID de máquina.
 *
 * Uso:
 *   npm run license:issue -- XXXX-XXXX-XXXX-XXXX
 *
 * Opcional: CONTROLONE_CUSTOMER="Nome da loja" (só para log)
 */
const { issueLicenseKey, normalizeMachineId } = require('./lib/license-core.cjs');

function main() {
  const rawId = process.argv[2];
  if (!rawId) {
    console.error('Uso: npm run license:issue -- XXXX-XXXX-XXXX-XXXX');
    process.exit(1);
  }

  try {
    const machineId = normalizeMachineId(rawId);
    const key = issueLicenseKey(machineId);
    const customer = process.env.CONTROLONE_CUSTOMER || '';

    console.log('');
    console.log('=== Licença ControlOne ===');
    if (customer) console.log('Cliente :', customer);
    console.log('Máquina :', machineId);
    console.log('Chave   :', key);
    console.log('');
    console.log('Envie a chave para a cliente colar na tela de ativação.');
    console.log('');
  } catch (error) {
    console.error('Falha:', error.message || error);
    process.exit(1);
  }
}

main();
