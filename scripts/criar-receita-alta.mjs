/**
 * Cria public/modelos/receita-alta.docx a partir do pacote de feminina.docx: mantém estilos, fontes, logo,
 * cabeçalho e rodapé do hospital e troca só o corpo do documento.
 * Uso: node scripts/criar-receita-alta.mjs  (depois de preparar-modelos.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const PASTA = path.join(import.meta.dirname, '..', 'public', 'modelos');
const zip = new PizZip(fs.readFileSync(path.join(PASTA, 'feminina.docx')));
const xml = zip.file('word/document.xml').asText();

const logo = xml.match(/<w:drawing>[\s\S]*?<\/w:drawing>/)?.[0];
const sectPr = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)?.at(-1);
if (!logo || !sectPr) throw new Error('feminina.docx sem logo ou sectPr; rode preparar-modelos primeiro.');

const fonte = (nome, tamanho, negrito = false) =>
  `<w:rPr><w:rFonts w:ascii="${nome}" w:cs="${nome}" w:eastAsia="${nome}" w:hAnsi="${nome}"/>${negrito ? '<w:b/>' : ''}` +
  `<w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/></w:rPr>`;
const par = (texto, { nome = 'Kanit', tamanho = 22, negrito = false, antes = 0, depois = 120, centro = false } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${antes}" w:after="${depois}"/>${centro ? '<w:jc w:val="center"/>' : ''}</w:pPr>` +
  `<w:r>${fonte(nome, tamanho, negrito)}<w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`;

const corpo =
  `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r>${logo}</w:r></w:p>` +
  par('RECEITA DE ALTA', { nome: 'Archivo Black', tamanho: 32, antes: 240, depois: 60 }) +
  par('REVISÃO E ASSINATURA MÉDICA OBRIGATÓRIAS', { tamanho: 18, depois: 360 }) +
  par('NOME DO PACIENTE: {{NOME}}', { nome: 'Archivo Black', tamanho: 24 }) +
  par('DATA: {{DATA}}', { tamanho: 22, depois: 360 }) +
  par('PRESCRIÇÃO:', { nome: 'Archivo Black', tamanho: 24, depois: 160 }) +
  par('{{#ITENS}}{{numero}} – {{texto}}{{/ITENS}}', { tamanho: 24, depois: 100 }) +
  par('{{#SEM_ITENS}}SEM PRESCRIÇÃO REGISTRADA — PREENCHER{{/SEM_ITENS}}', { tamanho: 24 }) +
  par('ASSINATURA MÉDICA: ____________________', { tamanho: 22, antes: 960 });

const novo = xml.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${corpo}${sectPr}</w:body>`);
zip.file('word/document.xml', novo);
fs.writeFileSync(path.join(PASTA, 'receita-alta.docx'), zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('receita-alta.docx criado');
