# Plano de Implementação: Modo Quick Response da Stella para Atendimento em Tempo Real (WhatsApp)

Para evitar timeouts de 10 segundos rígidos em servidores serverless (como Netlify) em conversas contínuas de texto, implementaremos o **Modo Quick Response** na API comercial da Stella. Esse modo será ativado apenas quando a requisição for disparada pelo piloto automático do WhatsApp, gerando um prompt simplificado e focado estritamente no diálogo e anexo, reduzindo a latência de geração do Gemini de 20s para menos de 2.5s.

## User Review Required

> [!IMPORTANT]
> **Modo Quick Response (Stella Fast)**:
> Quando o cliente enviar mensagens de texto comuns, o webhook chamará a API com `quickResponse: true`. A Stella não processará a extração cadastral pesada de 20 campos nesse momento, gerando apenas a resposta textual e a indicação de anexo. Isso garante a resposta no WhatsApp em **menos de 3 segundos**.
>
> **Fluxo de Cadastro (CNH / Comprovante)**:
> O enriquecimento cadastral detalhado (extração de CPF, RG, nascimento, endereço e estado civil) continuará sendo feito de forma completa quando o corretor interagir no painel (que roda sem limite de timeout de webhook) ou quando a mensagem recebida for uma mídia de documento.

## Proposed Changes

### AI Chat Analysis Route

#### [MODIFY] [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js)
* **Flag `quickResponse`**: Receber a flag no corpo do `POST`.
* **Prompt Otimizado**: 
  - Se `quickResponse` for `true`, o prompt do Gemini exigirá apenas as chaves `proxima_resposta_sugerida` e `anexo_sugerido` no JSON, instruindo a IA a pular a análise cadastral detalhada e focar na resposta rápida e fluida.
  - Se `quickResponse` for `false` (chamada do painel ou documento), o prompt completo com `dados_cliente` e enriquecimento na tabela `contatos` é executado normalmente.

### Webhook do WhatsApp

#### [MODIFY] [route.js](file:///c:/Projetos/studio57so-v8/app/api/whatsapp/webhook/route.js)
* **Ativação da Flag**: Passar `quickResponse: true` na chamada síncrona do piloto automático para mensagens de texto comuns.

---

## Verification Plan

### Testes
* Executar o script de teste do webhook de produção para a mensagem *"Qual é essa unidade?"* e verificar se a Stella responde em menos de 3 segundos sem timeouts 504 no Netlify.
* Validar que as respostas sugeridas e anexos continuam sendo gerados corretamente com o Gemini 2.5 Flash no modo rápido.
