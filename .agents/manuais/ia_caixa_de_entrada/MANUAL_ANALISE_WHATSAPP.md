# Manual de Funcionamento da IA da Caixa de Entrada (Devonildo)

Este manual documenta a engenharia reversa do funcionamento **atual** da Inteligência Artificial que analisa as conversas do WhatsApp (Caixa de Entrada / CRM) no sistema Elo 57.

## 1. Localização no Código
O motor principal que orquestra a análise das conversas está localizado em:
`app/api/ai/chat-analysis/route.js`

## 2. Fluxo de Execução (Passo a Passo)

### Passo 1: Gatilho e Cache Anti-Desperdício
Sempre que um corretor abre o perfil do contato no painel do WhatsApp, o front-end chama a API enviando o `contato_id`. 
Para não queimar tokens (dinheiro) da API do Google, o sistema primeiro vai à tabela `contatos` e checa a coluna `ai_analysis`. Se já existir uma análise salva (e o usuário não apertou para forçar a atualização), o servidor retorna o texto do cache instantaneamente.

### Passo 2: A "Fofoca" Estruturada (Histórico)
Se a IA precisar processar, ela busca as últimas 100 mensagens daquele Lead na tabela `whatsapp_messages` (filtrando por `contato_id` e `organizacao_id`).
Ela inverte a lista para que a leitura fique cronológica (da mais antiga para a mais recente) e formata no padrão:
> `[14:30] Cliente: Qual o valor?`
> `[14:32] Corretor: Custa 300 mil.`

### Passo 3: Cruzamento Tático de CRM
O script não lê só as mensagens; ele investiga o funil de vendas. Ele consulta a tabela `contatos_no_funil` para descobrir:
1. **Fase do Funil Atual:** Ex: "Em Negociação", "Lead Novo".
2. **Produtos Vinculados:** Quais empreendimentos o lead demonstrou interesse cruzando com `contatos_no_funil_produtos` (ex: "Beta Suítes").
*(Nota: Se a caixa de entrada não tiver histórico, a API aborta a chamada ao Gemini e retorna uma mensagem fria recomendando iniciar a conversa).*

### Passo 4: O Prompt de Elite
A API utiliza o modelo topo de linha `gemini-3.1-pro-preview`.
O "System Prompt" configura a persona: *"Você é DEVONILDO, o super Analista Comercial de Elite da Studio 57"*.
O prompt entrega para a IA os dados do CRM e o histórico de mensagens formatado, exigindo explicitamente que a IA não seja criativa na formatação, mas retorne um JSON rigoroso.

### Passo 5: Diagnóstico e Formatação Final
O Gemini devolve um objeto JSON preenchido que o Node.js trata e salva no cache (`ai_analysis` na tabela `contatos`). O formato JSON retornado é:
- `resumo_interacao`: Uma síntese de até 3 linhas apontando as dores e intenções reais do cliente.
- `temperatura`: Apenas uma string seca: "Quente", "Morno" ou "Frio".
- `fase_crm_atual`: A fase espelhada do CRM.
- `proxima_acao_sugerida`: Uma dica tática de como o corretor deve responder à última mensagem do cliente.
- `last_updated`: Timestamp da análise.

---
**Nota de Evolução:** Este manual reflete a versão estática da IA (que apenas lê e dá palpite). Futuras atualizações envolverão *Function Calling* e consultas dinâmicas às tabelas de estoque e preços do sistema.
