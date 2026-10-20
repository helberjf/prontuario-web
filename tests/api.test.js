import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../server/app.js';
import { criarBancoMemoria } from '../server/banco-memoria.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
const SENHA = 'senha-de-teste-12345';

const bancoFalso = () => criarBancoMemoria([{ id: 1, email: 'medico@example.com', nome: 'Dr. Teste', senha_hash: bcrypt.hashSync(SENHA, 4), ativo: true }]);

let servidor, base, db;
beforeAll(async () => {
  db = bancoFalso();
  servidor = criarApp({ db, segredo: SEGREDO }).listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://localhost:${servidor.address().port}`;
});
afterAll(() => servidor.close());

const json = (corpo, extra = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...extra.headers }, body: JSON.stringify(corpo) });
async function logar() {
  const r = await fetch(`${base}/api/login`, json({ email: 'medico@example.com', senha: SENHA }));
  return { r, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const valido = { enfermaria_id: 'masculina', dados: { nome: 'Fulano de Tal', idade: '66', adicionais: 'item digitado' } };

describe('sessão', () => {
  it('rota protegida sem login devolve 401', async () => {
    expect((await fetch(`${base}/api/prontuarios`)).status).toBe(401);
  });

  it('login correto cria cookie httpOnly SameSite=Strict e registra o evento', async () => {
    const { r } = await logar();
    expect(r.status).toBe(200);
    const cookie = r.headers.get('set-cookie');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect((await r.json()).senha_hash).toBeUndefined();
    expect(db.estado.eventos.some((e) => e.acao === 'LOGIN')).toBe(true);
  });

  it('senha errada e e-mail inexistente dão a mesma resposta e ficam auditados', async () => {
    const a = await fetch(`${base}/api/login`, json({ email: 'medico@example.com', senha: 'errada' }));
    const b = await fetch(`${base}/api/login`, json({ email: 'naoexiste@example.com', senha: 'errada' }));
    expect(a.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
    expect(db.estado.eventos.filter((e) => e.acao === 'LOGIN_FALHOU').length).toBeGreaterThanOrEqual(2);
  });
});

describe('prontuários', () => {
  it('salva um atendimento válido e devolve avisos dos campos vazios', async () => {
    const { cookie } = await logar();
    const r = await fetch(`${base}/api/prontuarios`, json(valido, { headers: { Cookie: cookie } }));
    expect(r.status).toBe(201);
    const corpo = await r.json();
    expect(corpo.avisos.join()).toMatch(/EXAME FÍSICO: não informado/);
    expect(db.estado.prontuarios.at(-1).paciente_nome).toBe('FULANO DE TAL');
    expect(db.estado.eventos.some((e) => e.acao === 'GERADO')).toBe(true);
  });

  it('o servidor revalida: dados inválidos não são salvos mesmo que o navegador os envie', async () => {
    const { cookie } = await logar();
    const antes = db.estado.prontuarios.length;
    for (const dados of [
      { nome: 'X', data_admissao: '1900-01-01' }, { nome: 'X', data_atendimento: '2099-01-01' },
      { nome: 'X', idade: 'abc' }, { nome: 'X', data_nascimento: '2000-01-01', idade: '5' },
    ]) {
      const r = await fetch(`${base}/api/prontuarios`, json({ enfermaria_id: 'masculina', dados }, { headers: { Cookie: cookie } }));
      expect(r.status, JSON.stringify(dados)).toBe(422);
    }
    const ped = await fetch(`${base}/api/prontuarios`, json({ enfermaria_id: 'pediatria', dados: { nome: 'X', adicionais: 'item' } }, { headers: { Cookie: cookie } }));
    expect(ped.status).toBe(422);
    expect(db.estado.prontuarios.length).toBe(antes);
  });

  it('enfermaria desconhecida e opção de prescrição não liberada são recusadas', async () => {
    const { cookie } = await logar();
    const h = { headers: { Cookie: cookie } };
    expect((await fetch(`${base}/api/prontuarios`, json({ enfermaria_id: 'outra', dados: { nome: 'X' } }, h))).status).toBe(422);
    expect((await fetch(`${base}/api/prontuarios`, json({ enfermaria_id: 'masculina', dados: { nome: 'X', incluir: ['DIPIRONA 1G'] } }, h))).status).toBe(422);
  });

  it('lista e reabre pelo ID, e rejeita ID malformado', async () => {
    const { cookie } = await logar();
    await fetch(`${base}/api/prontuarios`, json(valido, { headers: { Cookie: cookie } }));
    const lista = await (await fetch(`${base}/api/prontuarios`, { headers: { Cookie: cookie } })).json();
    expect(lista.length).toBeGreaterThan(0);
    const um = await fetch(`${base}/api/prontuarios/${lista[0].id}`, { headers: { Cookie: cookie } });
    expect((await um.json()).dados.nome).toBe('Fulano de Tal');
    expect(db.estado.eventos.some((e) => e.acao === 'CONSULTADO')).toBe(true);
    expect((await fetch(`${base}/api/prontuarios/1;DROP`, { headers: { Cookie: cookie } })).status).toBe(400);
  });
});

describe('proteções', () => {
  it('barra pedido de outro site (CSRF) e corpo que não é JSON', async () => {
    const { cookie } = await logar();
    const outro = await fetch(`${base}/api/prontuarios`, json(valido, { headers: { Cookie: cookie, Origin: 'https://site-malicioso.example' } }));
    expect(outro.status).toBe(403);
    const form = await fetch(`${base}/api/prontuarios`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'text/plain' }, body: 'x' });
    expect(form.status).toBe(415);
  });

  it('aceita o Origin do próprio site atrás de proxy (X-Forwarded-Host) e recusa Origin diferente', async () => {
    const { cookie } = await logar();
    const h = (origin) => json(valido, { headers: { Cookie: cookie, Origin: origin, 'X-Forwarded-Host': 'prontuario.exemplo.com' } });
    expect((await fetch(`${base}/api/prontuarios`, h('https://prontuario.exemplo.com'))).status).toBe(201);
    expect((await fetch(`${base}/api/prontuarios`, h('https://outro.exemplo.com'))).status).toBe(403);
  });

  it('exige segredo longo', () => {
    expect(() => criarApp({ db, segredo: 'curto' })).toThrow(/32 caracteres/);
  });

  it('limita tentativas de login (429 depois de 10)', async () => {
    const local = criarApp({ db: bancoFalso(), segredo: SEGREDO }).listen(0);
    await new Promise((r) => local.once('listening', r));
    const url = `http://localhost:${local.address().port}/api/login`;
    const codigos = [];
    for (let i = 0; i < 12; i++) codigos.push((await fetch(url, json({ email: 'a@a.com', senha: 'x' }))).status);
    local.close();
    expect(codigos.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codigos.slice(10)).toEqual([429, 429]);
  });
});
