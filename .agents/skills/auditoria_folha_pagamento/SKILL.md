---
name: Operar Auditoria de Folha de Pagamento
description: Ensina a IA a auditar mês a mês a Folha de Pagamento (Obras e ADM), detectando anomalias de preenchimento humano como salários ou vales cadastrados com sinal positivo (Receita no lugar de Despesa).
---

# ⚙️ Manual de Operação Autônoma: Auditoria de Folha de Pagamento

## 1. Contexto e Motivação Operacional
O painel de DRE consolidada ("DRE de Custo de Obra" e Geral) utiliza a função RPC `dre_matriz_agrupada_obras` para somar despesas. Se o preenchimento humano (*Data Entry*) vacilar e inserir Vales ou Salários como **Receita (Sinal Positivo +)** na categoria Folha, a base de dados vai somar os débitos contra os créditos e gerar um achatamento ilusório do custo real no painel do CEO. Seu trabalho ao ser convocado para auditar é caçar esses sinais trocados!

## 2. Banco de Dados e Parâmetros Base
- **Tabelas Relacionais:** `lancamentos` (A base), `categorias_financeiras` (Para filtrar folha), e potencialmente `contatos` (Para ver o nome do favorecido, funcionário).
- **Validação de Status:** Na auditoria financeira construtiva, o regime adotado é **Caixa Efetivo**. Sempre audite cruzando se `(l.status IN ('Pago', 'Conciliado') OR l.conciliado = true)`.
- **Agrupamento de Competência:** Nunca agrupe puramente por `data_vencimento`. O DRE respeita o `to_char(COALESCE(l.data_pagamento, l.data_vencimento), 'YYYY-MM')`.

## 3. Padrão Ouro de Diagnóstico (Triggers Automatizadas de Banco)

Com a adoção da **Formatação de Sinais Financeiros Automática**, a base de dados força nativamente o valor na coluna `valor` a ser **apenas negativo (-)** para Despesas, e positivo para Receitas, ignorando se o usuário na tela preencheu com mais ou menos. O Banco dispara a trigger `trg_formatar_sinal_lancamento`.
O que dita se o lançamento foi abatido incorretamente é se no ato do cadastro, a pessoa classificou equivocadamente algo na coluna `tipo` (ex: colocou 'Receita' no tipo).

### Script / Query de Mapeamento:
```sql
SELECT 
    l.data_pagamento, 
    l.data_vencimento,
    l.valor,         -- DESPESAS DEVERÃO SER NEGATIVAS. SE ESTÁ + AQUI DENTRO DA CATEGORIA DE OBRAS, PODE SER UM ESTORNO OU ANOMALIA
    l.tipo,          -- AQUI VOCÊ DEVE CAÇAR ANOMALIAS IGUAIS A 'Receita' OU NULL
    l.descricao, 
    c.nome as categoria
FROM lancamentos l
LEFT JOIN categorias_financeiras c ON l.categoria_id = c.id
WHERE 
    c.nome ILIKE '%folha%'
    AND to_char(COALESCE(l.data_pagamento, l.data_vencimento), 'YYYY-MM') = '2026-03' -- (VARIE CONFORME SOLICITADO)
    AND (l.status IN ('Pago', 'Conciliado') OR l.conciliado = true)
ORDER BY l.valor DESC; 
```

### O Que Fazer ao Encontrar Valores Inconsistentes:
Ao processar os arrays, filtre todos os pagamentos de Folha (Custo de Obra) que estejam com `tipo = 'Receita'`. Calcule o somatório dessa anomalia para mostrar ao CEO quanto dinheiro exato está sendo *creditado em dobro contra a despesa real* (pois uma folha cadastrada como Receita distorce a DRE integralmente). Produza tabelas (em Markdown) destacando em negrito os registros falhos.

## 4. Ordem e Regra de Correção Sistemática

A **Regra de Ouro Financeira** (Studio 57 / Elo 57) dita as seguintes blindagens inquebráveis: 
- *"Todo desembolso, adiantamento, vale ou salário é exclusivamente uma SAÍDA corporativa (Despesa)"*.
- *"Sinais de Menos (-) são proibidos no Banco de Dados (Transaciona-se apenas o Absoluto)"*.

Se você for convocado para agir via script de banco, aplique imediatamente um `UPDATE` forçando a string `tipo = 'Despesa'` e cravando a aplicação de `ABS(valor)` para exterminar qualquer resíduo de formatação negativa antiga. Se autorizar via UI, oriente o preenchimento manual do seletor.
