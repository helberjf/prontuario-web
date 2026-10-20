/** Entrega o .docx ao usuário sem depender de biblioteca. */
export function baixarDocx(bytes, nomeArquivo) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${nomeArquivo.replace(/[/\\:*?"<>|]/g, '-')}.docx` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
