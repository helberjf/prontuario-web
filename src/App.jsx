import { useEffect, useState } from 'react';
import Formulario from './components/Formulario.jsx';
import Historico from './components/Historico.jsx';
import Login from './components/Login.jsx';
import { api } from './lib/api.js';
import { baixarDocx } from './lib/baixar.js';
import { carregarConfig } from './lib/config.js';

export default function App() {
  const [config, setConfig] = useState(null);
  const [erroConfig, setErroConfig] = useState('');
  const [usuario, setUsuario] = useState(undefined); // undefined = verificando; null = sem login
  const [tela, setTela] = useState('novo');
  const [resultado, setResultado] = useState(null);
  const [inicial, setInicial] = useState(null);
  const [versao, setVersao] = useState(0); // força um formulário novo (limpo)

  useEffect(() => {
    carregarConfig().then(setConfig).catch((e) => setErroConfig(e.message));
    api.eu().then(setUsuario).catch(() => setUsuario(null));
  }, []);

  if (erroConfig) return <main className="login"><p className="erro" role="alert">{erroConfig}</p></main>;
  if (!config || usuario === undefined) return <main className="login"><p className="info">Carregando…</p></main>;
  if (!usuario) return <Login hospital={config.hospital} aoEntrar={setUsuario} />;

  const novo = (dados = null) => { setInicial(dados); setResultado(null); setTela('novo'); setVersao((v) => v + 1); };
  const sair = async () => { await api.logout().catch(() => {}); setUsuario(null); novo(); };

  return (
    <>
      <header className="topo">
        <img src={config.hospital.logo} alt="" width="44" />
        <div><strong>{config.hospital.tituloSistema}</strong><span>{config.hospital.nome}</span></div>
        <nav aria-label="Principal">
          <button type="button" aria-current={tela === 'novo' ? 'page' : undefined} onClick={() => novo()}>Novo</button>
          <button type="button" aria-current={tela === 'historico' ? 'page' : undefined} onClick={() => { setResultado(null); setTela('historico'); }}>Histórico</button>
          <button type="button" onClick={sair}>Sair ({usuario.nome})</button>
        </nav>
      </header>

      <main>
        {tela === 'historico' && (
          <Historico enfermarias={config.enfermarias}
            aoReabrir={(r) => novo({ enfermaria_id: r.enfermaria_id, dados: r.dados })} />
        )}
        {tela === 'novo' && resultado && (
          <section className="resultado" aria-live="polite">
            <h2>Documento gerado</h2>
            <p><strong>{resultado.nome}</strong> · {resultado.enfermaria}</p>
            <p className="info">O arquivo foi baixado: <code>{resultado.nomeArquivo}.docx</code></p>
            {resultado.avisos.length > 0 && (
              <div className="avisos">
                <strong>Atenção — revise antes de usar:</strong>
                <ul>{resultado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            )}
            <div className="acoes">
              <button type="button" onClick={() => baixarDocx(resultado.bytes, resultado.nomeArquivo)}>Baixar de novo</button>
              <button type="button" className="primario" onClick={() => novo()}>Novo prontuário</button>
            </div>
          </section>
        )}
        {tela === 'novo' && !resultado && (
          <Formulario key={versao} config={config} inicial={inicial} aoGerar={setResultado} />
        )}
      </main>
    </>
  );
}
