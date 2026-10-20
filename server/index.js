import 'dotenv/config';
import path from 'node:path';
import { criarApp } from './app.js';
import { criarDb } from './db.js';

const producao = process.env.NODE_ENV === 'production';
const porta = Number(process.env.PORT || 3001);
const app = criarApp({
  db: criarDb(),
  segredo: process.env.JWT_SECRET,
  producao,
  pastaWeb: producao ? path.join(import.meta.dirname, '..', 'dist') : null,
});
app.listen(porta, () => console.log(`API em http://localhost:${porta}${producao ? ' (servindo também o site)' : ''}`));
