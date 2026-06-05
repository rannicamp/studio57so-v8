# Relatório de Triagem de Bugs (Feedbacks Pendentes)

Abaixo estão listados os tickets de feedback atualmente com status 'Novo' ou 'Em Análise', agrupados por módulo. O banco de dados já foi atualizado com os diagnósticos técnicos detalhados e os planos de solução.

## Módulo: Financeiro

### Ticket #145: Bug de Data no Relatório Financeiro
**Reportado por:** Usuário 
**Impacto:** Médio (Visualização Incorreta)
*   **Problema Relatado:** As datas do relatório financeiro estão aparecendo erradas em certos casos (quando existe pagamento antecipado, ainda mostra o vencimento).
*   **Diagnóstico Técnico:** O componente `LancamentosManager.js` na área de impressão (linhas 580 e 595) estava ignorando a coluna `data_pagamento`, forçando a renderização de `data_vencimento` mesmo para lançamentos já pagos antecipadamente.
*   **Plano de Solução:** Atualizar o código da visão de impressão para aplicar o mesmo fallback da exportação CSV: `isCompetenciaMode ? item.data_transacao : (item.data_pagamento || item.data_vencimento || item.data_transacao)`.

---

## Módulo: Contratos

### Ticket #146: Erro de Lançamento de Parcelas de Contrato
**Reportado por:** Sistema / Alerta de Erro
**Impacto:** Crítico (Bloqueia Funcionalidade de Integração Financeira)
*   **Problema Relatado:** Erro "Erro ao criar lançamento financeiro" ao tentar provisionar parcelas de um novo contrato para o financeiro.
*   **Diagnóstico Técnico:** As funções de banco de dados (RPCs) `provisionar_parcelas_contrato` e `sincronizar_parcela_com_lancamento` foram programadas para criar novas categorias e contas financeiras (além dos lançamentos) para os contratos provisionados, MAS omitiram a inserção obrigatória da coluna `organizacao_id`. Devido à nossa arquitetura Multitenancy, inserções sem `organizacao_id` falham (RLS ou violação de constraint Not Null).
*   **Plano de Solução:** Reescrever os DDLs de ambas as RPCs no banco de dados para garantir que os `INSERT`s em `categorias_financeiras`, `contas_financeiras` e `lancamentos` incluam o parâmetro `p_organizacao_id` que já é passado para a função pelo front-end. 

---

### Próximos Passos
Os diagnósticos acima já foram salvos no banco de dados (`status` atualizado para **Em Análise**). 

**Para prosseguir com a codificação das correções, por favor, responda com:** 
> *"Pode implementar"*
