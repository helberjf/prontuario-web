import { useId } from 'react';

/** Rótulo + controle + ajuda + erro, ligados por id para leitores de tela. */
export function Campo({ rotulo, ajuda, erro, obrigatorio, children, largo }) {
  const id = useId();
  return (
    <div className={`campo${largo ? ' largo' : ''}${erro ? ' com-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}{obrigatorio && <span aria-hidden="true"> *</span>}</label>
      {children({ id, 'aria-invalid': erro ? true : undefined, 'aria-describedby': `${id}-info` })}
      <p id={`${id}-info`} className="info">
        {erro ? <span className="erro" role="alert">{erro}</span> : ajuda}
      </p>
    </div>
  );
}

export function Texto({ d, set, erros, nome, rotulo, ajuda, ...resto }) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erros[nome]} obrigatorio={resto.required}>
      {(p) => <input {...p} {...resto} value={d[nome] ?? ''} onChange={(e) => set(nome, e.target.value)} />}
    </Campo>
  );
}

export function AreaTexto({ d, set, erros, nome, rotulo, ajuda, linhas = 3 }) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erros[nome]} largo>
      {(p) => <textarea {...p} rows={linhas} value={d[nome] ?? ''} onChange={(e) => set(nome, e.target.value)} />}
    </Campo>
  );
}

export function Selecao({ d, set, erros, nome, rotulo, ajuda, opcoes }) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erros[nome]}>
      {(p) => (
        <select {...p} value={d[nome] ?? ''} onChange={(e) => set(nome, e.target.value)}>
          {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </Campo>
  );
}

/** Lista de itens liberados: nada vem marcado, só o que o médico escolher entra na prescrição. */
export function Caixas({ d, set, erros, nome, rotulo, itens }) {
  const marcados = d[nome] ?? [];
  const alternar = (item) => set(nome, marcados.includes(item) ? marcados.filter((i) => i !== item) : [...marcados, item]);
  return (
    <fieldset className="caixas largo">
      <legend>{rotulo}</legend>
      {itens.length === 0 && <p className="info">Nenhuma opção liberada. Use o campo de itens adicionais.</p>}
      {itens.map((item) => (
        <label key={item} className="caixa">
          <input type="checkbox" checked={marcados.includes(item)} onChange={() => alternar(item)} /> {item}
        </label>
      ))}
      {erros[nome] && <p className="erro" role="alert">{erros[nome]}</p>}
    </fieldset>
  );
}
