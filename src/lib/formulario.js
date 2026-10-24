import { hojeBr, lerIdade, pesoValido, validarDados } from './regras.js';
import { montarDadosAlta } from './dados.js';

const PRESCRICAO = ['dieta', 'incluir', 'adicionais'];
const RN = ['prontuario_rn', 'registro_rn', 'idade_rn', 'peso_rn', 'indicacao_rn', 'incluir_rn', 'adicionais_rn', 'exame_rn'];
const IDENTIFICACAO = ['nome', 'data_atendimento', 'hora_atendimento', 'prontuario', 'registro', 'data_nascimento', 'idade', 'peso', 'leito', 'data_admissao', 'hipotese'];
const EVOLUCAO = ['relato', 'hpp', 'evolucao', 'exame_fisico', 'conduta', 'solicitacao'];
const ALTA = ['nome', 'incluir', 'prescricao'];
const TITULOS = { masculina: 'Enfermaria Masculina', feminina: 'Enfermaria Feminina', psiquiatria: 'Psiquiatria', pediatria: 'Pediatria', puerpera: 'Puérpera (mãe e RN)' };

/** Caminhos conferidos no Google Forms do hospital; RN faz parte da prescrição da mãe. */
export function secoesFormulario(enfermaria) {
  const inicio = { id: 'enfermaria', titulo: 'Enfermaria', campos: ['enfermaria'] };
  if (!enfermaria) return [inicio];
  if (enfermaria.receitaAlta) return [inicio, { id: 'alta', titulo: 'Receita de alta – puérpera', campos: ALTA }];
  return [inicio,
    { id: 'prescricao', titulo: `Prescrição – ${TITULOS[enfermaria.modelo] || enfermaria.nome}`, campos: [...PRESCRICAO, ...(enfermaria.puerpera ? RN : [])] },
    { id: 'identificacao', titulo: 'Identificação do paciente', campos: IDENTIFICACAO },
    { id: 'evolucao', titulo: 'Evolução / exame físico', campos: EVOLUCAO },
  ];
}

const separados = enf => enf?.receitaAlta ? [...ALTA, 'data_atendimento', 'hora_atendimento'] : [...PRESCRICAO, ...RN];

/** As seções de cada modelo guardam respostas próprias, como no Forms. */
export function criarRespostas(inicial, enfermaria) {
  const comuns = {}, secao = {};
  for (const [campo, valor] of Object.entries(inicial?.dados || {})) {
    (separados(enfermaria).includes(campo) ? secao : comuns)[campo] = valor;
  }
  return { comuns, secoes: enfermaria ? { [enfermaria.modelo]: secao } : {} };
}

export function dadosDaSecao(respostas, enfermaria) {
  const secao = respostas.secoes[enfermaria?.modelo] || {};
  return enfermaria?.receitaAlta ? { ...secao } : { ...respostas.comuns, ...secao };
}

export function atualizarResposta(respostas, enfermaria, campo, valor) {
  if (!separados(enfermaria).includes(campo)) return { ...respostas, comuns: { ...respostas.comuns, [campo]: valor } };
  const chave = enfermaria.modelo;
  return { ...respostas, secoes: { ...respostas.secoes, [chave]: { ...respostas.secoes[chave], [campo]: valor } } };
}

/** Erros apontam para campos preenchíveis na etapa correta, inclusive os pré-requisitos pediátricos. */
export function conferirFormulario(d, enf, config, hoje = hojeBr()) {
  if (!enf) return { enfermaria: 'Escolha uma enfermaria.' };
  const erros = {};
  if (!String(d.nome || '').trim()) erros.nome = enf.receitaAlta ? 'Informe o nome da puérpera.' : 'Informe o nome do paciente.';
  if (enf.receitaAlta) {
    try { montarDadosAlta(d, { catalogos: config.catalogos }); }
    catch (e) { erros.incluir = e.message; }
    return erros;
  }
  const lista = validarDados(d, { hoje, modelo: enf, catalogos: config.catalogos,
    anoMinimoAdmissao: config.hospital.anoMinimoAdmissao, diasMaximosAtraso: config.hospital.diasMaximosAtrasoAtendimento });
  for (const { campo, mensagem } of lista) {
    if (campo === 'adicionais' && enf.pediatrica) {
      if (!lerIdade(d.idade) && !d.data_nascimento) erros.idade = mensagem;
      if (!pesoValido(d.peso)) erros.peso = mensagem;
      if (!String(d.hipotese || '').trim()) erros.hipotese = mensagem;
    } else erros[campo] = mensagem;
  }
  return erros;
}
