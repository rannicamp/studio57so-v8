# 🏡 Transição de Contexto: WhatsApp & CRM (Para Continuar de Casa)

Este documento foi gerado pelo seu mentor técnico **Devonildo** para garantir que você e qualquer IA assistente em sua casa possam retomar os trabalhos exatamente de onde paramos, sem perder nenhum detalhe estratégico.

---

## 🚀 1. Resumo do que foi Consertado Hoje

### A. Correção dos IDs da Meta (Fim das Mensagens Fantasmas)
*   **O Erro**: O sistema estava usando um App ID de desenvolvimento da Meta (`14599...`). O token associado a ele causava erros de permissão ao tentar enviar templates e travava o webhook.
*   **A Correção**: 
    *   Atualizamos o ID do telefone comercial oficial para **`690198827516149`** atrelado ao App ID oficial de produção **`2052352668968564`** (início 2).
    *   Substituímos o token permanente na tabela `public.configuracoes_whatsapp` da Org 2 (Studio 57) no Supabase.
    *   **Resultado**: Envio de templates oficiais (`saudacao_entrada_v3` e `reativar_contato`) com variáveis dinâmicas homologado com sucesso absoluto (HTTP 200) e sincronização instantânea de status de leitura (`read`) e clique nos botões interativos.

### B. Resolução de Duplicidade de Contatos (Caso Amanda)
*   **O Erro**: Mensagens de números novos criavam contatos temporários `"Lead (Telefone)"`. Ao preencher o telefone no contato real, as conversas não se vinculavam automaticamente.
*   **A Correção**: 
    *   Realizada a mesclagem manual do Lead temporário `5775` com a Amanda Real (`5226`) no banco.
    *   Mergidos: 49 mensagens, conversa do WhatsApp e posicionamento no funil.
    *   O contato temporário foi deletado. A caixa de entrada exibe agora o nome completo da Amanda normalmente.

### C. Resolução de Duplicidade de Conversas (Caso Ranniere - 9º Dígito)
*   **O Erro**: A Meta envia mensagens inbound sem o 9º dígito. Envios outbound usavam o 9º dígito. Isso criava duas conversas no chat para a mesma pessoa.
*   **A Correção**:
    *   Unificadas todas as mensagens do Ranniere na conversa padrão (`19589`) e deletada a conversa duplicada com o 9 (`19733`).
    *   **Blindagem de Código**: Alterada a rota `app/api/whatsapp/send/route.js` para realizar uma busca inteligente pré-upsert. Se já existir uma conversa ativa com o número (com ou sem o 9), o sistema atualiza ela, impedindo duplicações de tela.

---

## 📦 2. Estado do Deploy e Repositório Git
*   **Commit e Push**: Todas as alterações locais foram comitadas e enviadas para o GitHub na branch `main`.
*   **Netlify**: O deploy foi concluído com sucesso (status `ready`) e a última versão já está ativamente servindo a produção.
*   **Variáveis de Ambiente**: As chaves `NEXT_PUBLIC_FACEBOOK_APP_ID`, `NEXT_PUBLIC_FACEBOOK_APP_ID_WA` e `FACEBOOK_CLIENT_SECRET` estão devidamente salvas no Netlify apontando para o App início 2.

---

## 🎯 3. Onde Paramos & Próximos Passos (Para Fazer de Casa)

Quando você abrir o projeto em casa, as seguintes frentes estão prontas para desenvolvimento:

1. **Testes do Embedded Signup**:
   * Testar a conexão de WhatsApp em uma nova organização de testes (com um de seus amigos) para garantir que a geração do token permanente e a gravação no banco fluem 100% de forma transparente.
2. **Integração do Asaas (Recebimento de Assinaturas)**:
   * **Objetivo**: Implementar o Asaas como gateway de pagamento para receber as mensalidades e assinaturas do Elo 57 dos clientes parceiros/amigos.
   * **Referência**: Consulte o `PLANEJAMENTO_MASTER.md` na pasta `.agents` para ver os requisitos de assinatura e meios de pagamento mapeados.
3. **Trigger de Auto-Mesclagem (Opcional)**:
   * Implementar a trigger no banco de dados (`AFTER INSERT OR UPDATE ON public.telefones`) para automatizar em definitivo a mesclagem de leads temporários com contatos reais atualizados (conforme desenhado na conversa de hoje).

---

### 🔑 Configurações Ativas em Produção
*   **App ID Meta**: `2052352668968564`
*   **Phone ID Matriz (Org 2)**: `690198827516149`
*   **Banco de Dados**: Ativo no Supabase.
