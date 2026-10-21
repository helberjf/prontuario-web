import 'dotenv/config';
import path from 'node:path';
import { iniciarApp } from './inicializacao.js';

const producao = process.env.NODE_ENV === 'production';
const porta = Number(process.env.PORT || 3001);
const app = await iniciarApp({
  pastaWeb: producao ? path.join(import.meta.dirname, '..', 'dist') : null,
});
app.listen(porta, () => console.log(`API em http://localhost:${porta}${producao ? ' (servindo também o site)' : ''}`));
