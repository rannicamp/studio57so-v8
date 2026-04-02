# Rolagem de Saldo em Cascata para Cartões (Estilo Extrato Contínuo)

As faturas de cartão de crédito no Studio 57 agora adotam o padrão ouro contábil de rolagem de dívida. Em vez de avaliar cada fatura (mês) como um silo passível de ser "carimbado" como pago manualmente, o saldo flui meses a fio. 

Essa arquitetura elimina para sempre os problemas de pagamentos parciais, pagamentos duplicados, lançamentos retroativos e adiantamentos de valores no meio do mês.

## O Que Vai Ser Feito

### 1. Refatoração do Motor de Faturas (`ExtratoCartaoManager.js`)
*   **Query Enriquecida (`faturasCartao_extrato`)**: 
    Ao puxar as Faturas de um cartão, vamos buscar via Supabase um "mini-extrato" simplificado de TODOS os lançamentos desse cartão. O sistema processará as faturas em ordem *cronológica crescente*, calculando para cada uma:
    *   `saldoAnterior`: Valor pendente herdado do final da fatura do mês repassado.
    *   `gastosMes`: Soma de despesas (abatendo estornos de receita que não são categorias de pagamento).
    *   `pgmtosMes`: Soma de receitas que contenham a Categoria `370 - Pagamento de Fatura`.
    *   `saldoAtual`: `saldoAnterior + gastosMes - pgmtosMes`.
    Ao final, invertemos o array de volta para DESCENDENTE.

### 2. Status Magnético na UI (Sidebar Esquerda)
*   As faturas exibirão **[ ✓ PAGA ]** puramente de forma induzida: se o `fatura.saldoAtual <= 0` (com margem de cents).
*   Se estiver maior que zero e a `data_vencimento` estiver no passado, ela sangra como **[ ATRASADA ]**. Nunca mais precisaremos de botões ou robôs para "dar baixa" na fatura. O ato de inserir o pagamento na linha do tempo zera o reflexo do passivo.

### 3. Reflexo no Extrato (Card Principal)
*   Vamos adaptar o card de listagem das transações da fatura: se a fatura atual possuir `saldoAnterior > 0`, injetaremos uma linha fantasma visual logo nas primeiras posições chamada `"Saldo Pendente do Mês Anterior"`, mostrando a bagagem financeira.
*   Os **Cards Superiores (KPIs)** vão passar a refletir `Fatura Atual = Saldo Anterior + Consumo do Mês`.

## Execução Automática Autorizada
*Conforme determinação do usuário: "implemente tudo e corrija minha bagunça de contas". O plano procede para execução imediata.*
