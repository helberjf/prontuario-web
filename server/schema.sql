-- Esquema do Neon (PostgreSQL). Rode com: npm run db:init
-- Nada aqui apaga dados: só CREATE ... IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  senha_hash  TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um registro por prontuário gerado. `dados` guarda o que foi digitado (para reabrir e gerar de novo);
-- o arquivo .docx em si é gerado no navegador e não fica no banco.
CREATE TABLE IF NOT EXISTS prontuarios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id),
  enfermaria_id    TEXT NOT NULL,
  paciente_nome    TEXT NOT NULL,
  data_atendimento DATE NOT NULL,
  nome_arquivo     TEXT NOT NULL,
  avisos           JSONB NOT NULL DEFAULT '[]'::jsonb,
  dados            JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS prontuarios_criado_em_idx ON prontuarios (criado_em DESC);
CREATE INDEX IF NOT EXISTS prontuarios_paciente_idx ON prontuarios (lower(paciente_nome));

-- Trilha de auditoria: login, geração e consulta. Só recebe INSERT.
CREATE TABLE IF NOT EXISTS eventos (
  id            BIGSERIAL PRIMARY KEY,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id    INTEGER REFERENCES usuarios(id),
  acao          TEXT NOT NULL,
  prontuario_id UUID,
  detalhe       TEXT
);
