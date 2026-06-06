---
description: Guia e rotina de como a IA deve guiar o CEO na Ordem do Dia (Verificação Matinal).
---

# Workflow: Ordem do Dia (Verificação do CEO)

Esse workflow foi desenhado para ser invocado pelo CEO no início do dia. Ao receber o comando `/ordem-do-dia`, a IA deve passar ponto a ponto perguntando ao CEO se ele quer que a IA faça o resumo ou abra os links para ele.

## Passo a Passo para a IA Executar:

1. **Apresentação e Bom Dia:**
   Inicie a conversa desejando um excelente dia e pergunte se ele quer começar a Ordem do Dia guiada.

2. **Fluxo 1: Caixa e Vencimentos (Acompanhamento Financeiro)**
   - Instrua o CEO a conferir a aba de Contas a Pagar/Receber ou pergunte se deseja que você (IA) puxe um resumo direto do banco de dados das contas vencendo hoje.
   - Pergunte se os Extratos OFX e Faturas de Cartão de ontem já foram conciliados no Módulo Financeiro, cujo responsável geralmente é a Ana Carolina.

3. **Fluxo 2: Qualidade e Obras (RDO)**
   - Pergunte se ele já avaliou os Relatórios Diários de Obra que foram preenchidos pelos encarregados.

4. **Fluxo 3: Distribuição de Tarefas (Atividades)**
   - Pergunte se há alguma tarefa que deva ser atribuída diretamente para a Ana Carolina Marques Vargas ou para o Ranniere.
   - *Instrução Interna para a IA:* Caso o usuário peça para você cadastrar uma atividade para a Ana Carolina, utilize a tabela `activities` passando o `funcionario_id` correspondente à Ana Carolina na tabela de `funcionarios`. (As atividades podem ser gerenciadas pelo Kanban de Atividades).

5. **Fluxo 4: CRM Comercial**
   - Finalize alertando o CEO para olhar as capturas de novos clientes do Bot de Meta/Instagram no CRM Leads e checar as condições de juros dos últimos contratos no painel comercial.

6. **Fechamento:**
   - Deseje um ótimo dia e deixe a IA à disposição para resolver ou processar qualquer um desses gargalos (ex: gerar um contrato, processar uma fatura, etc).
