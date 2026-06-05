# Checklist de Implementação: Leitura de CNH e Piloto Automático Seguro em Nuvem

Rastreamento de tarefas para a implantação da leitura automática de PDFs (como CNH) via Gemini inline na memória RAM e a mudança do piloto automático da Stella para execução síncrona idempotente.

- `[x]` Atualizar a API de análise de chat `/app/api/ai/chat-analysis/route.js` para buscar a mídia mais recente e passá-la como Base64 (inlineData) para o Gemini.
- `[x]` Modificar as regras de enriquecimento cadastral no `/app/api/ai/chat-analysis/route.js` de `preencherSeVazio` para `atualizarSeDiferente` para campos gerais (como `estado_civil`).
- `[x]` Atualizar o webhook `/app/api/whatsapp/webhook/route.js` para processar a Stella de forma síncrona na requisição quando o piloto automático estiver ligado.
- `[x]` Criar um script de teste simulando a conversa com anexo da CNH e a resposta de estado civil.
- `[x]` Validar a atualização dos dados cadastrais (CPF, RG, nascimento, estado civil) na tabela `contatos`.
- `[x]` Realizar o commit e push das alterações para o GitHub.

## Coleta Inteligente de Endereço e Comprovante de Residência (CEP e PDF/Imagem)
- `[x]` Atualizar o prompt da Stella no `/app/api/ai/chat-analysis/route.js` para solicitar ativamente o CEP, Número e Complemento se estiver faltoso, e aceitar comprovante de residência em PDF ou Imagem.
- `[x]` Adicionar orientações no prompt da Stella para extrair dados de endereço de comprovantes (mídias) e de mensagens de texto com foco em CEP, número e complemento.
- `[x]` Criar/atualizar o script de teste para simular o recebimento de dados de endereço por texto e comprovar o preenchimento no banco.
- `[x]` Validar a extração e salvamento correto de CEP, número e complemento de endereço.
- `[x]` Realizar o commit e push das alterações para o GitHub.

## Modo Quick Response (Fast) e Fix do Estoque Real no Chat Log
- `[x]` Implementar a flag `quickResponse` na API de análise de chat `/app/api/ai/chat-analysis/route.js` para simplificar o prompt e omitir a extração cadastral pesada.
- `[x]` Mesclar a resposta rápida gerada pelo modo rápido com o cache cadastral existente na coluna `ai_analysis` para não perder dados ricos anteriores.
- `[x]` Modificar o webhook `/app/api/whatsapp/webhook/route.js` para ativar `quickResponse: true` em mensagens de texto comuns e `false` em mensagens de mídia (documentos/imagens).
- `[x]` Adicionar a detecção de palavras-chave de empreendimentos ("alfa", "beta", "braunas") no histórico recente de mensagens do WhatsApp no `/app/api/ai/chat-analysis/route.js` para buscar e injetar o estoque correto no prompt.
- `[x]` Adicionar a **Regra do Estoque Real Imediato** no prompt da Stella para proibir respostas evasivas e forçar a listagem imediata de unidades reais e seus cálculos exatos de simulação.
- `[x]` Validar a velocidade (menos de 20s em localhost, deve ser sub-2.5s em produção aquecida) e conferir se as unidades reais disponíveis (como a unidade 703 do Beta Suítes) estão sendo listadas corretamente no teste rápido.
- `[x]` Realizar o commit e push das alterações para o GitHub.

## Retorno ao Modelo Gemini 3.1 Pro Preview
- `[x]` Alterar o modelo da rota comercial `/app/api/ai/chat-analysis/route.js` de `gemini-2.5-flash` de volta para `gemini-3.1-pro-preview`.
- `[x]` Realizar o commit e push da alteração para acionar o deploy automático no Netlify.
- `[x]` Resetar o contato de teste do Ranniere (ID 5598) para simular o primeiro contato com a Stella na versão do modelo 3.1.

## Prevenção contra Envio de Anexos Duplicados
- `[x]` Adicionar busca das mensagens outbound com mídias associadas ao contato no `/app/api/ai/chat-analysis/route.js` (a partir da tabela `whatsapp_messages`).
- `[x]` Formatar a variável `anexosEnviadosContext` contendo o nome e URL/caminho de mídias enviadas anteriormente no histórico de conversa.
- `[x]` Modificar as orientações do prompt da Stella comercial (quick e full) para proibir a repetição/duplicidade de anexos sugeridos, abrindo exceção apenas quando houver pedido explícito de reenvio por parte do cliente.
- `[x]` Criar e rodar o script de teste automatizado `testar_duplicidade_anexos.js` validando as 3 rodadas (envio inicial, bloqueio preventivo de repetição e reenvio sob pedido explícito).
- `[x]` Realizar o commit e push das alterações para o repositório principal no GitHub.

## Trava de Concorrência e Debounce contra Rajadas de Mensagens (Caso Igor)
- `[x]` Analisar o histórico de mensagens do Igor e identificar a causa da duplicidade (duas mensagens inbound separadas por 11s rodando em concorrência paralela no Gemini).
- `[x]` Implementar no webhook `/app/api/whatsapp/webhook/route.js` um debounce com delay fixo de 4 segundos.
- `[x]` Adicionar validação de concorrência que verifica se mensagens inbound mais recentes chegaram durante a janela de debounce, abortando execuções anteriores com `ignored_older_inbound_during_debounce`.
- `[x]` Criar/atualizar o script de validação de concorrência `testar_trava_rajada.js` para simular rajadas de mensagens inbound locais.
- `[x]` Validar o sucesso do teste local (primeira chamada aborta no debounce, segunda chamada processa a Stella normalmente).
- `[x]` Realizar o commit e push das alterações para o GitHub.
## Reforço da Segurança e Transparência Comercial (Disclaimer de IA)
- `[x]` Atualizar a regra 1 ("Rapport e Apresentação com Disclaimer") nos prompts de `quickResponse` e de análise completa no `/app/api/ai/chat-analysis/route.js`.
- `[x]` Configurar a Stella comercial para declarar explicitamente que é uma IA, que pode cometer erros e que toda simulação/informação deve ser verificada por um ser humano antes de assinar contrato.
- `[x]` Commitar e enviar as alterações para o repositório remoto no GitHub.
