# Auditoria Playwright e design — 23/10/2026

## Resultado final

- Playwright: **80 aprovados, zero falhas, zero ignorados**, sem retries automáticos.
- Vitest: **90 aprovados** em nove arquivos.
- Build e lint aprovados. `npm audit` sem vulnerabilidades após atualizar `body-parser` de 2.3.0 para 2.4.0.
- Chromium com Playwright 1.64.1. Quatro projetos: desktop 1440×900 e celular simulado 390×844, em claro e escuro. A geometria também é verificada em 320, 360 e 768 pixels.

## Cobertura

Login incorreto/correto, recarregamento da sessão e logout; oito enfermarias; seção correta por modelo; Voltar/Avançar; ausência de escolhas clínicas automáticas; dieta Outro obrigatória quando selecionada; preservação das respostas e isolamento das prescrições; validações pediátricas e do RN; falha ao salvar sem geração de arquivo; downloads reais de DOCX de internação e alta, leitura do XML e ausência de marcadores; busca no histórico e reabertura.

As operações de gravação usam exclusivamente banco em memória, com dados fictícios. O servidor de testes não lê `.env` nem acessa o Neon. O script opcional de produção `e2e/verificar-online.mjs` testa login, etapas e logout sem salvar prontuários ou consultar dados de pacientes.

## Design e problemas corrigidos

As capturas das oito telas por projeto foram geradas e as telas representativas foram inspecionadas. O axe verifica regras WCAG A/AA, e testes adicionais conferem largura dos controles, rolagem horizontal, altura do cabeçalho e contraste calculado sobre todas as cores do gradiente, incluindo composição RGBA dos botões normal/hover.

| Problema reproduzido antes da correção | Correção e regressão |
| --- | --- |
| Cabeçalho escuro com contraste mínimo 1,90:1 | Gradiente de marca independente da paleta de conteúdo; contraste mínimo exigido 4,5:1. |
| Botões com contraste 4,17:1 e botão ativo no hover com 1,24:1 | Fundo dos botões escurecido e hover não altera o botão ativo. As transições são desativadas somente durante a medição do estado final. |
| Cabeçalho móvel com 172 px e navegação em três linhas | Grade de navegação com três botões na mesma linha; teste com nome longo exige até 132 px em 320 e 390 px. |
| Receita de alta mostrava “a prescrição passou de 0 itens” | O bloco ITENS da alta não passa pelo cálculo de continuação da tabela RX_n. Testes de UI e DOCX confirmam ausência do falso aviso. |

Nas rodadas com dois navegadores simultâneos ocorreram timeouts intermitentes na abertura inicial, com requisições pendentes no trace. O diagnóstico com um único navegador e dois contextos carregou o app em 100–110 ms. A configuração usa um worker no Windows e mantém os mesmos timeouts, sem sleeps nem retries para contornar assertions. A rodada final serializada terminou sem falhas. Isso não equivale a uma garantia sobre redes ou dispositivos de usuários.

O histórico é capturado depois da resposta da API e com registros fictícios já carregados. A tabela pode rolar horizontalmente dentro de sua área; os testes verificam que a página não alarga e que o botão Reabrir fica acessível após a rolagem. A verificação de produção também passou com login, quatro combinações de tela/tema e logout, sem erros de JavaScript e sem criar prontuários.

## Codegen

O CLI foi aberto com Chrome e Playwright Inspector e gerou a navegação inicial. A automação da janela foi interrompida pelo controle de segurança do Windows por não conseguir confirmar a URL com confiança. **A gravação interativa dos cliques não foi concluída.** Os testes automatizados acima foram escritos e executados com Playwright Test; não se apresentam como código gravado pelo codegen.

`npm run test:e2e:codegen` fica disponível para gravar o fluxo. O runner usa uma porta dinâmica própria e propaga falhas/sinais do gravador. Quatro testes de infraestrutura cobrem conflito de porta, portas distintas, saída com erro, sinal e fechamento normal. A gravação local fica fora do Git.

## Evidências e repetição

- [Desktop claro](desktop-claro.png), [desktop escuro](desktop-escuro.png), [celular claro](celular-claro.png), [celular escuro](celular-escuro.png).
- Relatório HTML local: `playwright-report/index.html`, com capturas e resultados do axe anexados. Abra com `npm run test:e2e:report`.
- Resultado estruturado local: `test-results/resultados.json`.
- Reexecutar: `npm run test:e2e`; testes unitários: `npm test`.

Os cenários móveis usam emulação do Chromium. Não foram testados dispositivos físicos, Firefox ou WebKit. A checagem automática de acessibilidade não constitui auditoria WCAG completa.
