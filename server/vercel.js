import { iniciarApp } from './inicializacao.js';

/** Reutiliza pool/app por instância e compartilha inicializações concorrentes. */
export function criarHandler({ iniciar = iniciarApp } = {}) {
  let inicializacao;
  return async (req, res) => {
    try {
      inicializacao ||= iniciar().catch((erro) => { inicializacao = null; throw erro; });
      const app = await inicializacao;
      return app(req, res);
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ erro: 'Serviço indisponível. Verifique a configuração do servidor.' }));
    }
  };
}
