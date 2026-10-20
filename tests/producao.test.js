import path from 'node:path';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../server/app.js';
import { criarBancoMemoria, usuarioDemo } from '../server/banco-memoria.js';

const DIST = path.join(import.meta.dirname, '..', 'dist');
const existe = fs.existsSync(path.join(DIST, 'index.html'));

describe.skipIf(!existe)('modo produção (precisa de npm run build)', () => {
  let srv, base;
  beforeAll(async () => {
    const db = criarBancoMemoria([usuarioDemo('a@example.com', 'A', 'senha-longa-123')]);
    srv = criarApp({ db, segredo: 'x'.repeat(40), producao: true, pastaWeb: DIST }).listen(0);
    await new Promise((r) => srv.once('listening', r));
    base = `http://localhost:${srv.address().port}`;
  });
  afterAll(() => srv.close());

  it('serve o site, os modelos e o logo de public/ e cai no index em rotas do app', async () => {
    expect((await fetch(`${base}/`)).headers.get('content-type')).toMatch(/html/);
    expect((await fetch(`${base}/alguma/rota`)).status).toBe(200);
    expect((await fetch(`${base}/modelos/masculina.docx`)).status).toBe(200);
    expect((await fetch(`${base}/hospital/logo.jpg`)).status).toBe(200);
  });

  it('cookie de sessão sai com Secure em produção e /api desconhecida é 404 JSON', async () => {
    const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@example.com', senha: 'senha-longa-123' }) });
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toMatch(/Secure/i);
    const nf = await fetch(`${base}/api/nada`);
    expect(nf.status).toBe(404);
    expect(await nf.json()).toHaveProperty('erro');
  });

  it('não expõe arquivos fora de dist (path traversal)', async () => {
    const r = await fetch(`${base}/..%2f..%2fpackage.json`);
    expect(await r.text()).not.toContain('"dependencies"');
  });
});
