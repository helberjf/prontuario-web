import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { baixarDocx } from '../lib/baixar.js';
import { montarDados, montarDadosAlta } from '../lib/dados.js';
import { PADRAO_IDADE, PADRAO_PESO } from '../lib/regras.js';
import { atualizarResposta, conferirFormulario, criarRespostas, dadosDaSecao, secoesFormulario } from '../lib/formulario.js';
import { AreaTexto, Caixas, EscolhaUnica, Texto } from './Campos.jsx';

const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const AJUDA_SELECAO = 'Selecione somente o que deve entrar neste atendimento. Nada selecionado = nenhum item desta lista. Revise os itens para este paciente.';
const AJUDA_PRESCRICAO = 'Um item completo por linha, individualizado pelo médico. Pediatria/RN: exige idade, peso e indicação.';
const AVISO = 'Campos vazios ficam sem registro. Prescrições e decisões dependem da avaliação médica deste atendimento.';

function itensDo(config, chave) {
  return (config.catalogos[chave] || []).filter(i => i.revisado === true || i.tipo === 'registro').map(i => i.texto);
}

export default function Formulario({ config, inicial, aoGerar }) {
  const { hospital, enfermarias, dietas } = config;
  const [enfId, setEnfId] = useState(inicial?.enfermaria_id || '');
  const enf = enfermarias.find(e => e.id === enfId);
  const [respostas, setRespostas] = useState(() => criarRespostas(inicial, enf));
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState({});
  const [estado, setEstado] = useState({ ocupado: false, mensagem: '' });
  const titulo = useRef(null);
  const secoes = secoesFormulario(enf);
  const secao = secoes[etapa];
  const ultima = Boolean(enf) && etapa === secoes.length - 1;
  const d = dadosDaSecao(respostas, enf);
  const set = (campo, valor) => {
    setRespostas(r => atualizarResposta(r, enf, campo, valor));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: undefined }));
  };
  const p = { d, set, erros };

  useEffect(() => { titulo.current?.focus(); }, [etapa]);

  function mostrarErros(achados) {
    setErros(achados);
    const primeira = secoes.findIndex(s => s.campos.some(c => achados[c]));
    if (primeira >= 0) setEtapa(primeira);
    setEstado({ ocupado: false, mensagem: 'Corrija os campos destacados.' });
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (estado.ocupado) return;
    const todos = conferirFormulario(d, enf, config);
    const achados = ultima ? todos : Object.fromEntries(Object.entries(todos).filter(([campo]) => secao.campos.includes(campo)));
    if (Object.keys(achados).length) { mostrarErros(achados); return; }
    // Confere apenas controles da etapa visível, incluindo o texto obrigatório de Outro.
    const invalido = evento.currentTarget.querySelector('input:invalid, select:invalid, textarea:invalid');
    if (invalido) { invalido.reportValidity(); return; }
    if (!ultima) {
      setErros({});
      setEstado({ ocupado: false, mensagem: '' });
      setEtapa(e => e + 1);
      return;
    }
    setEstado({ ocupado: true, mensagem: 'Salvando…' });
    try {
      const salvo = await api.salvar(enf.id, d);
      setEstado({ ocupado: true, mensagem: 'Gerando o documento…' });
      const dados = enf.receitaAlta
        ? montarDadosAlta(d, { catalogos: config.catalogos })
        : montarDados(d, { enfermaria: enf, catalogos: config.catalogos });
      const { gerarDocx } = await import('../lib/gerarDocx.js');
      const bytes = await gerarDocx({ modelo: enf.modelo, dados, hospital });
      baixarDocx(bytes, dados.nomeArquivo);
      aoGerar({ id: salvo.id, enfermaria: enf.nome, nome: dados.valores.NOME, avisos: dados.avisos, nomeArquivo: dados.nomeArquivo, bytes });
    } catch (e) {
      if (e.erros) mostrarErros(Object.fromEntries(e.erros.map(x => [x.campo, x.mensagem])));
      else setEstado({ ocupado: false, mensagem: e.message });
    }
  }

  return (
    <form className="formulario-etapas" onSubmit={enviar} noValidate>
      <p className="info etapa-contagem" aria-live="polite">Etapa {etapa + 1}{enf ? ` de ${secoes.length}` : ''}</p>
      <section aria-labelledby="titulo-etapa">
        <h2 id="titulo-etapa" ref={titulo} tabIndex={-1}>{secao.titulo}</h2>

        {secao.id === 'enfermaria' && <>
          <p className="info introducao-form">Campos clínicos vazios ficam sem registro e geram aviso. A prescrição contém somente os itens informados neste atendimento. Revisão e assinatura médica obrigatórias.</p>
          <div className={`campo${erros.enfermaria ? ' com-erro' : ''}`}>
            <label htmlFor="enf">Enfermaria <span aria-hidden="true">*</span></label>
            <select id="enf" required value={enfId} aria-invalid={erros.enfermaria ? true : undefined} aria-describedby="enf-info"
              onChange={e => { setEnfId(e.target.value); setErros({}); setEstado({ ocupado: false, mensagem: '' }); }}>
              <option value="">Escolher</option>
              {enfermarias.map(e => <option key={e.id} value={e.id}>{e.id === 'puerpera' ? 'Puérpera' : e.nome}</option>)}
            </select>
            <p id="enf-info" className="erro" role={erros.enfermaria ? 'alert' : undefined}>{erros.enfermaria}</p>
          </div>
        </>}

        {secao.id === 'prescricao' && <>
          <p className="aviso-clinico">{AVISO}</p>
          <div className="grade">
            <EscolhaUnica {...p} nome="dieta" rotulo="Dieta" opcoes={[dietas.semDieta, ...dietas.opcoes]} />
            <Caixas {...p} nome="incluir" rotulo="Itens para incluir na prescrição" ajuda={AJUDA_SELECAO} itens={itensDo(config, enf.catalogo)} />
            <AreaTexto {...p} nome="adicionais" linhas={5} rotulo="Itens adicionais da prescrição" ajuda={AJUDA_PRESCRICAO} />
            {enf.puerpera && <>
              <Texto {...p} nome="prontuario_rn" rotulo="Prontuário do RN" autoComplete="off" />
              <Texto {...p} nome="registro_rn" rotulo="Registro do RN" autoComplete="off" />
              <Texto {...p} nome="idade_rn" rotulo="Idade do RN" pattern={PADRAO_IDADE} ajuda="Ex.: 66, 66 anos, 1 ano e 3 meses, 15 dias." autoComplete="off" />
              <Texto {...p} nome="peso_rn" rotulo="Peso do RN (kg)" inputMode="decimal" pattern={PADRAO_PESO} autoComplete="off" />
              <Texto {...p} nome="indicacao_rn" rotulo="Indicação da prescrição do RN" />
              <Caixas {...p} nome="incluir_rn" rotulo="Itens para incluir na prescrição do RN" ajuda={AJUDA_SELECAO} itens={itensDo(config, 'rn')} />
              <AreaTexto {...p} nome="adicionais_rn" rotulo="Itens adicionais da prescrição do RN" ajuda={AJUDA_PRESCRICAO} />
              <AreaTexto {...p} nome="exame_rn" rotulo="Exame do RN" ajuda="Em branco = sem registro; preencher após avaliação." />
            </>}
          </div>
        </>}

        {secao.id === 'identificacao' && <>
          <p className="aviso-clinico">{AVISO}</p>
          <div className="grade">
            <Texto {...p} nome="nome" rotulo="Nome completo do paciente" required autoComplete="off" />
            <Texto {...p} nome="data_atendimento" type="date" max={hojeIso()} rotulo="Data do atendimento" ajuda="Em branco = data do envio. Preencha quando registrar depois do atendimento." />
            <Texto {...p} nome="hora_atendimento" type="time" rotulo="Hora do atendimento" ajuda="Em branco = hora do envio." />
            <Texto {...p} nome="prontuario" rotulo="Prontuário" autoComplete="off" />
            <Texto {...p} nome="registro" rotulo="Registro" autoComplete="off" />
            <Texto {...p} nome="data_nascimento" type="date" max={hojeIso()} rotulo="Data de nascimento" ajuda="Confira dia, mês e ano completo." />
            <Texto {...p} nome="idade" rotulo="Idade" pattern={PADRAO_IDADE} ajuda="Ex.: 66, 66 anos, 1 ano e 3 meses, 15 dias." autoComplete="off" />
            <Texto {...p} nome="peso" rotulo="Peso (kg)" inputMode="decimal" pattern={PADRAO_PESO} autoComplete="off" />
            <Texto {...p} nome="leito" rotulo="Leito" autoComplete="off" />
            <Texto {...p} nome="data_admissao" type="date" max={hojeIso()} rotulo="Data de admissão" ajuda="Confira dia, mês e ano completo. Em branco = data do atendimento." />
            <Texto {...p} nome="hipotese" rotulo="Hipótese diagnóstica" autoComplete="off" />
          </div>
        </>}

        {secao.id === 'evolucao' && <>
          <p className="aviso-clinico">{AVISO}</p>
          <div className="grade">
            <AreaTexto {...p} nome="relato" rotulo="Relato de internação" />
            <AreaTexto {...p} nome="hpp" rotulo="HPP" />
            <AreaTexto {...p} nome="evolucao" rotulo="Evolução clínica" />
            <AreaTexto {...p} nome="exame_fisico" rotulo="Exame físico" linhas={5} ajuda="Em branco = sem registro; preencher após avaliação." />
            <AreaTexto {...p} nome="conduta" rotulo="Conduta" ajuda="Em branco = sem registro; preencher após avaliação." />
            <AreaTexto {...p} nome="solicitacao" rotulo="Solicitação de exames" ajuda="Em branco = sem registro; preencher após avaliação." />
          </div>
        </>}

        {secao.id === 'alta' && <>
          <p className="aviso-clinico">{AVISO}</p>
          <div className="grade">
            <Texto {...p} nome="nome" rotulo="Nome da puérpera" required autoComplete="off" />
            <Caixas {...p} nome="incluir" rotulo="Itens para incluir na prescrição" ajuda={AJUDA_SELECAO} itens={itensDo(config, 'alta')} />
            <AreaTexto {...p} nome="prescricao" linhas={5} rotulo="Prescrição de alta deste atendimento" ajuda="Um item completo por linha, individualizado pelo médico." />
          </div>
        </>}
      </section>

      <div className="rodape-form">
        {etapa > 0 && <button type="button" disabled={estado.ocupado} onClick={() => { setEtapa(e => e - 1); setEstado({ ocupado: false, mensagem: '' }); }}>Voltar</button>}
        <button type="submit" className="primario" disabled={estado.ocupado}>{estado.ocupado ? estado.mensagem : ultima ? 'Gerar documento' : 'Avançar'}</button>
        {!estado.ocupado && estado.mensagem && <p className="erro" role="alert">{estado.mensagem}</p>}
      </div>
    </form>
  );
}
