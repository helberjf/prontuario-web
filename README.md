# Prontuário Web

Sistema web (React + Vite) que gera o prontuário do hospital — prescrição, evolução e solicitação de exames — no **mesmo layout dos modelos do hospital**, com histórico salvo no **Neon** (PostgreSQL).

É a versão web do formulário do Google Forms + Apps Script: mesmas enfermarias, mesmas regras e a mesma proteção contra campos clínicos "inventados".

```
navegador (React)  ──/api──▶  servidor Node (Express)  ──▶  Neon
     │                              │
     └─ gera o .docx aqui           └─ login, valida de novo e grava o histórico
        (modelos de public/)           (o navegador nunca acessa o banco)
```

## Rodar agora (sem Neon): modo demo

```bash
npm install
npm run demo
```

Abra http://localhost:5173 e entre com `demo@example.com` / `demo-demo-demo`.
O banco é **em memória**: tudo some ao reiniciar. Serve só para conhecer o sistema.

## Configurar o Neon (uso real)

1. No painel do Neon, copie a **string de conexão** (pooled).
2. `cp .env.example .env` e preencha:
   - `DATABASE_URL`: a string do Neon;
   - `JWT_SECRET`: 32+ caracteres aleatórios (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).
3. Crie as tabelas (só `CREATE … IF NOT EXISTS`, nada é apagado):
   ```bash
   npm run db:init
   ```
4. Crie os usuários (senha com 12+ caracteres; rodar de novo troca a senha):
   ```bash
   npm run criar-usuario -- medico@exemplo.com "Dr. Nome" "senha-longa-e-unica"
   ```
5. `npm run dev` (site em :5173, API em :3001).

## Produção

```bash
npm run build
NODE_ENV=production npm run api   # serve a API e o site (pasta dist) na mesma porta
```

Em produção o cookie de sessão passa a exigir HTTPS (`Secure`). Hospede atrás de HTTPS (Render, Railway, Fly, VPS com Caddy/Nginx…). Como o servidor é Express, não é um site estático.

### Vercel

O `vercel.json` publica o frontend Vite e encaminha `/api/*` para a função Express em `api/index.js`. A função inclui os JSONs de configuração e o esquema SQL; não inicia um servidor com `listen`.

1. Importe este repositório na Vercel.
2. Em **Storage**, crie/conecte um banco **Neon** ao projeto. A integração deve fornecer `DATABASE_URL` (ou `POSTGRES_URL`). Prefira a região São Paulo (`gru1`), usada pela função.
3. Em **Environment Variables**, configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` para **Production**. A senha precisa de 12+ caracteres e até 72 bytes. `ADMIN_NAME` é opcional.
4. Faça um novo deploy. Na primeira chamada à API, as tabelas são criadas com `IF NOT EXISTS` e o administrador é criado/atualizado com senha bcrypt. As demais contas e os prontuários existentes são preservados.
5. Entre com o e-mail e a senha configurados. Login, sessão e histórico usam a API do próprio domínio.

`JWT_SECRET` aleatório de 32+ caracteres é recomendado, mas opcional com o administrador configurado: na ausência dele, a chave de sessão é derivada por scrypt da senha e do e-mail, de forma consistente entre instâncias. Nesse caso, trocar a senha invalida as sessões. Credenciais nunca usam prefixo `VITE_` nem entram no frontend.

Sem banco persistente configurado, a API retorna 503. Não existe fallback para armazenamento em memória na Vercel. Alterações nas variáveis só entram em vigor após um novo deploy. `ADMIN_EMAIL` e `ADMIN_PASSWORD` devem ser configurados juntos; sem eles, `JWT_SECRET` continua permitindo o uso das contas criadas pelo CLI.

## O que fica em `public/` (editável sem programar)

| Arquivo | Para quê |
| --- | --- |
| `hospital/logo.jpg` (ou `.png`) | Logo usado nos documentos e na tela. Troque o arquivo e ajuste `logo` no JSON; a proporção é mantida. |
| `hospital/hospital.json` | Nome, endereço e telefone do rodapé, título do sistema, ano mínimo de admissão e limite de dias para registrar depois do atendimento. |
| `config/enfermarias.json` | Lista de enfermarias: nome, modelo `.docx` usado, texto do cabeçalho e tipo (pediátrica, puérpera, receita de alta). |
| `config/dietas.json` | Opções de dieta. |
| `config/prescricoes.json` | Itens que o médico pode **marcar** na prescrição. |
| `modelos/*.docx` | Um modelo por enfermaria, com `{{MARCADORES}}`. |

> `public/` é servido sem login. Ele guarda só logo, dados do hospital e modelos **em branco** — nenhum dado de paciente. Mantenha o repositório privado.

### Regra da prescrição

Nada é herdado do modelo. A prescrição só tem a dieta escolhida, os itens **marcados** (lista de `prescricoes.json`) e os itens **digitados**. A lista começa com lembretes de documentação (alergias, sinais vitais) e **sem medicamentos**: só inclua um item depois de revisado por um médico, com texto completo (`{ "texto": "…", "revisado": true }`). Pediatria e RN exigem idade, peso e indicação quando há item clínico. O sistema **não calcula nem valida doses**.

### Atualizar um modelo

1. Substitua o `.docx` em `public/modelos/` (com `{{NOME}}`, `{{RELATO}}`, `{{CONDUTA}}` etc. nos mesmos lugares dos modelos atuais; veja os marcadores com qualquer um dos arquivos).
2. Rode `npm run preparar-modelos`: ele numera as linhas da tabela de prescrição (`{{RX_1}}`…), cria o parágrafo de continuação e liga o rodapé ao `hospital.json`. É idempotente.

## Regras que valem aqui (e no Google Forms)

O preenchimento segue as seções do Google Forms do hospital: **enfermaria → prescrição → identificação → evolução**, com **Voltar/Avançar**, dieta de escolha única com **Outro** e caixas de seleção para os itens. RN fica na prescrição da puérpera; receita de alta tem caminho próprio. Veja a [comparação de campos e fluxo](docs/preenchimento-google-forms.md).

- **Campo clínico vazio nunca vira achado normal.** Fica "NÃO INFORMADO — PREENCHER" (ou "SEM AVALIAÇÃO REGISTRADA — PREENCHER" no exame) e aparece na lista de avisos.
- **Data e hora do atendimento** (opcionais; vazias = agora) valem para o cabeçalho, as assinaturas, os dias de internação e a conferência da idade. Não podem ser futuras nem ter mais de 31 dias.
- **Idade composta** ("66", "1 ano e 3 meses", "3 meses e 10 dias", "15d") é conferida com o nascimento na data do atendimento.
- **O servidor valida de novo** o que o navegador enviar e só grava dados válidos.
- **Salvar antes de gerar**: sem registro no banco, o documento não é gerado.

## Segurança e LGPD

- Login por e-mail e senha (bcrypt), sessão em cookie `HttpOnly` + `SameSite=Strict` (8 h), limite de 10 tentativas de login por IP a cada 15 min.
- A API só aceita `application/json` do próprio site (proteção contra CSRF) e não vaza detalhes de erro.
- Tabela `eventos`: login, login falho, geração e consulta de cada prontuário.
- **O banco guarda dados de saúde** (o que foi digitado, para reabrir). Use um projeto Neon com acesso restrito, backups e a base legal/política de retenção do hospital. O `.docx` em si é gerado no navegador e não fica no banco.
- Não há exclusão de prontuários pelo sistema, de propósito.

## Testes

### Navegador e design (Playwright)

```bash
npm install
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

A suíte usa Chromium em desktop e celular simulados, nos temas claro e escuro. Cobre os oito caminhos, validações, voltar/avançar, dieta personalizada, download DOCX real, histórico e reabertura. O servidor serve o build de produção com banco isolado em memória, sem ler `.env` nem acessar o Neon. As capturas e os resultados do axe ficam no relatório HTML.

O design também é conferido entre 320 e 1440 pixels, incluindo o contraste dos botões em estado normal/hover sobre o gradiente. A inspeção das capturas complementa os testes automáticos de acessibilidade.

Para gravar um roteiro no Inspector, use `npm run test:e2e:codegen`; veja [as instruções do gravador](e2e/codegen/README.md). Para verificar a produção sem criar prontuários, defina `E2E_EMAIL` e `E2E_PASSWORD` no ambiente e rode `node e2e/verificar-online.mjs`. As credenciais não são gravadas no código nem nos relatórios.

```bash
npm test
```

Cobrem as regras (idade, datas, prescrição), o preenchimento dos **6 modelos reais** de `public/modelos/` (sem `{{` sobrando, prescrição numerada, continuação, rodapé, logo, puérpera, receita de alta), a **validade do XML** do .docx com texto hostil (&, <, aspas, emoji, caracteres de controle) e volumes grandes, a API (login, validação no servidor, CSRF, limite de tentativas, auditoria) com banco em memória e o **modo produção** (site + modelos servidos, cookie Secure; precisa de `npm run build`).

## O que ainda não foi verificado

- A conexão com o **Neon real** (precisa da sua string de conexão); a API foi testada com banco em memória e o SQL está em `server/schema.sql`.
- A abertura dos `.docx` gerados **no Microsoft Word**: os testes conferem o texto e a estrutura do arquivo, e o download foi testado no navegador.
