import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { baixarDocx } from '../lib/baixar.js';
import { montarDados, montarDadosAlta } from '../lib/dados.js';
import { PADRAO_IDADE, PADRAO_PESO, hojeBr, validarDados } from '../lib/regras.js';
import { AreaTexto, Caixas, Selecao, Texto } from './Campos.jsx';

const hojeIso = () => new Date().toLocaleDateString('sv-SE'); // aaaa-mm-dd no fuso local

/** Valida nome, enfermaria e regras clínicas; devolve { campo: mensagem }. */
function conferir(d, enf, config) {
  const lista = [];
  if (!String(d.nome || '').trim()) lista.push({ campo: 'nome', mensagem: 'Informe o nome do paciente.' });
  if (!enf.receitaAlta) {
    lista.push(...validarDados(d, {
      hoje: hojeBr(), modelo: enf, catalogos: config.catalogos,
      anoMinimoAdmissao: config.hospital.anoMinimoAdmissao, diasMaximosAtraso: config.hospital.diasMaximosAtrasoAtendimento,
    }));
  }
  return Object.fromEntries(lista.map((e) => [e.campo, e.mensagem]));
}

function itensDo(config, chave) {
  return (config.catalogos[chave] || []).filter((i) => i.revisado === true || i.tipo === 'registro').map((i) => i.texto);
}

export default function Formulario({ config, inicial, aoGerar }) {
  const { hospital, enfermarias, dietas } = config;
  const [enfId, setEnfId] = useState(inicial?.enfermaria_id || enfermarias[0].id);
  const [d, setD] = useState(inicial?.dados || { dieta: dietas.semDieta });
  const [erros, setErros] = useState({});
  const [estado, setEstado] = useState({ ocupado: false, mensagem: '' });
  const enf = useMemo(() => enfermarias.find((e) => e.id === enfId), [enfId, enfermarias]);
  const set = (campo, valor) => { setD((x) => ({ ...x, [campo]: valor })); if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined })); };
  const p = { d, set, erros };

  async function enviar(evento) {
    evento.preventDefault();
    const achados = conferir(d, enf, config);
    setErros(achados);
    if (Object.keys(achados).length) {
      setEstado({ ocupado: false, mensagem: 'Corrija os campos destacados.' });
      document.querySelector('.com-erro input, .com-erro textarea, .com-erro select')?.focus();
      return;
    }
    setEstado({ ocupado: true, mensagem: 'Salvando…' });
    try {
      // Salvar primeiro: sem registro rastreável não se gera documento (o servidor valida de novo).
      const salvo = await api.salvar(enf.id, d);
      setEstado({ ocupado: true, mensagem: 'Gerando o documento…' });
      const dados = enf.receitaAlta
        ? montarDadosAlta(d, { catalogos: config.catalogos })
        : montarDados(d, { enfermaria: enf, catalogos: config.catalogos });
      const { gerarDocx } = await import('../lib/gerarDocx.js'); // pacote pesado: só carrega ao gerar
      const bytes = await gerarDocx({ modelo: enf.modelo, dados, hospital });
      baixarDocx(bytes, dados.nomeArquivo);
      aoGerar({ id: salvo.id, enfermaria: enf.nome, nome: dados.valores.NOME, avisos: dados.avisos, nomeArquivo: dados.nomeArquivo, bytes });
    } catch (e) {
      if (e.erros) setErros(Object.fromEntries(e.erros.map((x) => [x.campo, x.mensagem])));
      setEstado({ ocupado: false, mensagem: e.message });
    }
  }

  const alta = Boolean(enf.receitaAlta);
  return (
    <form onSubmit={enviar} noValidate>
      <section>
        <h2>Enfermaria</h2>
        <div className="grade">
          <label className="campo largo" htmlFor="enf">Enfermaria
            <select id="enf" value={enfId} onChange={(e) => { setEnfId(e.target.value); setErros({}); }}>
              {enfermarias.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </label>
        </div>
      </section>

      {alta ? (
        <section>
          <h2>Receita de alta</h2>
          <div className="grade">
            <Texto {...p} nome="nome" rotulo="Nome da puérpera" required />
            <Texto {...p} nome="data_atendimento" type="date" max={hojeIso()} rotulo="Data" ajuda="Em branco = hoje." />
            <Caixas {...p} nome="incluir" rotulo="Itens para incluir" itens={itensDo(config, 'alta')} />
            <AreaTexto {...p} nome="prescricao" linhas={5} rotulo="Prescrição de alta deste atendimento" ajuda="Um item completo por linha. Em branco = sem prescrição registrada." />
          </div>
        </section>
      ) : (
        <>
          <section>
            <h2>Identificação</h2>
            <div className="grade">
              <Texto {...p} nome="nome" rotulo="Nome completo do paciente" required autoComplete="off" />
              <Texto {...p} nome="data_atendimento" type="date" max={hojeIso()} rotulo="Data do atendimento" ajuda="Em branco = hoje." />
              <Texto {...p} nome="hora_atendimento" type="time" rotulo="Hora do atendimento" ajuda="Em branco = agora." />
              <Texto {...p} nome="prontuario" rotulo="Prontuário" autoComplete="off" />
              <Texto {...p} nome="registro" rotulo="Registro" autoComplete="off" />
              <Texto {...p} nome="data_nascimento" type="date" max={hojeIso()} rotulo="Data de nascimento" />
              <Texto {...p} nome="idade" rotulo="Idade" pattern={PADRAO_IDADE} ajuda="Ex.: 66, 1 ano e 3 meses, 15 dias." autoComplete="off" />
              <Texto {...p} nome="peso" rotulo="Peso (kg)" inputMode="decimal" pattern={PADRAO_PESO} ajuda="Só o número. Ex.: 70,5." autoComplete="off" />
              <Texto {...p} nome="leito" rotulo="Leito" autoComplete="off" />
              <Texto {...p} nome="data_admissao" type="date" max={hojeIso()} rotulo="Data de admissão" ajuda="Em branco = data do atendimento." />
              <Texto {...p} nome="hipotese" rotulo="Hipótese diagnóstica" autoComplete="off" />
            </div>
          </section>

          <section>
            <h2>Prescrição</h2>
            <p className="aviso-clinico">Nada é herdado do modelo: entra só o que for escolhido ou digitado aqui. Revise indicação, dose, via e frequência.</p>
            <div className="grade">
              <Selecao {...p} nome="dieta" rotulo="Dieta" opcoes={[dietas.semDieta, ...dietas.opcoes]} />
              <Caixas {...p} nome="incluir" rotulo="Itens para incluir" itens={itensDo(config, enf.catalogo)} />
              <AreaTexto {...p} nome="adicionais" linhas={5} rotulo="Medicações / itens adicionais"
                ajuda={enf.pediatrica ? 'Um item completo por linha. Pediatria exige idade/nascimento, peso e indicação.' : 'Um item completo por linha. Ex.: CEFTRIAXONA 1G EV 12/12H'} />
            </div>
          </section>

          {enf.puerpera && (
            <section>
              <h2>Recém-nascido</h2>
              <div className="grade">
                <Texto {...p} nome="prontuario_rn" rotulo="Prontuário do RN" autoComplete="off" />
                <Texto {...p} nome="registro_rn" rotulo="Registro do RN" autoComplete="off" />
                <Texto {...p} nome="idade_rn" rotulo="Idade do RN" pattern={PADRAO_IDADE} ajuda="Ex.: 2 dias, 1 mês e 5 dias." autoComplete="off" />
                <Texto {...p} nome="peso_rn" rotulo="Peso do RN (kg)" inputMode="decimal" pattern={PADRAO_PESO} autoComplete="off" />
                <Texto {...p} nome="indicacao_rn" rotulo="Indicação da prescrição do RN" />
                <Caixas {...p} nome="incluir_rn" rotulo="Itens do RN para incluir" itens={itensDo(config, 'rn')} />
                <AreaTexto {...p} nome="adicionais_rn" rotulo="Itens adicionais da prescrição do RN" ajuda="Um item por linha. Exige idade, peso e indicação do RN." />
                <AreaTexto {...p} nome="exame_rn" rotulo="Exame do RN" ajuda="Em branco = sem avaliação registrada." />
              </div>
            </section>
          )}

          <section>
            <h2>Evolução / exame físico</h2>
            <p className="aviso-clinico">Campos em branco ficam sem registro e geram aviso. Nenhum achado ou conduta é presumido.</p>
            <div className="grade">
              <AreaTexto {...p} nome="relato" rotulo="Relato de internação" />
              <AreaTexto {...p} nome="hpp" rotulo="HPP" />
              <AreaTexto {...p} nome="evolucao" rotulo="Evolução clínica" />
              <AreaTexto {...p} nome="exame_fisico" rotulo="Exame físico" linhas={5} />
              <AreaTexto {...p} nome="conduta" rotulo="Conduta" />
              <AreaTexto {...p} nome="solicitacao" rotulo="Solicitação de exames" ajuda="Um exame por linha." />
            </div>
          </section>
        </>
      )}

      <div className="rodape-form">
        <button type="submit" className="primario" disabled={estado.ocupado}>{estado.ocupado ? estado.mensagem : 'Gerar documento'}</button>
        {!estado.ocupado && estado.mensagem && <p className="erro" role="alert">{estado.mensagem}</p>}
      </div>
    </form>
  );
}
