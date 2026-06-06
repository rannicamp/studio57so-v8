---
description: Como implementar a integração Multi-Tenant de WhatsApp via Meta Embedded Signup (SaaS)
---

# 🚀 Workflow Oficial: Migração WhatsApp Multi-Tenant (WABA SaaS)

Este workflow documenta o processo arquitetural e de engenharia para transformar a conexão de WhatsApp do Elo 57 em 100% Multi-Tenant, permitindo que cada cliente (Organização) conecte seus próprios números (Embedded Signup) sem sujar as variáveis de ambiente `.env` da Matriz/Studio 57.

---

## 📦 1. Estrutura do Banco de Dados (Onde as coisas ficam)

### A. Tabela `integracoes_meta`
Armazena a permissão base (o consentimento) e vincula o ID do usuário do Facebook com a Organização no nosso sistema.
- `organizacao_id` (bigint): O dono da integração.
- `access_token` (text): O System User Token de vida infinita (Long-Lived).
- `whatsapp_business_account_id` (text): O ID da WABA do cliente criada durante o fluxo.
- `status` (text): Opcional ('ativo', 'inativo').

### B. Tabela `configuracoes_whatsapp`
Armazena o "Motor do WhatsApp", ou seja, de onde as mensagens daquela organização vão sair e chegar.
- `organizacao_id` (bigint): A organização dona do número.
- `whatsapp_phone_number_id` (text): O Telefone Comercial daquele cliente ("Número de Envio").
- `whatsapp_business_account_id` (text): Correspondência ID da WABA.
- `whatsapp_permanent_token` (text): System Token que tem a permissão para disparar desse telefone.

---

## ⚡ 2. Frontend: Fluxo "Embedded Signup"

**Objetivo:** Permitir ao usuário plugar a Meta sem sair do painel.

1. Chamar o `window.FB.init()` inicializando o aplicativo Oficial do WhatsApp (**1459952825742829**).
2. Botão "Conectar WhatsApp" dispara:
   ```javascript
   window.FB.login((response) => {
      // response.authResponse.accessToken conterá o código temporário OAUTH
   }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
      extras: { feature: 'whatsapp_embedded_signup' }
   });
   ```
3. O Frontend pega o `accessToken` que dura de 1 a 2 horas e envia por `fetch('/api/meta/waba-oauth')` para o Backend.

---

## 🛠️ 3. Backend (O Segredo do Token Exchange)

**Objetivo:** Fazer o "Handshake" com a Meta e salvar de forma infinita usando o App Secret.

1. **Troca do Token:** A rota `/api/meta/waba-oauth` usa a API da Meta para trocar o token temporário por um `System User Access Token` que NUNCA expira.
2. **Descoberta do WABA ID e Telefone:** Pela API do Facebook (`/v22.0/me/accounts`), o servidor consome as WABAS que o cliente selecionou e escolhe o primeiro Phone Number ID.
3. **Salvamento:** O backend insere os dados em `configuracoes_whatsapp` atrelados ao `organizacao_id`.

---

## 🚦 4. O Coração: Webhooks Multitenant

Quando a Meta manda uma mensagem que alguém enviou para os nossos clientes, ela não manda para rotas separadas. Todo tráfego cai em um buraco só: `/api/whatsapp/webhook`.
1. A API recebe a mensagem e olha para `metadata.phone_number_id` no JSON enviado pelo Facebook.
2. Com isso, ela faz a query: `SELECT organizacao_id FROM configuracoes_whatsapp WHERE whatsapp_phone_number_id = recebido LIMIT 1`.
3. Com o `organizacao_id` e o `token`, ela roteia a mensagem para o CRM/Chat respectivo do cliente! 

*Observação Prática: Como somos BSP oficiais, basta que TODOS os clientes selecionem nosso App e os webhooks de todos os telefones deles baterão no nosso endpoint sem configuração adicional por parte deles.*

---

## 🚀 5. Testes Sem Impactar o Sistema de Vendas Atual
**REGRA DE OURO:** Tudo deve ser testado em um "silo" até ter 100% de confiança para não desconectar os corretores do Elo 57 em plena operação dia.

**O Flow Seguro:**
1. Criar `app/(main)/configuracoes/waba-saas/page.js` e programar lá.
2. Fazer o Login OAuth com um Facebook aleatório no número teste.
3. Mandar WhatsApp pro número de teste e checar pelo Log se o Banco de Dados interceptou corretamente aquele Phone_Number_Id e associou ao Cliente Certo.
