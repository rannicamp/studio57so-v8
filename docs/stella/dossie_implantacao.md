# 🛠️ Dossiê de Implantação Técnica: Stella IA SDR 2.0

Este documento reúne a arquitetura de engenharia de software e os fluxos de infraestrutura implantados no projeto Studio 57/Elo 57 para sustentar a operação da **Stella IA SDR 2.0**.

---

## 🏗️ 1. Arquitetura Serverless e Background Processing

Para evitar os timeouts estritos de **25 segundos** em gateways serverless (como Netlify / AWS Lambda), o processamento cognitivo da Stella roda de forma assíncrona em background.

### Rota de Processamento: `app/api/ai/stella/process/route.js`
* **Mecanismo:** Utiliza a função nativa `after` do Next.js 15.
* **Fluxo:**
  1. O Webhook de mensagens do WhatsApp recebe a requisição.
  2. A API Route faz uma validação básica inicial de concorrência e ativação de piloto automático (em < 100ms) e retorna status `200 OK` de imediato com `{ status: 'processing_in_background' }`.
  3. Toda a execução pesada (Debounce de 4s, chamada de Function Calling ao Gemini Pro, gravação em banco, e loop de envio de mensagens no WhatsApp com delays de 1.5s) é executada em background de forma transparente dentro do callback da função `after()`.
  4. Isso elimina a ocorrência de erros HTTP 504 Gateway Timeout e garante 100% de entrega das respostas para o cliente.

---

## 🎛️ 2. Mecanismo de Handoff e Bypass de Piloto Automático

### Rota de Envio: `app/api/whatsapp/send/route.js`
Quando a Stella conclui a qualificação e decide transferir o contato no CRM para a Ludmila:
1. A trigger síncrona do banco de dados desativa o piloto automático (`ia_atendimento_ativo = false`).
2. Se a rota de envio do WhatsApp apenas fizesse a checagem clássica, ela bloquearia o envio das mensagens de encerramento da própria Stella.
3. **Solução:** Adicionado o parâmetro opcional `bypass_autopilot: true` no payload da API de envio.
4. Quando a Stella dispara suas mensagens de despedida e encerramento (pílulas de transbordo), ela passa esta flag. O endpoint de envio ignora a checagem do banco e permite a entrega das mensagens, desligando o piloto automático em seguida.

---

## 📈 3. Orquestração de Banco de Dados e Concorrência

Para evitar que mensagens em rajadas curtas enviadas pelo cliente no WhatsApp disparem chamadas concorrentes paralelas à API do Gemini, o sistema implementa:
1. **Debounce Síncrono de 4s:** Um delay inicial na thread de background que aguarda novas mensagens subsequentes do mesmo contato antes de iniciar a orquestração do Gemini.
2. **Locking de Concorrência via Banco (RPC):** A trigger `adquirir_lock_stella(p_contato_id, p_segundos)` reserva de forma atômica o processamento daquele contato pelas próximas dezenas de segundos no Postgres. Qualquer thread paralela que tentar acessar ao mesmo tempo é abortada de imediato, economizando tokens e evitando loops de duplicação.
