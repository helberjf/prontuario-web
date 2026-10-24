import { request } from '@playwright/test';
import fs from 'node:fs/promises';

export default async function preparar() {
  await fs.mkdir('e2e/.auth', { recursive: true });
  const api = await request.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const r = await api.post('/api/login', { data: { email: 'demo@example.com', senha: 'demo-demo-demo' } });
  if (!r.ok()) throw new Error(`Falha no login de demonstração: ${r.status()}`);
  await api.storageState({ path: 'e2e/.auth/demo.json' });
  await api.dispose();
}
