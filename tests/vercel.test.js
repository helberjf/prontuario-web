import http from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import { criarHandler } from '../server/vercel.js';
import { criarApp } from '../server/app.js';
import { criarBancoMemoria, usuarioDemo } from '../server/banco-memoria.js';

const servidores = [];
async function servir(handler) {
  const srv = http.createServer(handler).listen(0);
  servidores.push(srv);
  await new Promise(r => srv.once('listening', r));
  return `http://localhost:${srv.address().port}`;
}
afterAll(() => servidores.forEach(srv => srv.close()));

describe('API serverless', () => {
  it('inicializa apenas uma vez e mantém login, cookie e histórico nas rotas /api', async () => {
    let inicializacoes = 0;
    const db = criarBancoMemoria([usuarioDemo('admin@example.com', 'Hospital', 'senha-de-teste-123')]);
    const base = await servir(criarHandler({ iniciar: async () => {
      inicializacoes++;
      return criarApp({ db, segredo: 'x'.repeat(40), producao: true });
    } }));
    const respostas = await Promise.all([fetch(`${base}/api/eu`), fetch(`${base}/api/prontuarios`)]);
    expect(respostas.map(r => r.status)).toEqual([401, 401]);
    expect(inicializacoes).toBe(1);
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', senha: 'senha-de-teste-123' }) });
    expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toMatch(/Secure/);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    expect((await fetch(`${base}/api/eu`, { headers: { Cookie: cookie } })).status).toBe(200);
    expect(await (await fetch(`${base}/api/prontuarios`, { headers: { Cookie: cookie } })).json()).toEqual([]);
    expect((await fetch(`${base}/api/inexistente`)).status).toBe(404);
  });
  it('falha sem expor segredos e permite recuperar a inicialização', async () => {
    let tentativas = 0;
    const base = await servir(criarHandler({ iniciar: async () => {
      if (++tentativas === 1) throw new Error('postgresql://segredo');
      return criarApp({ db: criarBancoMemoria(), segredo: 'x'.repeat(40) });
    } }));
    const falha = await fetch(`${base}/api/eu`);
    expect(falha.status).toBe(503);
    expect(await falha.text()).not.toContain('postgresql');
    expect((await fetch(`${base}/api/eu`)).status).toBe(401);
  });
});
