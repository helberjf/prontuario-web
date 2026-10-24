import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Apenas navegação: não envia prontuário nem consulta dados de pacientes na produção.
const base = process.env.E2E_ONLINE_URL || 'https://prontuario-web-liard.vercel.app';
const email = process.env.E2E_EMAIL;
const senha = process.env.E2E_PASSWORD;
if (!email || !senha) throw new Error('Defina E2E_EMAIL e E2E_PASSWORD somente no ambiente do processo.');
const pasta = path.resolve(process.env.E2E_EVIDENCIAS || 'test-results/online');
await fs.mkdir(pasta, { recursive: true });
const browser = await chromium.launch();
try {
  const contexto = await browser.newContext({ baseURL: base, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const page = await contexto.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(email);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Enfermaria', exact: true })).toBeVisible();
  const telas = [];
  for (const colorScheme of ['light', 'dark']) {
    for (const [dispositivo, width, height] of [['desktop', 1440, 900], ['celular', 390, 844]]) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height });
      await page.getByRole('button', { name: 'Novo', exact: true }).click();
      await page.getByRole('combobox', { name: 'Enfermaria', exact: true }).selectOption('masculina');
      await page.getByRole('button', { name: 'Avançar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Prescrição – Enfermaria Masculina', exact: true })).toBeVisible();
      await expect(page.getByRole('radio')).toHaveCount(10);
      await expect(page.getByRole('checkbox')).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const imagem = `${dispositivo}-${colorScheme}.png`;
      await page.screenshot({ path: path.join(pasta, imagem), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Avançar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Identificação do paciente', exact: true })).toBeVisible();
      telas.push({ dispositivo, tema: colorScheme, ok: true, imagem });
    }
  }
  expect(erros).toEqual([]);
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: /^Sair/ }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  const resultado = { site: base, login: true, logout: true, telas, errosJavascript: erros, prontuariosCriados: 0 };
  await fs.writeFile(path.join(pasta, 'resultado.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado));
} finally {
  await browser.close();
}
