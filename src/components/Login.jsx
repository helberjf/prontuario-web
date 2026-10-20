import { useState } from 'react';
import { api } from '../lib/api.js';

export default function Login({ hospital, aoEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setOcupado(true); setErro('');
    try { aoEntrar(await api.login(email, senha)); }
    catch (x) { setErro(x.message); setOcupado(false); }
  }

  return (
    <main className="login">
      <img src={hospital.logo} alt={`Logo ${hospital.nome}`} width="120" />
      <h1>{hospital.tituloSistema}</h1>
      <p className="info">{hospital.nome}</p>
      <form onSubmit={entrar}>
        <div className="campo"><label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="campo"><label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="primario" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
