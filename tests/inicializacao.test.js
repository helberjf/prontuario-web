import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { lerAmbiente, prepararBanco } from '../server/inicializacao.js';

const ambiente = { DATABASE_URL: 'postgresql://example.invalid/db', ADMIN_EMAIL: ' Admin@Example.com ', ADMIN_PASSWORD: 'senha-teste-segura-123' };

describe('configuração de produção', () => {
  it('usa as variáveis do administrador e mantém a sessão entre instâncias', () => {
    const a = lerAmbiente(ambiente);
    expect(a.admin.email).toBe('admin@example.com');
    expect(a.segredo.length).toBeGreaterThanOrEqual(32);
    expect(a.segredo).toBe(lerAmbiente(ambiente).segredo);
    expect(a.segredo).not.toBe(lerAmbiente({ ...ambiente, ADMIN_PASSWORD: 'outra-senha-teste-123' }).segredo);
  });
  it('respeita JWT_SECRET explícito e usuários criados pelo CLI', () => {
    expect(lerAmbiente({ DATABASE_URL: ambiente.DATABASE_URL, JWT_SECRET: 'x'.repeat(40) })).toMatchObject({ admin: null, segredo: 'x'.repeat(40) });
  });
  it('recusa banco ausente, configuração incompleta e senha curta', () => {
    expect(() => lerAmbiente({ ...ambiente, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => lerAmbiente({ ...ambiente, ADMIN_EMAIL: '' })).toThrow(/ADMIN_EMAIL/);
    expect(() => lerAmbiente({ ...ambiente, ADMIN_PASSWORD: 'curta' })).toThrow(/12/);
    expect(() => lerAmbiente({ ...ambiente, JWT_SECRET: 'curto' })).toThrow(/32/);
  });
});

describe('inicialização persistente', () => {
  function banco({ falhar = false } = {}) {
    const consultas = [];
    let liberado = false;
    const cliente = {
      async query(sql, params) {
        consultas.push({ sql, params });
        if (falhar && /CREATE TABLE/.test(sql)) throw new Error('falha de conexão');
        return { rows: [] };
      },
      release() { liberado = true; },
    };
    return { connect: async () => cliente, consultas, get liberado() { return liberado; } };
  }
  it('cria tabelas e administrador na mesma transação com trava entre instâncias', async () => {
    const db = banco();
    await prepararBanco(db, lerAmbiente(ambiente).admin);
    const sql = db.consultas.map(c => c.sql).join('\n');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prontuarios');
    expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE FROM/);
    const insercao = db.consultas.find(c => /INSERT INTO usuarios/.test(c.sql));
    expect(insercao.params[0]).toBe('admin@example.com');
    expect(await bcrypt.compare(ambiente.ADMIN_PASSWORD, insercao.params[2])).toBe(true);
    expect(insercao.params[2]).not.toContain(ambiente.ADMIN_PASSWORD);
    expect(db.consultas.at(-1).sql).toBe('COMMIT');
    expect(db.liberado).toBe(true);
  });
  it('desfaz a transação e libera conexão em caso de falha', async () => {
    const db = banco({ falhar: true });
    await expect(prepararBanco(db, null)).rejects.toThrow('falha de conexão');
    expect(db.consultas.at(-1).sql).toBe('ROLLBACK');
    expect(db.liberado).toBe(true);
  });
});
