/**
 * Cria (ou atualiza a senha de) um usuário.
 *   npm run criar-usuario -- medico@exemplo.com "Nome do Médico" "senha-com-12-ou-mais-caracteres"
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { criarDb } from './db.js';

const [email, nome, senha] = process.argv.slice(2);
if (!email || !nome || !senha) { console.error('Uso: npm run criar-usuario -- email "Nome" "senha"'); process.exit(1); }
if (senha.length < 12) { console.error('A senha precisa ter pelo menos 12 caracteres.'); process.exit(1); }

const db = criarDb();
const hash = await bcrypt.hash(senha, 12);
await db.query(
  `INSERT INTO usuarios (email, nome, senha_hash) VALUES (lower($1), $2, $3)
   ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash, ativo = TRUE`,
  [email, nome, hash],
);
console.log(`Usuário ${email.toLowerCase()} pronto.`);
await db.end();
