import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarApp } from '../server/app.js';
import { criarBancoMemoria, usuarioDemo } from '../server/banco-memoria.js';

// Ambiente isolado: não carrega .env e nunca conecta ao Neon.
export function iniciarServidorTeste(porta = 4173) {
  const db = criarBancoMemoria([usuarioDemo('demo@example.com', 'Demonstração', 'demo-demo-demo')]);
  const app = criarApp({ db, segredo: 'segredo-exclusivo-dos-testes-playwright-1234567890', pastaWeb: path.resolve('dist') });
  return new Promise((resolve, reject) => {
    const servidor = app.listen(porta, '127.0.0.1');
    servidor.once('error', reject);
    servidor.once('listening', () => resolve(servidor));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const servidor = await iniciarServidorTeste(Number(process.env.E2E_PORT || 4173));
  for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => servidor.close(() => process.exit(0)));
}
