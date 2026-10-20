import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { criarDb } from './db.js';

const db = criarDb();
await db.query(fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8'));
console.log('Tabelas criadas/conferidas no Neon (nada foi apagado).');
await db.end();
