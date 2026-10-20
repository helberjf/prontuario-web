import fs from 'node:fs';
import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { montarDados, montarDadosAlta } from '../src/lib/dados.js';
import { preencherModelo } from '../src/lib/gerarDocx.js';

const PUBLIC = path.join(import.meta.dirname, '..', 'public');
const lerJson = (f) => JSON.parse(fs.readFileSync(path.join(PUBLIC, f), 'utf8'));
const hospital = lerJson('hospital/hospital.json');
const enfermarias = lerJson('config/enfermarias.json');
const catalogos = lerJson('config/prescricoes.json');
const modelo = (n) => fs.readFileSync(path.join(PUBLIC, 'modelos', `${n}.docx`));
const AGORA = new Date(2026, 9, 20, 9, 5);

/** Todas as partes XML do .docx precisam ser XML bem formado, senão o Word recusa o arquivo. */
function conferirXml(bytes) {
  const zip = new PizZip(bytes);
  const partes = Object.keys(zip.files).filter((n) => /\.(xml|rels)$/.test(n));
  expect(partes.length).toBeGreaterThan(5);
  for (const nome of partes) {
    const erros = [];
    new DOMParser({ onError: (nivel, msg) => erros.push(`${nivel}: ${msg}`) }).parseFromString(zip.file(nome).asText(), 'text/xml');
    expect(erros, `${nome} mal formado`).toEqual([]);
  }
  return zip;
}

const textoDe = (zip) => zip.file('word/document.xml').asText().replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const PERIGOSOS = 'Tom & Jerry <script>alert("x")</script> "aspas" \'simples\' ]]> &amp; 😀 ção ñ \u0000x';
const gerar = (e, form) => {
  const dados = e.receitaAlta
    ? montarDadosAlta(form, { catalogos, agora: AGORA })
    : montarDados(form, { enfermaria: e, catalogos, agora: AGORA });
  return preencherModelo(modelo(e.modelo), dados, hospital, null);
};

describe('XML do .docx continua válido', () => {
  for (const e of enfermarias) {
    it(`${e.nome}: texto com & < > aspas, emoji e caractere de controle`, () => {
      const form = {
        nome: PERIGOSOS, prontuario: PERIGOSOS, relato: PERIGOSOS, hpp: PERIGOSOS, evolucao: PERIGOSOS,
        exame_fisico: PERIGOSOS, conduta: PERIGOSOS, solicitacao: `${PERIGOSOS}\n${PERIGOSOS}`,
        adicionais: PERIGOSOS, prescricao: PERIGOSOS, indicacao_rn: PERIGOSOS, adicionais_rn: PERIGOSOS, exame_rn: PERIGOSOS,
      };
      const zip = conferirXml(gerar(e, form));
      const texto = textoDe(zip);
      expect(texto.toUpperCase()).toContain("TOM & JERRY");
      expect(texto.toUpperCase()).toContain("<SCRIPT>ALERT(\"X\")</SCRIPT>"); // aparece como texto, não como marcação
      expect(texto).not.toContain('{{');
    });
  }
});

describe('todas as enfermarias com formulário vazio', () => {
  for (const e of enfermarias) {
    it(`${e.nome}: gera arquivo válido, sem marcador e sem achado clínico`, () => {
      const zip = conferirXml(gerar(e, { nome: 'Teste' }));
      const texto = textoDe(zip);
      expect(texto).not.toContain('{{');
      expect(texto).not.toMatch(/AFEBRIL|GLASGOW|HIDRATAD|ALTA HOSPITALAR|DIPIRONA|INSULINA|HALDOL|AMPLICTIL|Dilata|BCF/i);
      if (e.receitaAlta) expect(texto).toContain('SEM PRESCRIÇÃO REGISTRADA');
      else expect(texto).toContain('SEM AVALIAÇÃO REGISTRADA — PREENCHER');
    });
  }
});

describe('limites', () => {
  it('prescrição enorme (200 itens) cabe: nada se perde e o XML segue válido', () => {
    const itens = Array.from({ length: 200 }, (_, i) => `ITEM LONGO NUMERO ${i + 1}`).join('\n');
    const zip = conferirXml(gerar(enfermarias.find((e) => e.id === 'masculina'), { nome: 'X', adicionais: itens }));
    const texto = textoDe(zip);
    for (const i of [1, 23, 24, 100, 200]) expect(texto).toContain(`ITEM LONGO NUMERO ${i}`);
  });

  it('texto clínico muito longo (200 mil caracteres) é preenchido inteiro', () => {
    const grande = 'abcdefghij '.repeat(20000);
    const texto = textoDe(conferirXml(gerar(enfermarias.find((e) => e.id === 'feminina'), { nome: 'X', evolucao: grande })));
    expect(texto.includes(grande.trim())).toBe(true);
  });

  it('nome só com espaços não vira documento sem nome; quebras de linha viram linhas', () => {
    const dados = montarDados({ nome: '   ', relato: 'a\r\nb\n\nc' }, { enfermaria: enfermarias[0], catalogos, agora: AGORA });
    expect(dados.valores.NOME).toBe('');
    const texto = textoDe(conferirXml(preencherModelo(modelo('masculina'), dados, hospital, null)));
    expect(texto).toMatch(/a\s*\n?\s*b/);
  });

  it('gerar duas vezes seguidas com o mesmo modelo dá o mesmo resultado (sem estado escondido)', () => {
    const e = enfermarias.find((x) => x.id === 'masculina');
    const a = textoDe(conferirXml(gerar(e, { nome: 'Igual', adicionais: 'x' })));
    const b = textoDe(conferirXml(gerar(e, { nome: 'Igual', adicionais: 'x' })));
    expect(a).toBe(b);
  });
});
