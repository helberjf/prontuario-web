import { describe, expect, it } from 'vitest';
import {
  dataCurta, diasEntre, distribuirNaTabela, formatarDataResposta, haItemClinico, lerIdade, montarPrescricao,
  normalizarDieta, normalizarHora, validarDados, PADRAO_IDADE, PADRAO_PESO,
} from '../src/lib/regras.js';

const catalogos = {
  pediatria: [{ texto: 'REGISTRAR SINAIS VITAIS', tipo: 'registro' }, { texto: 'ITEM REVISADO', revisado: true }, { texto: 'NÃO REVISADO' }],
  rn: [{ texto: 'REGISTRAR PESO DO RN', tipo: 'registro' }, { texto: 'ITEM RN', revisado: true }],
};
const hoje = '20/10/2026';
const validar = (d, modelo = {}) => validarDados(d, { hoje, modelo, catalogos });
const campos = (erros) => erros.map((e) => e.campo);

describe('datas', () => {
  it('formata e calcula', () => {
    expect(formatarDataResposta('2026-10-09')).toBe('09/10/2026');
    expect(dataCurta('19/10/2026')).toBe('19/10/26');
    expect(diasEntre('09/10/2026', '19/10/2026')).toBe('10');
    expect(diasEntre('19/10/2026', '09/10/2026')).toBe('0');
    expect(normalizarHora('9:05')).toBe('09:05');
    expect(normalizarHora('25:00')).toBe('');
  });
});

describe('idade composta', () => {
  it('entende os formatos usados pelos médicos', () => {
    expect(lerIdade('66')).toMatchObject({ anos: 66, menor: 'anos' });
    expect(lerIdade('1 ano e 3 meses')).toMatchObject({ anos: 1, meses: 3, menor: 'meses' });
    expect(lerIdade('1a3m')).toMatchObject({ anos: 1, meses: 3 });
    expect(lerIdade('3 meses e 10 dias')).toMatchObject({ meses: 3, dias: 10, menor: 'dias' });
    expect(lerIdade('15d')).toMatchObject({ dias: 15 });
    for (const ruim of ['RN', '3 meses 1 ano', '1 ano e', '', 'abc']) expect(lerIdade(ruim)).toBeNull();
  });

  it('o padrão do campo concorda com o parser', () => {
    const re = new RegExp(`^${PADRAO_IDADE}$`);
    for (const ok of ['66', '66 anos', '1 ano e 3 meses', '1a 3m', '15 dias']) expect(re.test(ok), ok).toBe(true);
    for (const ruim of ['RN', 'abc', '']) expect(re.test(ruim), ruim).toBe(false);
    const peso = new RegExp(`^${PADRAO_PESO}$`);
    expect(peso.test('70,5') && !peso.test('70kg')).toBe(true);
  });

  it('confere com o nascimento na data do atendimento', () => {
    // nasceu em 10/07/2025: em 20/10/2026 tem 1 ano, 3 meses e 10 dias (467 dias)
    for (const idade of ['1 ano e 3 meses', '1a 3m', '15 meses', '1 ano, 3 meses e 10 dias', '467 dias', '1']) {
      expect(validar({ data_nascimento: '2025-07-10', idade }), idade).toEqual([]);
    }
    for (const idade of ['1 ano e 4 meses', '2 anos', '1 ano, 3 meses e 20 dias']) {
      expect(campos(validar({ data_nascimento: '2025-07-10', idade })), idade).toContain('idade');
    }
  });
});

describe('validação de datas', () => {
  it('barra ano 1900, data inexistente, futura e nascimento posterior à admissão', () => {
    for (const d of [
      { data_admissao: '1900-01-01' }, { data_admissao: '2026-02-31' }, { data_nascimento: '2027-01-01' },
      { data_admissao: '2026-10-21' }, { data_nascimento: '2026-10-19', data_admissao: '2026-10-18' },
    ]) expect(validar(d).length, JSON.stringify(d)).toBeGreaterThan(0);
  });

  it('data do atendimento: nunca futura nem com ano trocado; admissão não pode vir depois', () => {
    expect(validar({ data_atendimento: '2026-10-18', data_admissao: '2026-10-15', data_nascimento: '2000-10-19', idade: '25' })).toEqual([]);
    expect(campos(validar({ data_atendimento: '2026-10-21' }))).toContain('data_atendimento');
    expect(campos(validar({ data_atendimento: '2025-10-18' }))).toContain('data_atendimento');
    expect(campos(validar({ data_atendimento: '2026-10-18', data_admissao: '2026-10-19' }))).toContain('data_admissao');
    expect(campos(validar({ hora_atendimento: '25:00' }))).toContain('hora_atendimento');
  });
});

describe('prescrição', () => {
  it('só entra dieta, itens escolhidos e itens digitados (nada herdado)', () => {
    expect(montarPrescricao(catalogos.pediatria, [], '', '')).toEqual([]);
    expect(montarPrescricao(catalogos.pediatria, ['ITEM REVISADO'], 'dieta zero', '1- ceftriaxona 1g\n\n- omeprazol'))
      .toEqual(['DIETA ZERO', 'ITEM REVISADO', 'CEFTRIAXONA 1G', 'OMEPRAZOL']);
    expect(normalizarDieta('Sem dieta informada')).toBe('');
  });

  it('recusa opção que não está liberada', () => {
    expect(() => montarPrescricao(catalogos.pediatria, ['NÃO REVISADO'], '', '')).toThrow(/não revisada/);
  });

  it('pediatria e RN exigem idade, peso e indicação quando há item clínico', () => {
    const ped = { pediatrica: true };
    expect(campos(validar({ adicionais: 'ITEM X' }, ped))).toContain('adicionais');
    expect(validar({ adicionais: 'ITEM X', idade: '2 anos', peso: '12,5', hipotese: 'indicação' }, ped)).toEqual([]);
    expect(validar({ incluir: ['REGISTRAR SINAIS VITAIS'] }, ped)).toEqual([]); // lembrete não conta
    expect(haItemClinico(catalogos.pediatria, ['ITEM REVISADO'], '')).toBe(true);
    expect(campos(validar({ adicionais_rn: 'ITEM RN' }, { puerpera: true }))).toContain('adicionais_rn');
  });

  it('distribui nas linhas e manda o excesso para a continuação', () => {
    const itens = Array.from({ length: 5 }, (_, i) => `ITEM ${i + 1}`);
    const t = distribuirNaTabela(itens, 3, 'PRESCRIÇÃO');
    expect(t.linhas).toEqual({ 1: 'ITEM 1', 2: 'ITEM 2', 3: 'ITEM 3' });
    expect(t.extra.map((e) => e.texto)).toEqual(['CONTINUAÇÃO DA PRESCRIÇÃO:', '04 – ITEM 4', '05 – ITEM 5']);
    expect(distribuirNaTabela(itens.slice(0, 2), 3, 'X').extra).toEqual([]);
  });
});
