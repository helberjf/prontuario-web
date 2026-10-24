import { test, expect } from '@playwright/test';
import PizZip from 'pizzip';
import { iniciar, identificar } from './helpers.js';

test('enfermaria obrigatória e escolhas vazias', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.getByText('Escolha uma enfermaria.', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Enfermaria', exact: true }).selectOption('masculina');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.locator('input:checked')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(10);
  await expect(page.getByRole('checkbox')).toHaveCount(3);
});

for (const [id, titulo] of [
  ['masculina', 'Enfermaria Masculina'], ['feminina', 'Enfermaria Feminina'], ['psiquiatria', 'Psiquiatria'],
  ['pediatria', 'Pediatria'], ['puerpera', 'Puérpera (mãe e RN)'], ['ps-masculino', 'Enfermaria Masculina'], ['ps-feminino', 'Enfermaria Feminina'],
]) {
  test(`caminho ${id}: prescrição → identificação → evolução`, async ({ page }) => {
    await iniciar(page, id);
    await expect(page.getByRole('heading', { name: `Prescrição – ${titulo}`, exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Prontuário do RN', exact: true })).toHaveCount(id === 'puerpera' ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Gerar documento', exact: true })).toHaveCount(0);
    await identificar(page, 'PACIENTE FICTÍCIO PARA TESTE');
    await expect(page.getByRole('button', { name: 'Gerar documento', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(6);
  });
}

test('Outro vazio impede avanço; texto e checkboxes são preservados', async ({ page }) => {
  await iniciar(page);
  await page.getByRole('radio', { name: 'Outro:', exact: true }).check();
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Outra dieta', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Outra dieta', exact: true }).fill('DIETA FICTÍCIA PARA TESTE');
  await page.getByRole('checkbox', { name: 'REGISTRAR SINAIS VITAIS', exact: true }).check();
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Outra dieta', exact: true })).toHaveValue('DIETA FICTÍCIA PARA TESTE');
  await expect(page.getByRole('checkbox', { name: 'REGISTRAR SINAIS VITAIS', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Enfermaria', exact: true }).selectOption('feminina');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.locator('input:checked')).toHaveCount(0);
});

test('pré-requisitos pediátricos aparecem na identificação', async ({ page }) => {
  await iniciar(page, 'pediatria');
  await page.getByRole('textbox', { name: 'Itens adicionais da prescrição', exact: true }).fill('ITEM FICTÍCIO SEM USO CLÍNICO');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome completo do paciente', exact: true }).fill('TESTE PEDIÁTRICO FICTÍCIO');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  for (const rotulo of ['Idade', 'Peso (kg)', 'Hipótese diagnóstica']) await expect(page.getByRole('textbox', { name: rotulo, exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('textbox', { name: 'Idade', exact: true }).fill('5 anos');
  await page.getByRole('textbox', { name: 'Peso (kg)', exact: true }).fill('20,5');
  await page.getByRole('textbox', { name: 'Hipótese diagnóstica', exact: true }).fill('TESTE TÉCNICO SEM PACIENTE REAL');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evolução / exame físico', exact: true })).toBeVisible();
});

test('RN exige dados próprios e permite selecionar os lembretes separados', async ({ page }) => {
  await iniciar(page, 'puerpera');
  await page.getByRole('textbox', { name: 'Itens adicionais da prescrição do RN', exact: true }).fill('ITEM FICTÍCIO DO RN');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Itens adicionais da prescrição do RN', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('textbox', { name: 'Idade do RN', exact: true }).fill('2 dias');
  await page.getByRole('textbox', { name: 'Peso do RN (kg)', exact: true }).fill('3,2');
  await page.getByRole('textbox', { name: 'Indicação da prescrição do RN', exact: true }).fill('TESTE FICTÍCIO');
  await page.getByRole('group', { name: 'Itens para incluir na prescrição do RN', exact: true }).getByRole('checkbox', { name: 'REGISTRAR SINAIS VITAIS', exact: true }).check();
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Identificação do paciente', exact: true })).toBeVisible();
});

for (const alta of [false, true]) {
  test(`${alta ? 'alta' : 'internação'}: gera DOCX real, salva e reabre pelo histórico`, async ({ page }, info) => {
    const nome = `TESTE E2E ${alta ? 'ALTA' : 'INTERNAÇÃO'} ${info.project.name.toUpperCase()}`;
    await iniciar(page, alta ? 'alta-puerpera' : 'masculina');
    if (alta) {
      await page.getByRole('textbox', { name: 'Nome da puérpera', exact: true }).fill(nome);
      await page.getByRole('checkbox', { name: 'REGISTRAR ORIENTAÇÕES MÉDICAS DE ALTA', exact: true }).check();
    } else {
      await page.getByRole('radio', { name: 'DIETA BRANDA', exact: true }).check();
      await identificar(page, nome);
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gerar documento', exact: true }).click();
    const arquivo = await download;
    const destino = info.outputPath('documento-ficticio.docx');
    await arquivo.saveAs(destino);
    expect(arquivo.suggestedFilename()).toMatch(/\.docx$/);
    const zip = new PizZip(await import('node:fs/promises').then(fs => fs.readFile(destino)));
    const xml = zip.file('word/document.xml').asText();
    expect(xml).toContain(nome);
    expect(xml).not.toContain('{{');
    expect(xml).toContain(alta ? 'REGISTRAR ORIENTAÇÕES MÉDICAS DE ALTA' : 'DIETA BRANDA');
    await expect(page.getByRole('heading', { name: 'Documento gerado', exact: true })).toBeVisible();
    if (alta) await expect(page.getByText(/passou de 0 itens/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    await page.getByRole('textbox', { name: 'Buscar por nome do paciente', exact: true }).fill(nome);
    const linha = page.getByRole('row').filter({ hasText: nome });
    await expect(linha).toHaveCount(1);
    await linha.getByRole('button', { name: 'Reabrir como novo', exact: true }).click();
    await page.getByRole('button', { name: 'Avançar', exact: true }).click();
    if (alta) await expect(page.getByRole('textbox', { name: 'Nome da puérpera', exact: true })).toHaveValue(nome);
    else {
      await expect(page.getByRole('radio', { name: 'DIETA BRANDA', exact: true })).toBeChecked();
      await page.getByRole('button', { name: 'Avançar', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Nome completo do paciente', exact: true })).toHaveValue(nome);
    }
  });
}

test('falha ao salvar não gera documento', async ({ page }) => {
  await iniciar(page);
  await identificar(page, 'TESTE SEM CONEXÃO');
  await page.route('**/api/prontuarios', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, json: { erro: 'Indisponível para teste.' } }) : route.continue());
  let baixou = false;
  page.on('download', () => { baixou = true; });
  await page.getByRole('button', { name: 'Gerar documento', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Indisponível para teste.');
  expect(baixou).toBe(false);
  await expect(page.getByRole('button', { name: 'Gerar documento', exact: true })).toBeEnabled();
});

test.describe('login pela interface', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('credenciais erradas, login, recarregamento e logout', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('demo@example.com');
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill('demo-demo-demo');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Enfermaria', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Enfermaria', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sair (Demonstração)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  });
});
