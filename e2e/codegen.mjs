import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { iniciarServidorTeste } from './server.mjs';
import { aguardarGravador } from './processo.js';

await fs.mkdir('e2e/codegen', { recursive: true });
// O próprio processo abre uma porta livre: nunca reutiliza outro serviço local.
const servidor = await iniciarServidorTeste(0);
const url = `http://127.0.0.1:${servidor.address().port}`;
let gravador;
try {
  gravador = spawn(process.execPath, ['node_modules/playwright/cli.js', 'codegen', '--channel=chrome', '--target=playwright-test', '--lang=pt-BR', '--timezone=America/Sao_Paulo', '--viewport-size=1280,900', '--output=e2e/codegen/formulario.recording.js', url], { stdio: 'inherit', windowsHide: true });
  process.once('SIGINT', () => gravador.kill());
  await aguardarGravador(gravador);
} finally {
  servidor.closeAllConnections();
  await new Promise(resolve => servidor.close(resolve));
}
