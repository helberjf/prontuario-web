import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { iniciarServidorTeste } from '../e2e/server.mjs';
import { aguardarGravador } from '../e2e/processo.js';

const servidores = [];
afterEach(async () => { await Promise.all(servidores.splice(0).map(s => new Promise(r => s.close(r)))); });

describe('isolamento do servidor de testes e codegen', () => {
  it('aloca porta própria e não reutiliza serviço existente', async () => {
    const servidor = await iniciarServidorTeste(0);
    servidores.push(servidor);
    await expect(iniciarServidorTeste(servidor.address().port)).rejects.toThrow(/EADDRINUSE/);
    const outro = await iniciarServidorTeste(0);
    servidores.push(outro);
    expect(outro.address().port).not.toBe(servidor.address().port);
  });
  it('propaga falha do gravador em vez de anunciar sucesso', async () => {
    const processo = new EventEmitter();
    const resultado = aguardarGravador(processo);
    processo.emit('exit', 1, null);
    await expect(resultado).rejects.toThrow(/código 1/);
  });
  it('rejeita encerramento por sinal', async () => {
    const processo = new EventEmitter();
    const resultado = aguardarGravador(processo);
    processo.emit('exit', null, 'SIGTERM');
    await expect(resultado).rejects.toThrow(/SIGTERM/);
  });
  it('aceita apenas encerramento normal com código zero', async () => {
    const processo = new EventEmitter();
    const resultado = aguardarGravador(processo);
    processo.emit('exit', 0, null);
    await expect(resultado).resolves.toBeUndefined();
  });
});
