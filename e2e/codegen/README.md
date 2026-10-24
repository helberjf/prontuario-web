# Gravação com Playwright codegen

Execute `npm run test:e2e:codegen`. O comando compila o app, cria um servidor com banco em memória em uma porta livre e abre Chrome + Playwright Inspector.

Use `demo@example.com` / `demo-demo-demo`, percorra as seções e feche o navegador para concluir. O código fica em `e2e/codegen/formulario.recording.js`, ignorado pelo Git. Revise a gravação antes de convertê-la em teste: os casos automáticos usam `baseURL`, dados fictícios e assertions explícitas.

Esse comando não carrega `.env` nem conecta ao Neon. Erros do gravador propagam código de saída diferente de zero. Cancelar não é considerado gravação concluída.

Na auditoria de 23/10/2026, o codegen abriu e registrou a navegação inicial. A gravação dos cliques pela automação de Windows foi interrompida porque ela não conseguiu confirmar a URL da janela com segurança. Os testes de interação em `fluxos.spec.js` são escritos e executados pelo Playwright Test; não se apresentam como uma gravação concluída de codegen.
