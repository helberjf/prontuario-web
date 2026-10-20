import {
  NAO_INFORMADO, SEM_AVALIACAO, dataCurta, diasEntre, formatarDataResposta, hojeBr, horaAgora,
  montarPrescricao, nomeParaArquivo, normalizarHora,
} from './regras.js';

const CLINICOS = [
  ['RELATO', 'relato', 'RELATO DE INTERNAÇÃO', NAO_INFORMADO],
  ['HPP', 'hpp', 'HPP', NAO_INFORMADO],
  ['EVOLUCAO', 'evolucao', 'EVOLUÇÃO CLÍNICA', NAO_INFORMADO],
  ['EXAME_FISICO', 'exame_fisico', 'EXAME FÍSICO', SEM_AVALIACAO],
  ['CONDUTA', 'conduta', 'CONDUTA', NAO_INFORMADO],
  ['SOLICITACAO', 'solicitacao', 'SOLICITAÇÃO DE EXAMES', NAO_INFORMADO],
];

const vazio = (v) => !String(v ?? '').trim();

/**
 * Valores que vão para os {{MARCADORES}} do modelo.
 * Campo clínico vazio NUNCA vira achado "normal": fica marcado como não informado e gera aviso.
 * Datas, cabeçalho e dias de internação usam a data do ATENDIMENTO (vazia = hoje).
 */
export function montarDados(f, { enfermaria, catalogos, agora = new Date() }) {
  const avisos = [];
  const envio = hojeBr(agora);
  const atendimento = formatarDataResposta(f.data_atendimento) || envio;
  const hora = normalizarHora(f.hora_atendimento) || horaAgora(agora);
  const admissao = formatarDataResposta(f.data_admissao) || atendimento;

  const valores = {
    NOME: nomeParaArquivo(f.nome),
    PRONTUARIO: f.prontuario, REGISTRO: f.registro,
    DATA: atendimento, DATA_CABECALHO: dataCurta(atendimento), HORA: hora,
    ENFERMARIA: enfermaria.textoEnfermaria, LEITO: f.leito, IDADE: f.idade, PESO: f.peso,
    DATA_ADMISSAO: admissao, DATA_NASCIMENTO: formatarDataResposta(f.data_nascimento),
    DIAS_INTERNACAO: diasEntre(admissao, atendimento), HIPOTESE: f.hipotese,
  };

  const clinicos = [...CLINICOS];
  if (enfermaria.puerpera) clinicos.push(['EXAME_RN', 'exame_rn', 'EXAME DO RN', SEM_AVALIACAO]);
  for (const [marcador, campo, nome, padrao] of clinicos) {
    if (vazio(f[campo])) { valores[marcador] = padrao; avisos.push(`${nome}: não informado; preencher antes do uso.`); }
    else valores[marcador] = String(f[campo]).trim();
  }

  const itens = montarPrescricao(catalogos[enfermaria.catalogo], f.incluir, f.dieta, f.adicionais);
  if (!itens.length) avisos.push('PRESCRIÇÃO: sem itens informados; preencher após avaliação médica.');

  let itensRn = [];
  if (enfermaria.puerpera) {
    Object.assign(valores, {
      PRONTUARIO_RN: f.prontuario_rn, REGISTRO_RN: f.registro_rn, IDADE_RN: f.idade_rn, PESO_RN: f.peso_rn,
    });
    itensRn = montarPrescricao(catalogos.rn, f.incluir_rn, '', f.adicionais_rn);
    if (!itensRn.length) avisos.push('PRESCRIÇÃO DO RN: sem itens informados; preencher após avaliação médica.');
    valores.RXRN_INDICACAO = vazio(f.indicacao_rn) ? [] : [{ texto: `INDICAÇÃO DA PRESCRIÇÃO DO RN: ${String(f.indicacao_rn).trim()}` }];
  }

  const nomeArquivo = `${valores.NOME} - ${atendimento.replaceAll('/', '-')}`;
  return { valores, itens, itensRn, avisos, nomeArquivo, atendimento, hora, envio };
}

/** Receita de alta: nome, data e os itens digitados/selecionados. */
export function montarDadosAlta(f, { catalogos, agora = new Date() }) {
  const avisos = [];
  const envio = hojeBr(agora);
  const atendimento = formatarDataResposta(f.data_atendimento) || envio;
  const itens = montarPrescricao(catalogos.alta, f.incluir, '', f.prescricao);
  if (!itens.length) avisos.push('Receita de alta sem prescrição informada.');
  const valores = {
    NOME: nomeParaArquivo(f.nome),
    DATA: atendimento,
    ITENS: itens.map((texto, i) => ({ numero: String(i + 1).padStart(2, '0'), texto })),
    SEM_ITENS: itens.length ? [] : [{}],
  };
  return { valores, itens, avisos, nomeArquivo: `RECEITA DE ALTA - ${valores.NOME} - ${atendimento.replaceAll('/', '-')}`, atendimento, envio };
}
