import { expect } from '@playwright/test';

export async function iniciar(page, enfermaria = 'masculina') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Enfermaria', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Enfermaria', exact: true }).selectOption(enfermaria);
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
}

export async function identificar(page, nome) {
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Identificação do paciente', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome completo do paciente', exact: true }).fill(nome);
  await page.getByRole('textbox', { name: 'Idade', exact: true }).fill('30');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evolução / exame físico', exact: true })).toBeVisible();
}
