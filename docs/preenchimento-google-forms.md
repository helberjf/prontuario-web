# Preenchimento igual ao Google Forms

Referência conferida no editor do [Google Forms do hospital](https://docs.google.com/forms/d/e/1FAIpQLSdxlXpdQf4WBUSs28KcFwEXFzQ7Cf6P7itXyP0AEQ73w8xOaQ/viewform), em 23/10/2026. Nenhuma resposta foi enviada nem o formulário original foi alterado.

## Sequência e controles

- Escolha obrigatória da enfermaria em lista, inicialmente em “Escolher”.
- Internação e pronto-socorro: prescrição do modelo escolhido → identificação do paciente → evolução / exame físico.
- Puérpera: campos do RN dentro da seção de prescrição, na ordem do Forms.
- Receita de alta: caminho específico com nome da puérpera, seleção dos itens e prescrição de alta em texto longo.
- Dieta: botões de escolha única com as nove opções existentes e “Outro”, que abre texto livre. Nenhuma resposta vem marcada.
- Prescrição: caixas de seleção com as opções atuais do Forms e texto longo para itens adicionais.
- Identificação: os mesmos campos curtos, datas e horário. Evolução: os mesmos seis campos de texto longo.
- Botões Voltar e Avançar. Gerar documento aparece apenas na última etapa do caminho escolhido.

As respostas de prescrição ficam separadas por modelo, como nas seções do Forms; masculino e pronto-socorro masculino compartilham a mesma seção. Trocar de enfermaria não transfere a prescrição de outro modelo. Voltar preserva as respostas. A identificação da internação e o nome da receita de alta são independentes.

Os pré-requisitos pediátricos são conferidos nos campos da identificação, para permitir preencher a prescrição antes da idade, peso e indicação. A validação completa do servidor permanece antes de salvar. A seção histórica inacessível “Campo antigo — não utilizar” não integra o preenchimento atual.

O app mantém autenticação própria, geração de DOCX e histórico no Neon. A conta autenticada identifica o autor, em lugar da coleta de e-mail pelo Google.

## Verificação

`npm test` cobre os caminhos das oito enfermarias, escolha de dieta, reabertura dos registros, isolamento das respostas e pré-requisitos pediátricos. Teste também no navegador: escolher enfermaria, avançar e voltar com respostas preenchidas, usar Outro, conferir RN e o caminho de alta, gerar com dados fictícios e reabrir pelo histórico.
