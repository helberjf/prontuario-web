/** Só o fechamento normal do gravador conta como gravação concluída. */
export function aguardarGravador(processo) {
  return new Promise((resolve, reject) => {
    processo.once('error', reject);
    processo.once('exit', (codigo, sinal) => {
      if (codigo === 0 && !sinal) resolve();
      else reject(new Error(`Codegen terminou com código ${codigo ?? 'nulo'}${sinal ? `, sinal ${sinal}` : ''}.`));
    });
  });
}
