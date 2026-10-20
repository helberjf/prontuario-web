/**
 * Prepara os .docx de public/modelos para o site (idempotente):
 *  - cada linha numerada da tabela de prescrição ganha {{RX_n}} (e {{RXRN_n}} na 2ª tabela da puérpera);
 *  - depois de cada tabela de prescrição entra um parágrafo condicional {{#RX_EXTRA}}…{{/RX_EXTRA}} para
 *    itens que não cabem nas linhas (some do documento quando não há excesso);
 *  - os rodapés passam a usar {{HOSPITAL_NOME}}, {{HOSPITAL_ENDERECO}} e {{HOSPITAL_TELEFONE}},
 *    lidos de public/hospital/hospital.json.
 *
 * Uso: node scripts/preparar-modelos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const PASTA = path.join(import.meta.dirname, '..', 'public', 'modelos');

const RUN_ITEM = (texto) =>
  '<w:r><w:rPr><w:rFonts w:ascii="Kanit" w:cs="Kanit" w:eastAsia="Kanit" w:hAnsi="Kanit"/>' +
  '<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">' + texto + '</w:t></w:r>';

const textoDe = (xml) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

/** Parágrafo que só existe se houver itens em excesso. */
const PARAGRAFO_EXTRA = (chave) =>
  '<w:p><w:pPr><w:spacing w:before="60" w:after="0"/></w:pPr>' +
  '<w:r><w:rPr><w:rFonts w:ascii="Kanit" w:cs="Kanit" w:eastAsia="Kanit" w:hAnsi="Kanit"/><w:sz w:val="18"/></w:rPr>' +
  `<w:t xml:space="preserve">{{#${chave}}}{{texto}}{{/${chave}}}</w:t></w:r></w:p>`;

function prepararDocumento(xml) {
  let indiceTabela = 0;
  return xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tabela) => {
    if (!/PRESCRI[ÇC][ÃA]O\s+M[ÉE]DICA/i.test(textoDe(tabela))) return tabela;
    const prefixo = indiceTabela === 0 ? 'RX' : 'RXRN';
    indiceTabela++;
    if (tabela.includes(`{{${prefixo}_1}}`)) return tabela;
    let n = 0;
    const nova = tabela.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, (linha) => {
      const celulas = linha.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
      if (celulas.length < 2) return linha;
      const numero = textoDe(celulas[0]).trim();
      if (!/^\d{1,2}$/.test(numero) || /VIDE\s+VERSO/i.test(textoDe(celulas[1]))) return linha;
      n++;
      const celulaItem = celulas[1].replace(
        /<w:r [^>]*>(?:(?!<\/w:r>)[\s\S])*<\/w:r>|<w:r>(?:(?!<\/w:r>)[\s\S])*<\/w:r>/,
        () => RUN_ITEM(`{{${prefixo}_${n}}}`)
      );
      // A numeração do documento final é sempre 01, 02, 03… sem buracos.
      const celulaNumero = celulas[0].replace(/(<w:t[^>]*>)\d{1,2}(<\/w:t>)/, `$1${String(n).padStart(2, '0')}$2`);
      return linha.replace(celulas[0], celulaNumero).replace(celulas[1], celulaItem);
    });
    return nova + (prefixo === 'RXRN' ? PARAGRAFO_EXTRA('RXRN_INDICACAO') : '') + PARAGRAFO_EXTRA(`${prefixo}_EXTRA`);
  });
}

/** Modelos já preparados antes de existir a indicação do RN: insere o parágrafo condicional que faltar. */
function garantirIndicacaoRn(xml) {
  if (!xml.includes('{{#RXRN_EXTRA}}') || xml.includes('{{#RXRN_INDICACAO}}')) return xml;
  const extra = PARAGRAFO_EXTRA('RXRN_EXTRA');
  return xml.replace(extra, PARAGRAFO_EXTRA('RXRN_INDICACAO') + extra);
}

function prepararRodape(xml) {
  if (xml.includes('{{HOSPITAL_')) return xml;
  return xml
    .replace(/HOSPITAL SÃO BENTO\s*/g, '{{HOSPITAL_NOME}} ')
    .replace(/Praça Frei Ubaldo, 47, Centro, Novo Cruzeiro - MG, CEP 39820-000/g, '{{HOSPITAL_ENDERECO}}')
    .replace(/TEL: \(33\) 3533-1773/g, 'TEL: {{HOSPITAL_TELEFONE}}');
}

for (const arquivo of fs.readdirSync(PASTA).filter((f) => f.endsWith('.docx') && f !== 'receita-alta.docx')) {
  const caminho = path.join(PASTA, arquivo);
  const zip = new PizZip(fs.readFileSync(caminho));
  zip.file('word/document.xml', garantirIndicacaoRn(prepararDocumento(zip.file('word/document.xml').asText())));
  for (const nome of Object.keys(zip.files).filter((n) => /^word\/footer\d*\.xml$/.test(n))) {
    zip.file(nome, prepararRodape(zip.file(nome).asText()));
  }
  fs.writeFileSync(caminho, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  const doc = zip.file('word/document.xml').asText();
  const linhas = (doc.match(/\{\{RX_\d+\}\}/g) || []).length;
  const linhasRn = (doc.match(/\{\{RXRN_\d+\}\}/g) || []).length;
  console.log(`${arquivo}: ${linhas} linhas de prescrição${linhasRn ? ` + ${linhasRn} do RN` : ''}`);
}
