import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { iniciar } from './helpers.js';

async function conferirDesign(page, info, tela) {
  const imagem = info.outputPath(`${tela}.png`);
  await page.screenshot({ path: imagem, fullPage: true, animations: 'disabled' });
  await info.attach(`${tela}-captura`, { path: imagem, contentType: 'image/png' });
  const largura = await page.evaluate(() => ({ janela: innerWidth, conteudo: document.documentElement.scrollWidth }));
  expect.soft(largura.conteudo, `${tela}: sem rolagem horizontal da página`).toBeLessThanOrEqual(largura.janela + 1);
  const fora = await page.locator('main input, main select, main textarea, main button, .topo button').evaluateAll(es => es.filter(e => {
    const r = e.getBoundingClientRect();
    return r.width && (r.left < -1 || r.right > innerWidth + 1);
  }).map(e => e.getAttribute('aria-label') || e.textContent || e.tagName));
  expect.soft(fora, `${tela}: controles dentro da tela`).toEqual([]);
  const analise = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const problemas = analise.violations.map(v => ({ regra: v.id, impacto: v.impact, elementos: v.nodes.map(n => ({ alvo: n.target, motivo: n.failureSummary })) }));
  await info.attach(`${tela}-acessibilidade`, { body: JSON.stringify(problemas, null, 2), contentType: 'application/json' });
  expect.soft(problemas, `${tela}: contraste, rótulos e acessibilidade`).toEqual([]);
}

test('design e acessibilidade das etapas', async ({ page }, info) => {
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Enfermaria', exact: true })).toBeVisible();
  await conferirDesign(page, info, 'enfermaria');
  await page.getByRole('combobox', { name: 'Enfermaria', exact: true }).selectOption('masculina');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await page.getByRole('radio', { name: 'Outro:', exact: true }).check();
  await page.getByRole('textbox', { name: 'Outra dieta', exact: true }).fill('DIETA FICTÍCIA PARA CONFERIR O LAYOUT');
  await conferirDesign(page, info, 'prescricao');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await conferirDesign(page, info, 'identificacao');
  await page.getByRole('textbox', { name: 'Nome completo do paciente', exact: true }).fill('TESTE VISUAL SEM PACIENTE REAL');
  await page.getByRole('button', { name: 'Avançar', exact: true }).click();
  await conferirDesign(page, info, 'evolucao');
  await iniciar(page, 'puerpera');
  await conferirDesign(page, info, 'puerpera-rn');
  await iniciar(page, 'alta-puerpera');
  await conferirDesign(page, info, 'alta');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prontuários gerados', exact: true })).toBeVisible();
  await conferirDesign(page, info, 'historico');
  expect(erros).toEqual([]);
});

test('larguras de 320 a 1440px mantêm campos e navegação utilizáveis', async ({ page }) => {
  await iniciar(page, 'puerpera');
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const medidas = await page.evaluate(() => ({ largura: document.documentElement.scrollWidth, janela: innerWidth,
      campos: [...document.querySelectorAll('main input, main select, main textarea')].map(e => ({ id: e.id, x: e.getBoundingClientRect().left, direita: e.getBoundingClientRect().right })) }));
    expect.soft(medidas.largura, `largura ${width}`).toBeLessThanOrEqual(width + 1);
    expect.soft(medidas.campos.filter(c => c.x < -1 || c.direita > width + 1), `campos em ${width}`).toEqual([]);
  }
});

test('cabeçalho mantém contraste em todas as cores do gradiente', async ({ page }) => {
  await page.goto('/');
  await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  const cabecalho = await page.locator('.topo').evaluate(e => ({ fundo: getComputedStyle(e).backgroundImage, texto: getComputedStyle(e).color }));
  const rgb = texto => [...texto.matchAll(/rgba?\(([^)]+)\)/g)].map(m => m[1].split(',').slice(0, 3).map(Number));
  const luz = cor => cor.map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const texto = luz(rgb(cabecalho.texto)[0]);
  const contrastes = rgb(cabecalho.fundo).map(c => (Math.max(luz(c), texto) + 0.05) / (Math.min(luz(c), texto) + 0.05));
  expect(contrastes.length).toBeGreaterThan(1);
  expect(Math.min(...contrastes), 'texto branco legível em todo o cabeçalho').toBeGreaterThanOrEqual(4.5);
  for (const botao of await page.locator('.topo button').all()) {
    for (const estado of ['normal', 'hover']) {
      if (estado === 'hover') await botao.hover();
      const estilo = await botao.evaluate(e => ({ fundo: getComputedStyle(e).backgroundColor, texto: getComputedStyle(e).color }));
      const componentes = estilo.fundo.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number);
      const alpha = componentes[3] ?? 1;
      const luzTexto = luz(rgb(estilo.texto)[0]);
      const razoes = rgb(cabecalho.fundo).map(c => {
        const fundo = luz(c.map((canal, i) => canal * (1 - alpha) + componentes[i] * alpha));
        return (Math.max(fundo, luzTexto) + 0.05) / (Math.min(fundo, luzTexto) + 0.05);
      });
      expect(Math.min(...razoes), `botão ${await botao.textContent()} em ${estado}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('cabeçalho compacto no celular com nome longo', async ({ page }) => {
  await page.route('**/api/eu', r => r.fulfill({ json: { id: 1, email: 'demo@example.com', nome: 'Administrador do Hospital' } }));
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const caixa = await page.locator('.topo').boundingBox();
    expect.soft(caixa.height, `cabeçalho na largura ${width}`).toBeLessThanOrEqual(132);
    await expect(page.getByRole('button', { name: 'Sair (Administrador do Hospital)', exact: true })).toBeVisible();
  }
});

test.describe('design do login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('login acessível sem cortes', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await conferirDesign(page, info, 'login');
  });
});
