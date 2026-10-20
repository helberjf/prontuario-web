/**
 * API do sistema. É uma fábrica (criarApp) para os testes poderem injetar um banco falso.
 * O navegador NUNCA fala com o Neon: só com estas rotas, que exigem login.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { hojeBr, validarDados } from '../src/lib/regras.js';
import { montarDados, montarDadosAlta } from '../src/lib/dados.js';

const RAIZ = path.join(import.meta.dirname, '..');
const COOKIE = 'sessao';
const DURACAO_SESSAO_S = 8 * 60 * 60;

const lerJson = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', f), 'utf8'));

export function lerConfig() {
  return {
    hospital: lerJson('hospital/hospital.json'),
    enfermarias: lerJson('config/enfermarias.json'),
    catalogos: lerJson('config/prescricoes.json'),
  };
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

/** Limita tentativas de login por IP: 10 a cada 15 min. */
function limitadorLogin() {
  const tentativas = new Map();
  return (req, res, next) => {
    const agora = Date.now();
    const chave = req.ip;
    const lista = (tentativas.get(chave) || []).filter((t) => agora - t < 15 * 60 * 1000);
    if (lista.length >= 10) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    lista.push(agora);
    tentativas.set(chave, lista);
    next();
  };
}

export function criarApp({ db, segredo, config = lerConfig(), producao = false, pastaWeb = null }) {
  if (!segredo || segredo.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store' });
    // Mutação só com JSON e do próprio site: barra formulário de outro site (CSRF), além do SameSite=Strict.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (!req.is('application/json')) return res.status(415).json({ erro: 'Use application/json.' });
      const origem = req.get('origin');
      const host = req.get('x-forwarded-host') || req.get('host'); // atrás de proxy/hospedagem o Host pode ser reescrito
      if (origem && new URL(origem).host !== host) return res.status(403).json({ erro: 'Origem não permitida.' });
    }
    next();
  });

  const auditar = (usuarioId, acao, prontuarioId = null, detalhe = null) =>
    db.query('INSERT INTO eventos (usuario_id, acao, prontuario_id, detalhe) VALUES ($1,$2,$3,$4)', [usuarioId, acao, prontuarioId, detalhe]);

  function exigirLogin(req, res, next) {
    try {
      req.usuario = jwt.verify(cookies(req)[COOKIE] || '', segredo);
      next();
    } catch {
      res.status(401).json({ erro: 'Faça login.' });
    }
  }

  // --- sessão -------------------------------------------------------------
  app.post('/api/login', limitadorLogin(), async (req, res) => {
    const { email, senha } = req.body || {};
    const { rows } = await db.query('SELECT id, email, nome, senha_hash, ativo FROM usuarios WHERE lower(email) = lower($1)', [String(email || '')]);
    const u = rows[0];
    // Mesma resposta e mesmo custo para e-mail inexistente e senha errada.
    const ok = await bcrypt.compare(String(senha || ''), u?.senha_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
    if (!u || !u.ativo || !ok) {
      await auditar(u?.id ?? null, 'LOGIN_FALHOU', null, String(email || '').slice(0, 120));
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    const token = jwt.sign({ id: u.id, email: u.email, nome: u.nome }, segredo, { expiresIn: DURACAO_SESSAO_S });
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: producao, maxAge: DURACAO_SESSAO_S * 1000, path: '/' });
    await auditar(u.id, 'LOGIN');
    res.json({ id: u.id, email: u.email, nome: u.nome });
  });

  app.post('/api/logout', (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });
  app.get('/api/eu', exigirLogin, (req, res) => res.json({ id: req.usuario.id, email: req.usuario.email, nome: req.usuario.nome }));

  // --- prontuários -------------------------------------------------------
  /** Valida de novo no servidor, com as mesmas regras do navegador, e devolve o que vai para o banco. */
  function conferir({ enfermaria_id: enfId, dados }) {
    const enf = config.enfermarias.find((e) => e.id === enfId);
    if (!enf) return { erros: [{ campo: 'enfermaria', mensagem: 'Enfermaria desconhecida.' }] };
    if (!dados || typeof dados !== 'object' || !String(dados.nome || '').trim()) {
      return { erros: [{ campo: 'nome', mensagem: 'Informe o nome do paciente.' }] };
    }
    const agora = new Date();
    const hoje = hojeBr(agora);
    if (enf.receitaAlta) {
      let resumo;
      try { resumo = montarDadosAlta(dados, { catalogos: config.catalogos, agora }); }
      catch (e) { return { erros: [{ campo: 'incluir', mensagem: e.message }] }; }
      return { enf, resumo };
    }
    const erros = validarDados(dados, {
      hoje, modelo: enf, catalogos: config.catalogos,
      anoMinimoAdmissao: config.hospital.anoMinimoAdmissao, diasMaximosAtraso: config.hospital.diasMaximosAtrasoAtendimento,
    });
    if (erros.length) return { erros };
    try { return { enf, resumo: montarDados(dados, { enfermaria: enf, catalogos: config.catalogos, agora }) }; }
    catch (e) { return { erros: [{ campo: 'incluir', mensagem: e.message }] }; }
  }

  app.post('/api/prontuarios', exigirLogin, async (req, res) => {
    const { erros, enf, resumo } = conferir(req.body || {});
    if (erros) return res.status(422).json({ erros });
    const [d, m, a] = resumo.atendimento.split('/');
    const { rows } = await db.query(
      `INSERT INTO prontuarios (usuario_id, enfermaria_id, paciente_nome, data_atendimento, nome_arquivo, avisos, dados)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, criado_em`,
      [req.usuario.id, enf.id, resumo.valores.NOME, `${a}-${m}-${d}`, resumo.nomeArquivo, JSON.stringify(resumo.avisos), JSON.stringify(req.body.dados)],
    );
    await auditar(req.usuario.id, 'GERADO', rows[0].id, enf.nome);
    res.status(201).json({ id: rows[0].id, criado_em: rows[0].criado_em, avisos: resumo.avisos });
  });

  app.get('/api/prontuarios', exigirLogin, async (req, res) => {
    const busca = String(req.query.busca || '').trim().slice(0, 80);
    const { rows } = await db.query(
      `SELECT p.id, p.criado_em, p.enfermaria_id, p.paciente_nome, p.data_atendimento, p.nome_arquivo, p.avisos, u.nome AS usuario
         FROM prontuarios p JOIN usuarios u ON u.id = p.usuario_id
        WHERE ($1 = '' OR lower(p.paciente_nome) LIKE '%' || lower($1) || '%')
        ORDER BY p.criado_em DESC LIMIT 100`,
      [busca],
    );
    res.json(rows);
  });

  app.get('/api/prontuarios/:id', exigirLogin, async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });
    const { rows } = await db.query('SELECT id, criado_em, enfermaria_id, paciente_nome, nome_arquivo, avisos, dados FROM prontuarios WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: 'Prontuário não encontrado.' });
    await auditar(req.usuario.id, 'CONSULTADO', rows[0].id);
    res.json(rows[0]);
  });

  // Erros inesperados não vazam detalhes (podem conter dados de paciente).
  app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((erro, _req, res, _next) => {
    console.error('Erro na API:', erro?.message || erro);
    res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  });

  if (pastaWeb && fs.existsSync(pastaWeb)) {
    app.use(express.static(pastaWeb, { index: false, setHeaders: (r) => r.set('Cache-Control', 'public, max-age=300') }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(pastaWeb, 'index.html')));
  }
  return app;
}
