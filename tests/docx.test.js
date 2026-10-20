import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { montarDados, montarDadosAlta } from '../src/lib/dados.js';
import { preencherModelo, tamanhoImagem } from '../src/lib/gerarDocx.js';

const PUBLIC = path.join(import.meta.dirname, '..', 'public');
const lerJson = (f) => JSON.parse(fs.readFileSync(path.join(PUBLIC, f), 'utf8'));
const hospital = lerJson('hospital/hospital.json');
const enfermarias = lerJson('config/enfermarias.json');
const catalogos = lerJson('config/prescricoes.json');
const modelo = (nome) => fs.readFileSync(path.join(PUBLIC, 'modelos', `${nome}.docx`));
const AGORA = new Date(2026, 9, 20, 17, 30);

/** Texto corrido de um .docx (corpo, cabeçalhos e rodapés). */
function textoDe(bytes) {
  const zip = new PizZip(bytes);
  return Object.keys(zip.files)
    .filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))
    .map((n) => zip.file(n).asText()
      .replace(/<\/w:p>/g, '\n').replace(/<w:br\/>/g, '\n')
      .replace(/<[^>]+>/g, ''))
    .join('\n');
}

const base = {
  nome: 'Maria da Silva', prontuario: '000123', registro: '999', leito: '05', peso: '70', idade: '66',
  data_nascimento: '1960-01-01', hipotese: 'PNEUMONIA (TESTE)', relato: 'Relato fictício.\nSegunda linha.',
  hpp: 'HAS (teste)', evolucao: 'Estável (teste).', exame_fisico: 'Exame digitado (teste)', conduta: 'Manter internação (teste)',
  solicitacao: 'HEMOGRAMA\nPCR', dieta: 'DIETA ZERO', adicionais: 'ceftriaxona 1g ev 12/12h\nomeprazol 40mg ev 1x/dia',
};

function gerar(enf, form) {
  const e = enfermarias.find((x) => x.id === enf);
  const dados = montarDados(form, { enfermaria: e, catalogos, agora: AGORA });
  return { dados, texto: textoDe(preencherModelo(modelo(e.modelo), dados, hospital, null)) };
}

describe('modelos reais de public/modelos', () => {
  for (const e of enfermarias.filter((x) => !x.receitaAlta)) {
    it(`${e.nome}: preenche sem deixar marcador e com o cabeçalho certo`, () => {
      const { texto } = gerar(e.id, base);
      expect(texto).not.toContain('{{');
      expect(texto).toContain('MARIA DA SILVA');
      expect(texto).toContain(`ENFERMARIA: ${e.textoEnfermaria}`);
      expect(texto).toContain('Prontuário: 000123');
      expect(texto).toContain('20/10/26');
      expect(texto).toContain('PNEUMONIA (TESTE)');
      expect(texto).toContain('DIETA ZERO');
      expect(texto).toContain('CEFTRIAXONA 1G EV 12/12H');
      expect(texto).toContain('Exame digitado (teste)');
      expect(texto).toContain('HEMOGRAMA');
    });
  }

  it('o rodapé usa os dados de public/hospital/hospital.json', () => {
    const { texto } = gerar('masculina', base);
    expect(texto).toContain(hospital.endereco);
    expect(texto).toContain(`TEL: ${hospital.telefone}`);
  });

  it('prescrição numerada sem buracos, sem continuação quando cabe', () => {
    const { texto } = gerar('masculina', base);
    const linhas = texto.split('\n').map((l) => l.trim());
    expect(linhas).toContain('01');
    expect(linhas).toContain('DIETA ZERO');
    expect(texto).not.toContain('CONTINUAÇÃO');
  });

  it('o excesso de itens vai para a continuação, sem perder nenhum', () => {
    const muitos = Array.from({ length: 25 }, (_, i) => `ITEM NUMERO ${i + 1}`).join('\n');
    const { texto, dados } = gerar('pediatria', { ...base, dieta: '', adicionais: muitos, idade: '66', peso: '12' });
    expect(texto).toContain('CONTINUAÇÃO DA PRESCRIÇÃO:');
    for (let i = 1; i <= 25; i++) expect(texto).toContain(`ITEM NUMERO ${i}`);
    expect(dados.avisos.join()).toMatch(/CONTINUAÇÃO/);
  });
});

describe('campos vazios nunca viram achado normal', () => {
  it('exame físico vazio fica marcado e gera aviso; sem prescrição também', () => {
    const { texto, dados } = gerar('feminina', { nome: 'Teste' });
    expect(texto).toContain('SEM AVALIAÇÃO REGISTRADA — PREENCHER');
    expect(texto).toContain('NÃO INFORMADO — PREENCHER');
    expect(texto).not.toMatch(/AFEBRIL|GLASGOW|HIDRATADO|ALTA HOSPITALAR/);
    expect(dados.avisos.join('\n')).toMatch(/EXAME FÍSICO: não informado/);
    expect(dados.avisos.join('\n')).toMatch(/PRESCRIÇÃO: sem itens/);
    expect(texto).not.toContain('{{');
  });
});

describe('data do atendimento', () => {
  it('cabeçalho, assinaturas e dias de internação usam a data e a hora do atendimento', () => {
    const { texto, dados } = gerar('masculina', { ...base, data_atendimento: '2026-10-18', hora_atendimento: '7:30', data_admissao: '2026-10-15' });
    expect(dados.atendimento).toBe('18/10/2026');
    expect(texto).toContain('18/10/26');
    expect(texto).toContain('HORA: 07:30');
    expect(texto).toContain('DATA: 18/10/2026');
    expect(texto).toContain('3'); // dias de internação
    expect(texto).not.toContain('20/10/2026');
  });
});

describe('puérpera', () => {
  it('transfere conduta, nascimento, exame do RN, prescrição do RN e indicação', () => {
    const { texto } = gerar('puerpera', {
      ...base, exame_rn: 'Exame do RN (teste)', prontuario_rn: '777', registro_rn: '888', idade_rn: '2 dias', peso_rn: '3,2',
      indicacao_rn: 'indicação do RN', adicionais_rn: 'item rn digitado',
    });
    expect(texto).not.toContain('{{');
    expect(texto).toContain('Exame do RN (teste)');
    expect(texto).toContain('Manter internação (teste)');
    expect(texto).toContain('01/01/1960');
    expect(texto).toContain('ITEM RN DIGITADO');
    expect(texto).toContain('INDICAÇÃO DA PRESCRIÇÃO DO RN: indicação do RN');
    expect(texto).not.toMatch(/Dilata[çc][ãa]o|BCF|Din[âa]mica uterina/i);
  });

  it('sem indicação do RN, a linha da indicação não aparece', () => {
    expect(gerar('puerpera', base).texto).not.toContain('INDICAÇÃO DA PRESCRIÇÃO DO RN');
  });
});

describe('receita de alta', () => {
  const alta = (f) => {
    const dados = montarDadosAlta(f, { catalogos, agora: AGORA });
    return { dados, texto: textoDe(preencherModelo(modelo('receita-alta'), dados, hospital, null)) };
  };

  it('lista os itens numerados com nome, data e rodapé', () => {
    const { texto } = alta({ nome: 'Ana Souza', prescricao: 'item a\nitem b' });
    expect(texto).toContain('NOME DO PACIENTE: ANA SOUZA');
    expect(texto).toContain('01 – ITEM A');
    expect(texto).toContain('02 – ITEM B');
    expect(texto).toContain(hospital.endereco);
    expect(texto).not.toContain('SEM PRESCRIÇÃO');
  });

  it('sem itens, avisa em vez de inventar prescrição', () => {
    const { texto, dados } = alta({ nome: 'Ana Souza' });
    expect(texto).toContain('SEM PRESCRIÇÃO REGISTRADA — PREENCHER');
    expect(dados.avisos.join()).toMatch(/sem prescrição/);
  });
});

describe('logo de public/hospital', () => {
  function png(largura, altura) {
    const crc = (b) => { const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(b)); return c; };
    const chunk = (tipo, dados) => {
      const t = Buffer.concat([Buffer.from(tipo), dados]);
      const n = Buffer.alloc(4); n.writeUInt32BE(dados.length);
      return Buffer.concat([n, t, crc(t)]);
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4); ihdr[8] = 8; ihdr[9] = 0;
    const linha = Buffer.concat([Buffer.from([0]), Buffer.alloc(largura)]);
    const idat = zlib.deflateSync(Buffer.concat(Array(altura).fill(linha)));
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  }

  it('lê o tamanho de JPEG e PNG', () => {
    expect(tamanhoImagem(fs.readFileSync(path.join(PUBLIC, 'hospital/logo.jpg')))).toMatchObject({ ext: 'jpg' });
    expect(tamanhoImagem(png(40, 10))).toEqual({ ext: 'png', largura: 40, altura: 10 });
    expect(() => tamanhoImagem(Buffer.from('texto'))).toThrow(/Logo inválido/);
  });

  it('troca o logo do modelo por um PNG mantendo a proporção e o tipo MIME', () => {
    const e = enfermarias.find((x) => x.id === 'masculina');
    const dados = montarDados(base, { enfermaria: e, catalogos, agora: AGORA });
    const saida = new PizZip(preencherModelo(modelo('masculina'), dados, hospital, png(400, 100)));
    expect(saida.file('word/media/logo-hospital.png')).toBeTruthy();
    expect(saida.file('word/media/image1.jpg')).toBeFalsy();
    expect(saida.file('word/_rels/document.xml.rels').asText()).toContain('media/logo-hospital.png');
    expect(saida.file('[Content_Types].xml').asText()).toMatch(/Extension="png"/);
    const extents = [...saida.file('word/document.xml').asText().matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)];
    expect(extents.length).toBeGreaterThan(0);
    for (const [, cx, cy] of extents) expect(Number(cx) / Number(cy)).toBeCloseTo(4, 1);
  });
});
