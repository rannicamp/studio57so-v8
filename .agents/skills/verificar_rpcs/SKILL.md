---
name: Verificar RPCs do Banco de Dados para MCP
description: Diretrizes para buscar, analisar e reutilizar funções do banco de dados (RPCs) em novas integrações e ferramentas MCP, evitando retrabalho e inconsistência de dados.
---

# Verificar RPCs do Banco de Dados para MCP

Este documento orienta os agentes a sempre verificarem e reutilizarem as lógicas internas do PostgreSQL (funções, triggers, procedures) já criadas no projeto Elo 57, em vez de reescrevê-las no Next.js.

## 📌 Protocolo de Inspeção

Sempre que o usuário solicitar uma nova funcionalidade de banco, alteração no backend ou ferramenta no MCP:

1. **Pesquisa Obrigatória no functions.json:**
   * Abra o arquivo [functions.json](file:///c:/Projetos/studio57so-v8/functions.json) e pesquise por palavras-chave relacionadas à operação (ex: "mesclar", "ponto", "estoque", "vale", "pedido").
   * Verifique se existe alguma RPC que realize a lógica desejada de forma síncrona ou automatizada.

2. **Inspeção de Migrações Recentes:**
   * Liste os arquivos do diretório [supabase/migrations/](file:///c:/Projetos/studio57so-v8/supabase/migrations) para ver se há funções declaradas em SQL recentemente que ainda não constam no indexador.

3. **Análise de Triggers Associadas:**
   * Ao fazer inserts ou updates diretos em tabelas, verifique se a tabela possui triggers automáticas cadastradas (ex: formatação de sinais financeiros, propagação de status de produtos imobiliários). 
   * Deixe que a trigger faça o trabalho no banco em vez de forçar o cálculo manualmente no código JavaScript da API.

## 💎 RPCs e Triggers Consolidadas no Elo 57

Sempre consulte e reuse estas lógicas:
* **CRM / Contatos:** `auto_merge_contacts_and_relink` (fusão de contatos), `fn_rotear_lead` (rodízio comercial).
* **Almoxarifado:** `registrar_retirada_estoque`, `registrar_devolucao_estoque`, `realizar_estorno_movimentacao`.
* **RH / DP:** `agendar_vale` (despesa + controle de vales), `get_previsao_folha_detalhada` (DRE de RH), `get_saldo_banco_horas` (Banco de horas).
* **Pedidos / Compras:** `marcar_pedido_entregue` (muda status e entra no estoque da obra).
* **Vendas / Comercial:** `recalcular_precos_com_cub` (reajuste automatizado de preços de lotes).
