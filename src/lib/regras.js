/**
 * Regras puras (sem React, sem rede): datas, idade, validação e montagem da prescrição.
 * Mesmos critérios do script do Google Forms, para os dois sistemas se comportarem igual.
 * Datas viajam como "aaaa-mm-dd" (campo <input type="date">) ou "dd/mm/aaaa" (documento).
 */

export const SEM_DIETA = 'Sem dieta informada';
export const NAO_INFORMADO = 'NÃO INFORMADO — PREENCHER';
export const SEM_AVALIACAO = 'SEM AVALIAÇÃO REGISTRADA — PREENCHER';

export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

export const nomeParaArquivo = (t) => String(t || '').replace(/\s+/g, ' ').trim().toUpperCase();

export const numero2 = (n) => (n < 10 ? '0' : '') + n;

export function dividirLinhas(texto) {
  return String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** "2026-10-19" -> "19/10/2026"; outros formatos voltam como vieram. */
export function formatarDataResposta(valor) {
  const texto = String(valor || '').trim();
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto;
}

/** "19/10/2026" -> "19/10/26" (cabeçalho da prescrição). */
export function dataCurta(br) {
  const m = String(br || '').match(/^(\d{1,2})\/(\d{1,2})\/\d{2}(\d{2})$/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : String(br || '');
}

/** Data de hoje no fuso do navegador, como "dd/mm/aaaa". */
export function hojeBr(agora = new Date()) {
  return `${numero2(agora.getDate())}/${numero2(agora.getMonth() + 1)}/${agora.getFullYear()}`;
}

export function horaAgora(agora = new Date()) {
  return `${numero2(agora.getHours())}:${numero2(agora.getMinutes())}`;
}

/** "9:05" -> "09:05"; formato inválido -> "". */
export function normalizarHora(valor) {
  const m = String(valor || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${numero2(Number(m[1]))}:${m[2]}` : '';
}

/** Datas ISO ou brasileiras com ano completo, sem o ajuste automático do Date (31/02 vira nulo). */
export function dataRespostaUtc(valor) {
  const m = formatarDataResposta(valor).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 1000) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? d : null;
}

/** Dias entre duas datas "dd/mm/aaaa". Nunca negativo. */
export function diasEntre(inicioBr, fimBr) {
  const a = dataRespostaUtc(inicioBr);
  const b = dataRespostaUtc(fimBr);
  if (!a || !b) return '';
  return String(Math.max(0, Math.round((b - a) / 86400000)));
}

// ---------------------------------------------------------------------------
// Idade
// ---------------------------------------------------------------------------

/**
 * "66", "66 anos", "1 ano e 3 meses", "1a 3m", "3 meses e 10 dias", "15d".
 * Devolve { anos, meses, dias, menor } ou null. Unidades fora de ordem ou repetidas são recusadas.
 */
export function lerIdade(valor) {
  const texto = semAcento(String(valor || '')).trim().toLowerCase();
  if (/^\d+$/.test(texto)) return { anos: Number(texto), meses: 0, dias: 0, menor: 'anos' };
  if (/(?:,|\be)\s*$/.test(texto)) return null; // conector sobrando ("1 ano e")
  let resto = texto.replace(/\s*(?:,|\be\b)\s*/g, ' ').trim();
  const ordem = ['anos', 'meses', 'dias'];
  const partes = { anos: 0, meses: 0, dias: 0 };
  let ultima = -1;
  let m;
  while (resto && (m = resto.match(/^(\d+)\s*(anos|ano|a|meses|mes|m|dias|dia|d)(?![a-z])\s*/))) {
    const unidade = /^a/.test(m[2]) ? 'anos' : /^m/.test(m[2]) ? 'meses' : 'dias';
    if (ordem.indexOf(unidade) <= ultima) return null;
    partes[unidade] = Number(m[1]);
    ultima = ordem.indexOf(unidade);
    resto = resto.slice(m[0].length);
  }
  if (resto || ultima === -1) return null;
  return { ...partes, menor: ordem[ultima] };
}

export function idadeExata(nascimento, referencia) {
  let anos = referencia.getUTCFullYear() - nascimento.getUTCFullYear();
  let meses = referencia.getUTCMonth() - nascimento.getUTCMonth();
  let dias = referencia.getUTCDate() - nascimento.getUTCDate();
  if (dias < 0) {
    meses--;
    dias += new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 0)).getUTCDate();
  }
  if (meses < 0) { anos--; meses += 12; }
  return { anos, meses, dias, totalMeses: anos * 12 + meses, totalDias: Math.floor((referencia - nascimento) / 86400000) };
}

/** A idade digitada bate com o nascimento? Compara na menor unidade informada; em dias aceita ±1. */
export function idadeConfere(idade, nascimento, referencia) {
  const e = idadeExata(nascimento, referencia);
  if (idade.menor === 'anos') return idade.anos === e.anos;
  if (idade.menor === 'meses') return idade.anos * 12 + idade.meses === e.totalMeses;
  if (!idade.anos && !idade.meses) return Math.abs(idade.dias - e.totalDias) <= 1;
  return idade.anos * 12 + idade.meses === e.totalMeses && Math.abs(idade.dias - e.dias) <= 1;
}

/** Mesmas formas de lerIdade, para o atributo "pattern" do <input> (o navegador usa ^…$ sozinho). */
const UNIDADE = '(?:[Aa](?:[Nn][Oo][Ss]?)?|[Mm](?:[EeÊê][Ss](?:[Ee][Ss])?)?|[Dd](?:[Ii][Aa][Ss]?)?)';
export const PADRAO_IDADE = `\\s*\\d+\\s*(?:${UNIDADE}(?:\\s*(?:,|\\s[Ee])?\\s*\\d+\\s*${UNIDADE})*)?\\s*`;
export const PADRAO_PESO = '\\s*\\d+(?:[.,]\\d+)?\\s*';

export function pesoValido(valor) {
  const t = String(valor || '').trim().replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(t) && Number(t) > 0;
}

// ---------------------------------------------------------------------------
// Prescrição
// ---------------------------------------------------------------------------

export function normalizarDieta(dieta) {
  const texto = String(dieta || '').replace(/\s+/g, ' ').trim();
  if (!texto || texto === SEM_DIETA) return '';
  const up = texto.toUpperCase();
  return /^DIETA\b/.test(up) ? up : `DIETA ${up}`;
}

/** "1- dipirona", "02. dipirona", "- dipirona" -> "DIPIRONA". */
export function normalizarItemAdicional(linha) {
  return String(linha || '')
    .replace(/^\s*(?:\d{1,2}\s*[-.)–]\s*|[-•*]\s*)/, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Só opções liberadas (revisado: true, ou lembrete de registro) podem ser escolhidas. */
export function itensLiberados(catalogo) {
  return (catalogo || [])
    .filter((i) => i && String(i.texto || '').trim() && (i.revisado === true || i.tipo === 'registro'))
    .map((i) => String(i.texto).trim());
}

/**
 * Dieta + itens escolhidos do catálogo + itens digitados, nessa ordem. Nada é herdado do modelo:
 * sem seleção e sem texto, a prescrição fica vazia. Opção fora do catálogo é recusada.
 */
export function montarPrescricao(catalogo, selecionados, dieta, adicionais) {
  const disponiveis = itensLiberados(catalogo);
  for (const s of selecionados || []) {
    if (!disponiveis.includes(s)) throw new Error('Opção de prescrição não revisada ou alterada. Atualize a página e selecione novamente.');
  }
  const itens = [];
  const d = normalizarDieta(dieta);
  if (d) itens.push(d);
  disponiveis.filter((i) => (selecionados || []).includes(i)).forEach((i) => itens.push(i));
  dividirLinhas(adicionais).map(normalizarItemAdicional).filter(Boolean).forEach((i) => itens.push(i));
  return itens;
}

/** Há item que não é só lembrete de registro? (aciona as exigências pediátricas/RN) */
export function haItemClinico(catalogo, selecionados, adicionais) {
  const registros = new Set((catalogo || []).filter((i) => i.tipo === 'registro').map((i) => i.texto));
  return dividirLinhas(adicionais).length > 0 || (selecionados || []).some((s) => !registros.has(s));
}

/** Itens em linhas da tabela (numeradas 01..n) + o que não cabe, como parágrafos de continuação. */
export function distribuirNaTabela(itens, totalLinhas, titulo) {
  const linhas = {};
  itens.slice(0, totalLinhas).forEach((texto, i) => { linhas[i + 1] = texto; });
  const sobra = itens.slice(totalLinhas);
  const extra = sobra.length
    ? [{ texto: `CONTINUAÇÃO DA ${titulo}:` }, ...sobra.map((t, k) => ({ texto: `${numero2(totalLinhas + k + 1)} – ${t}` }))]
    : [];
  return { linhas, extra, excedeu: sobra.length };
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/**
 * Bloqueia dados contraditórios antes de gerar o documento. Não valida indicação nem dose.
 * `d` usa as chaves do formulário; devolve uma lista de { campo, mensagem } (vazia = ok).
 */
export function validarDados(d, { hoje, modelo, catalogos, anoMinimoAdmissao = 2000, diasMaximosAtraso = 31 }) {
  const erros = [];
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });

  const hojeUtc = dataRespostaUtc(hoje);
  const atendimentoBr = formatarDataResposta(d.data_atendimento) || hoje;
  const atendimento = dataRespostaUtc(atendimentoBr);
  if (!atendimento || atendimento > hojeUtc || (hojeUtc - atendimento) / 86400000 > diasMaximosAtraso) {
    erro('data_atendimento', `Data do atendimento inválida, futura ou com mais de ${diasMaximosAtraso} dias atrás; confira dia, mês e ano.`);
  }
  if (d.hora_atendimento && !normalizarHora(d.hora_atendimento)) erro('hora_atendimento', 'Hora do atendimento inválida.');

  const admissao = dataRespostaUtc(d.data_admissao || atendimentoBr);
  if (!admissao || admissao.getUTCFullYear() < anoMinimoAdmissao || (atendimento && admissao > atendimento)) {
    erro('data_admissao', 'Data de admissão inválida, antiga ou posterior ao atendimento; corrija o ano e a data.');
  }
  const nascimento = d.data_nascimento ? dataRespostaUtc(d.data_nascimento) : null;
  if (d.data_nascimento && (!nascimento || nascimento > hojeUtc || (admissao && nascimento > admissao))) {
    erro('data_nascimento', 'Data de nascimento inválida ou posterior à admissão/envio.');
  }
  const idade = d.idade ? lerIdade(d.idade) : null;
  if (d.idade && !idade) erro('idade', 'Idade inválida. Exemplos: 66, 66 anos, 1 ano e 3 meses, 15 dias.');
  else if (idade && nascimento && atendimento && !idadeConfere(idade, nascimento, atendimento)) {
    erro('idade', 'Idade incompatível com a data de nascimento na data do atendimento.');
  }
  if (d.peso && !pesoValido(d.peso)) erro('peso', 'Peso inválido; informe um número positivo em kg.');
  if (d.peso_rn && !pesoValido(d.peso_rn)) erro('peso_rn', 'Peso inválido; informe um número positivo em kg.');
  const idadeRn = d.idade_rn ? lerIdade(d.idade_rn) : null;
  if (d.idade_rn && !idadeRn) erro('idade_rn', 'Idade do RN inválida. Exemplos: 2 dias, 1 mês e 5 dias.');

  if (modelo?.pediatrica && haItemClinico(catalogos.pediatria, d.incluir, d.adicionais)
      && (!(idade || nascimento) || !pesoValido(d.peso) || !String(d.hipotese || '').trim())) {
    erro('adicionais', 'Prescrição pediátrica exige idade/nascimento, peso e indicação (hipótese diagnóstica) neste atendimento.');
  }
  if (modelo?.puerpera && haItemClinico(catalogos.rn, d.incluir_rn, d.adicionais_rn)
      && (!idadeRn || !pesoValido(d.peso_rn) || !String(d.indicacao_rn || '').trim())) {
    erro('adicionais_rn', 'Prescrição do RN exige idade, peso e indicação do RN neste atendimento.');
  }
  return erros;
}
