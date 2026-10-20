/** Chamadas à API (mesma origem). Erros viram exceções com mensagem em português. */
async function chamar(url, opcoes = {}) {
  let resp;
  try {
    resp = await fetch(url, {
      credentials: 'same-origin',
      ...opcoes,
      headers: { ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), ...opcoes.headers },
    });
  } catch {
    throw Object.assign(new Error('Sem conexão com o servidor.'), { status: 0 });
  }
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw Object.assign(new Error(corpo.erro || corpo.erros?.[0]?.mensagem || 'Erro inesperado.'), { status: resp.status, erros: corpo.erros });
  }
  return corpo;
}

export const api = {
  eu: () => chamar('/api/eu'),
  login: (email, senha) => chamar('/api/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
  logout: () => chamar('/api/logout', { method: 'POST', body: '{}' }),
  salvar: (enfermaria_id, dados) => chamar('/api/prontuarios', { method: 'POST', body: JSON.stringify({ enfermaria_id, dados }) }),
  listar: (busca = '') => chamar(`/api/prontuarios?busca=${encodeURIComponent(busca)}`),
  abrir: (id) => chamar(`/api/prontuarios/${id}`),
};
