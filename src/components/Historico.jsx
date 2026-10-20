import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const dataBr = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');

export default function Historico({ enfermarias, aoReabrir }) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.listar(busca).then(setLista).catch((e) => setErro(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  async function reabrir(id) {
    try { aoReabrir(await api.abrir(id)); } catch (e) { setErro(e.message); }
  }
  const nomeEnf = (id) => enfermarias.find((e) => e.id === id)?.nome || id;

  return (
    <section>
      <h2>Prontuários gerados</h2>
      <div className="campo"><label htmlFor="busca">Buscar por nome do paciente</label>
        <input id="busca" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" /></div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {lista === null ? <p className="info">Carregando…</p> : lista.length === 0 ? <p className="info">Nenhum prontuário encontrado.</p> : (
        <div className="tabela-rolavel">
          <table>
            <thead><tr><th>Paciente</th><th>Enfermaria</th><th>Atendimento</th><th>Por</th><th>Avisos</th><th /></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td>{r.paciente_nome}</td><td>{nomeEnf(r.enfermaria_id)}</td><td>{dataBr(r.data_atendimento)}</td>
                  <td>{r.usuario}</td><td>{r.avisos.length || '—'}</td>
                  <td><button type="button" onClick={() => reabrir(r.id)}>Reabrir como novo</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="info">“Reabrir como novo” carrega os dados no formulário; gerar de novo cria um novo registro, sem alterar o anterior.</p>
    </section>
  );
}
