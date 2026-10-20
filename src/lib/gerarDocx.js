import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { distribuirNaTabela } from './regras.js';

/** Largura e altura de PNG ou JPEG, para manter a proporção do logo trocado. */
export function tamanhoImagem(bytes) {
  const b = new Uint8Array(bytes);
  if (b[0] === 0x89 && b[1] === 0x50) {
    const v = new DataView(b.buffer, b.byteOffset);
    return { ext: 'png', largura: v.getUint32(16), altura: v.getUint32(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    const v = new DataView(b.buffer, b.byteOffset);
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const tipo = b[i + 1];
      if (tipo >= 0xc0 && tipo <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(tipo)) {
        return { ext: 'jpg', altura: v.getUint16(i + 5), largura: v.getUint16(i + 7) };
      }
      i += 2 + v.getUint16(i + 2);
    }
  }
  throw new Error('Logo inválido: use PNG ou JPEG em public/hospital.');
}

/** Troca a imagem do logo no pacote, ajustando extensão, tipo MIME e proporção. */
export function trocarLogo(zip, bytes) {
  const { ext, largura, altura } = tamanhoImagem(bytes);
  const rels = zip.file('word/_rels/document.xml.rels').asText();
  const alvo = rels.match(/Target="(media\/[^"]+)"/)?.[1];
  if (!alvo) return;
  const novoAlvo = `media/logo-hospital.${ext}`;
  zip.remove(`word/${alvo}`);
  zip.file(`word/${novoAlvo}`, bytes);
  zip.file('word/_rels/document.xml.rels', rels.replace(alvo, novoAlvo));
  let tipos = zip.file('[Content_Types].xml').asText();
  if (!new RegExp(`Extension="${ext}"`, 'i').test(tipos)) {
    tipos = tipos.replace('<Default ', `<Default Extension="${ext}" ContentType="image/${ext === 'jpg' ? 'jpeg' : 'png'}"/><Default `);
    zip.file('[Content_Types].xml', tipos);
  }
  const xml = zip.file('word/document.xml').asText().replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, (d) => {
    const cx = Number(d.match(/<wp:extent cx="(\d+)"/)?.[1]);
    if (!cx) return d;
    const cy = Math.round((cx * altura) / largura);
    return d.replace(/(<wp:extent cx="\d+" cy=")\d+(")/, `$1${cy}$2`).replace(/(<a:ext cx="\d+" cy=")\d+(")/, `$1${cy}$2`);
  });
  zip.file('word/document.xml', xml);
}

const linhasDaTabela = (xml, prefixo) => (xml.match(new RegExp(`\\{\\{${prefixo}_\\d+\\}\\}`, 'g')) || []).length;

/**
 * Preenche o modelo e devolve o arquivo .docx (Uint8Array).
 * `modelo`: ArrayBuffer do .docx de public/modelos. `logo`: bytes de public/hospital (opcional).
 */
export function preencherModelo(modelo, dados, hospital, logo) {
  const zip = new PizZip(modelo);
  if (logo) trocarLogo(zip, logo);
  const xml = zip.file('word/document.xml').asText();

  const valores = {
    ...dados.valores,
    HOSPITAL_NOME: hospital.nome, HOSPITAL_ENDERECO: hospital.endereco, HOSPITAL_TELEFONE: hospital.telefone,
  };

  if (dados.itens) {
    const total = linhasDaTabela(xml, 'RX');
    const tabela = distribuirNaTabela(dados.itens, total, 'PRESCRIÇÃO');
    for (let n = 1; n <= total; n++) valores[`RX_${n}`] = tabela.linhas[n] || '';
    valores.RX_EXTRA = tabela.extra;
    if (tabela.excedeu) dados.avisos.push(`A prescrição passou de ${total} itens; ${tabela.excedeu} foram para "CONTINUAÇÃO" abaixo da tabela.`);
  }
  if (dados.itensRn) {
    const total = linhasDaTabela(xml, 'RXRN');
    const tabela = distribuirNaTabela(dados.itensRn, total, 'PRESCRIÇÃO DO RN');
    for (let n = 1; n <= total; n++) valores[`RXRN_${n}`] = tabela.linhas[n] || '';
    valores.RXRN_EXTRA = tabela.extra;
    if (tabela.excedeu) dados.avisos.push(`A prescrição do RN passou de ${total} itens; ${tabela.excedeu} foram para "CONTINUAÇÃO".`);
  }

  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render(valores);
  return doc.getZip().generate({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Busca o modelo e o logo em public/ e devolve o .docx pronto. */
export async function gerarDocx({ modelo, dados, hospital }) {
  const base = import.meta.env?.BASE_URL ?? '/';
  const resp = await fetch(`${base}modelos/${modelo}.docx`);
  if (!resp.ok) throw new Error(`Modelo public/modelos/${modelo}.docx não encontrado.`);
  let logo = null;
  if (hospital.logo) {
    const r = await fetch(hospital.logo);
    if (r.ok) logo = await r.arrayBuffer();
  }
  return preencherModelo(await resp.arrayBuffer(), dados, hospital, logo);
}
