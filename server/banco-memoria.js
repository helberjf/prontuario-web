import bcrypt from 'bcryptjs';

/**
 * Banco em memória com a mesma interface de db.query usada pela API.
 * Serve para os testes e para o modo `npm run demo`. Os dados somem ao reiniciar.
 */
export function criarBancoMemoria(usuarios = []) {
  const estado = { eventos: [], prontuarios: [], usuarios: [...usuarios] };
  let seq = 0;
  return {
    estado,
    async query(sql, p = []) {
      if (/FROM usuarios/.test(sql)) return { rows: estado.usuarios.filter((u) => u.email === String(p[0]).toLowerCase()) };
      if (/INSERT INTO eventos/.test(sql)) { estado.eventos.push({ usuario: p[0], acao: p[1], prontuario: p[2], detalhe: p[3] }); return { rows: [] }; }
      if (/INSERT INTO prontuarios/.test(sql)) {
        const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
        const linha = {
          id, criado_em: new Date().toISOString(), usuario: estado.usuarios.find((u) => u.id === p[0])?.nome ?? '',
          enfermaria_id: p[1], paciente_nome: p[2], data_atendimento: p[3], nome_arquivo: p[4],
          avisos: JSON.parse(p[5]), dados: JSON.parse(p[6]),
        };
        estado.prontuarios.unshift(linha);
        return { rows: [{ id, criado_em: linha.criado_em }] };
      }
      if (/FROM prontuarios p JOIN usuarios/.test(sql)) {
        const busca = String(p[0] || '').toLowerCase();
        return { rows: estado.prontuarios.filter((r) => !busca || r.paciente_nome.toLowerCase().includes(busca)) };
      }
      if (/FROM prontuarios WHERE id/.test(sql)) return { rows: estado.prontuarios.filter((r) => r.id === p[0]) };
      throw new Error(`consulta não prevista no banco em memória: ${sql}`);
    },
  };
}

export function usuarioDemo(email, nome, senha) {
  return { id: 1, email, nome, senha_hash: bcrypt.hashSync(senha, 4), ativo: true };
}
