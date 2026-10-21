import fs from 'node:fs';
import { scryptSync } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { criarDb } from './db.js';
import { criarApp } from './app.js';

/** Somente no servidor: nenhuma credencial é incluída no build do Vite. */
export function lerAmbiente(env = process.env) {
  const url = env.DATABASE_URL || env.POSTGRES_URL;
  if (!url) throw new Error('Defina DATABASE_URL conectando um banco Neon ao projeto.');
  const email = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = env.ADMIN_PASSWORD || '';
  let admin = null;
  if (email || senha) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Defina ADMIN_EMAIL com um e-mail válido.');
    if (senha.length < 12 || Buffer.byteLength(senha, 'utf8') > 72) throw new Error('ADMIN_PASSWORD precisa ter pelo menos 12 caracteres e no máximo 72 bytes.');
    admin = { email, senha, nome: String(env.ADMIN_NAME || 'Administrador do Hospital') };
  }
  // Segredo determinístico entre instâncias; trocar a senha invalida as sessões.
  // JWT_SECRET aleatório pode ser fornecido para separar a chave da credencial.
  const segredo = env.JWT_SECRET || (admin && scryptSync(senha, `prontuario-web:sessao:v1:${email}`, 48).toString('base64url'));
  if (!segredo || segredo.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres, ou configure ADMIN_EMAIL e ADMIN_PASSWORD.');
  return { url, admin, segredo };
}

/** Migração aditiva, serializada entre instâncias, e senha armazenada só como hash. */
export async function prepararBanco(db, admin) {
  const cliente = await db.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(73482190)');
    await cliente.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    if (admin) {
      const { rows } = await cliente.query('SELECT senha_hash, nome, ativo FROM usuarios WHERE email = $1', [admin.email]);
      const atual = rows[0];
      if (!atual || !atual.ativo || atual.nome !== admin.nome || !(await bcrypt.compare(admin.senha, atual.senha_hash))) {
        const hash = await bcrypt.hash(admin.senha, 12);
        await cliente.query(
          `INSERT INTO usuarios (email, nome, senha_hash) VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash, ativo = TRUE`,
          [admin.email, admin.nome, hash],
        );
      }
    }
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

export async function iniciarApp({ env = process.env, pastaWeb = null } = {}) {
  const { url, admin, segredo } = lerAmbiente(env);
  const db = criarDb(url);
  try {
    await prepararBanco(db, admin);
    return criarApp({ db, segredo, producao: env.NODE_ENV === 'production' || env.VERCEL === '1', pastaWeb });
  } catch (erro) {
    await db.end();
    throw erro;
  }
}
