import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import Formulario from '../src/components/Formulario.jsx';
import { EscolhaUnica } from '../src/components/Campos.jsx';
import { atualizarResposta, criarRespostas, dadosDaSecao, secoesFormulario, conferirFormulario } from '../src/lib/formulario.js';

const ler = f => JSON.parse(fs.readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8'));
const config = { hospital: ler('hospital/hospital.json'), enfermarias: ler('config/enfermarias.json'), dietas: ler('config/dietas.json'), catalogos: ler('config/prescricoes.json') };
const enf = id => config.enfermarias.find(e => e.id === id);

describe('mesmo preenchimento do Google Forms', () => {
  it('começa só pela escolha obrigatória da enfermaria, sem opção pré-selecionada', () => {
    const html = renderToStaticMarkup(React.createElement(Formulario, { config }));
    expect(html).toContain('Escolher');
    expect(html).toContain('Avançar');
    expect(html).not.toContain('Nome completo do paciente');
    expect(html).not.toContain('Gerar documento');
    expect(html).toContain('<option value="" selected="">Escolher</option>');
  });
  it.each(config.enfermarias.filter(e => !e.receitaAlta).map(e => [e.id]))('%s segue enfermaria → prescrição → identificação → evolução', id => {
    expect(secoesFormulario(enf(id)).map(s => s.id)).toEqual(['enfermaria', 'prescricao', 'identificacao', 'evolucao']);
  });
  it('a receita de alta segue direto para o formulário específico', () => {
    const secoes = secoesFormulario(enf('alta-puerpera'));
    expect(secoes.map(s => s.id)).toEqual(['enfermaria', 'alta']);
    expect(secoes[1].campos).toEqual(['nome', 'incluir', 'prescricao']);
  });
  it('os campos de RN aparecem na seção de prescrição somente para puérpera', () => {
    expect(secoesFormulario(enf('puerpera'))[1].campos).toContain('peso_rn');
    expect(secoesFormulario(enf('masculina'))[1].campos).not.toContain('peso_rn');
    expect(secoesFormulario(enf('puerpera'))[1].titulo).toBe('Prescrição – Puérpera (mãe e RN)');
  });
  it('a dieta usa escolha única com Outro e não vem marcada', () => {
    const html = renderToStaticMarkup(React.createElement(EscolhaUnica, { nome: 'dieta', rotulo: 'Dieta', opcoes: [config.dietas.semDieta, ...config.dietas.opcoes], d: {}, erros: {}, set() {} }));
    expect((html.match(/type="radio"/g) || []).length).toBe(10);
    expect(html).toContain('Outro:');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('checked=""');
  });
  it('restaura a dieta personalizada ao reabrir um registro', () => {
    const html = renderToStaticMarkup(React.createElement(EscolhaUnica, { nome: 'dieta', rotulo: 'Dieta', opcoes: config.dietas.opcoes, d: { dieta: 'Dieta de teste' }, erros: {}, set() {} }));
    expect(html).toContain('value="Dieta de teste"');
    expect(html).toContain('Outra dieta');
    expect(html).toContain('checked=""');
  });
});

describe('respostas por seção', () => {
  it('preserva textos comuns e separa prescrições ao trocar de enfermaria', () => {
    let respostas = criarRespostas();
    respostas = atualizarResposta(respostas, enf('masculina'), 'nome', 'PACIENTE FICTÍCIO');
    respostas = atualizarResposta(respostas, enf('masculina'), 'adicionais', 'ITEM TESTE MASCULINA');
    respostas = atualizarResposta(respostas, enf('masculina'), 'dieta', 'DIETA BRANDA');
    expect(dadosDaSecao(respostas, enf('feminina'))).toEqual({ nome: 'PACIENTE FICTÍCIO' });
    expect(dadosDaSecao(respostas, enf('masculina'))).toMatchObject({ adicionais: 'ITEM TESTE MASCULINA', dieta: 'DIETA BRANDA' });
    expect(dadosDaSecao(respostas, enf('ps-masculino'))).toMatchObject({ adicionais: 'ITEM TESTE MASCULINA' });
  });
  it('reabre respostas existentes sem perder a prescrição nem a identificação', () => {
    const dados = { nome: 'TESTE', idade: '30', incluir: ['REGISTRAR SINAIS VITAIS'], dieta: 'Outra dieta' };
    expect(dadosDaSecao(criarRespostas({ dados }, enf('masculina')), enf('masculina'))).toEqual(dados);
  });
  it('não mistura o nome da alta com a identificação da internação', () => {
    let respostas = atualizarResposta(criarRespostas(), enf('masculina'), 'nome', 'NOME INTERNAÇÃO');
    respostas = atualizarResposta(respostas, enf('alta-puerpera'), 'nome', 'NOME ALTA');
    expect(dadosDaSecao(respostas, enf('alta-puerpera')).nome).toBe('NOME ALTA');
    expect(dadosDaSecao(respostas, enf('masculina')).nome).toBe('NOME INTERNAÇÃO');
  });
  it('preserva data e hora de uma receita de alta já existente no histórico', () => {
    const dados = { nome: 'TESTE ALTA', data_atendimento: '2026-10-20', hora_atendimento: '09:30', prescricao: 'ITEM FICTÍCIO' };
    expect(dadosDaSecao(criarRespostas({ dados }, enf('alta-puerpera')), enf('alta-puerpera'))).toEqual(dados);
  });
  it('leva os requisitos pediátricos à identificação, permitindo avançar a partir da prescrição', () => {
    const erros = conferirFormulario({ nome: 'TESTE', adicionais: 'ITEM FICTÍCIO' }, enf('pediatria'), config, '23/10/2026');
    expect(Object.keys(erros)).toEqual(expect.arrayContaining(['idade', 'peso', 'hipotese']));
    expect(erros.adicionais).toBeUndefined();
    expect(secoesFormulario(enf('pediatria'))[2].campos).toEqual(expect.arrayContaining(Object.keys(erros)));
  });
});
