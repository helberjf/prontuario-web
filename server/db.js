import pg from 'pg';

/** Pool do Neon. DATABASE_URL vem do .env (nunca vai para o navegador nem para o Git). */
export function criarDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('Defina DATABASE_URL no arquivo .env (string de conexão do Neon).');
  return new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: true }, max: 5, idleTimeoutMillis: 30000 });
}
