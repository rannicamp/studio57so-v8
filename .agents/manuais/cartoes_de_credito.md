# Manual do Módulo: Faturas de Cartão de Crédito

> **Status:** Ativo & Auditado
> **Data da Última Revisão:** Abril de 2026
> **Responsável Técnico:** Agente IA (Devonildo)

Este manual documenta o funcionamento integral da mecânica de Cartões de Crédito e Faturas no ecossistema do Studio 57 (Elo 57). Toda a lógica central de provisionamento e roteamento de gastos foi movida para o Banco de Dados (Supabase), garantindo que nenhum front-end possa bagunçar a linha do tempo financeira.

---

## 1. Regra de Negócio (A Matemática dos Ciclos)

No Studio 57, a espinha dorsal de um cartão de crédito é moldada por dois parâmetros da tabela de contas: `dia_fechamento_fatura` e `dia_pagamento_fatura`.

### 1.1 Fechamento da Fatura (Mês Lógico)
A regra de corte que agrupa as transações segue o formato estrito de limite diário contábil:
- **Transação no dia ou antes do Fechamento:** Se você compra algo no dia 15, e o cartão fecha no dia 28 do mesmo mês, aquela compra pertence ao Ciclo de Fechamento do *Próprio Mês*.
- **Transação após o Fechamento:** Se você compra algo no dia 29, o limite contábil daquele mês já virou. A compra pertencerá organicamente ao Ciclo de Fechamento do *Mês Seguinte*.

### 1.2 O Data de Vencimento e o "Mês de Referência"
Diferente de sistemas que agrupam faturas pelo mês em que a compra ocorreu, **o Studio 57 agrupa faturas pelo Mês do seu Vencimento.**
Esta é a fórmula para descobrir em que mês uma fatura será paga:
- Se `dia_pagamento <= dia_fechamento` (Ex: Fecha dia 28, Paga dia 7): O sistema entende que o vencimento "pula" a virada do calendário. Uma fatura fechada no ciclo de Março vai vencer em Abril.
- Se `dia_pagamento > dia_fechamento` (Ex: Fecha dia 10, Paga dia 25): O sistema entende que a fatura fechada num mês é paga dentro daquele próprio mês.

**O `mes_referencia` salvo no banco sempre reflete o `YYYY-MM` da Data de Vencimento.**

---

## 2. Automação no Banco de Dados (PostgreSQL)

O coração deste módulo reside na função de Trigger `fn_vincular_lancamento_fatura`, operando invisivelmente sobre a tabela `lancamentos`.

### 2.1 A Função de Auto-Vinculação (`fn_vincular_lancamento_fatura`)
Sempre que um lançamento é criado ou a sua data é modificada, a Trigger aciona as seguintes defesas:
1. **O Filtro de Injeção Manual:** Se a transação já vier intencionalmente atrelada a uma Fatura Específica (ex: a IA anexando dados de um extrato PFD a uma fatura explicitamente clicada), a trigger não interfere.
2. **O Self-Healing de Update:** Se o usuário entrar no sistema e trocar a Data de uma compra, a trigger detecta que a data mudou, desfaz a vinculação anterior e empurra o lançamento para a fatura correta automaticamente.
3. **The Fatura Fetcher (Auto-Criação):** Se a fatura exigida matematicamente pela compra ainda não existir (ex: gastar no cartão com 3 anos de antecedência), a trigger criará silenciosamente um registro novo na tabela `faturas_cartao` preenchendo a exata `data_fechamento` e `data_vencimento`.

### 2.2 Tabelas Mapeadas
Para realizar intervenções nestes módulos, manipule ou acesse estritamente:
- `contas_financeiras`: Dicionário mestre. Se não houver `dia_fechamento_fatura`, todo o ciclo será abortado.
- `faturas_cartao`: Tabela virtual que agrupa dezenas de `lancamentos`. Possui um identificador vital único restrito a `(conta_id, mes_referencia)`.
- `lancamentos`: Recebe o `fatura_id` da Trigger e possui os dados absolutos das transações. (No SQL usar a variável `NEW.conta_id`).

---

## 3. Arquivos Front-End Core (Next.js)

Se for necessário mexer na interface e reconciliação dos cartões, os principais arquivos que tocam as apis do módulo são:

- `c:\Projetos\studio57so-v8\components\financeiro\ExtratoCartaoManager.js`: Local onde o botão de Importar Extratos PDF ("Anexar PDF") reside para cada Fatura independente.
- `c:\Projetos\studio57so-v8\components\financeiro\PanelConciliacaoCartao.js`: Lógica visual que lista os componentes amarrados e o totalizador.
- `c:\Projetos\studio57so-v8\components\financeiro\PagamentoFaturaModal.js`: Responsável por gerar os dois lançamentos gêmeos (Saída da Conta Corrente -> Entrada no Cartão) no momento de pagamento manual.
- `c:\Projetos\studio57so-v8\app\api\cartoes\extrair-fatura\route.js`: A Rota do Agent Gemini que estripa PDFs bancários e espelha os registros criando-os com Injeção Manual via Payload (implantando explicitamente o `fatura_id` focado).

---

## 4. Notas de Troubleshooting Observadas (Casos de Estudo do Passado)

* **O Bug da Conta de Origem:** Na gênese do sistema (Abril/2026), o código operava com variáveis apagadas (`conta_origem_id`) e falhava de forma silenciosa para faturas novas. Corrigido com migração definitiva para usar `conta_id` unificado.
* **O Lançamento Preso (Limbo):** O sistema se recusava a re-calcular lançamentos cuja Data foi editada pelo usuário porque a Fatura inicial travava a Trigger (`IF NEW.fatura_id IS NOT NULL`). A resolução atualizada utiliza a escuta comparativa do banco: `IF NEW.fatura_id IS DISTINCT FROM OLD.fatura_id` permitindo o "Pulo Automático" de Mês para as Compras Adulteradas no Frontend.
* **Pagamentos Caindo Fora da Fatura Certa:** Exclusiva a lógica de "Exceção Temporal" foi descartada a favor de purificar a Matemática Real. Todos os pagamentos que caem em até 1 dia do Mês seguinte (até antes ou mesmo no dia do Fechamento) automaticamente entrarão na data de Vencimento do Mês Seguinte à Transação, em alinhamento perfeito com extratos (SICOOB / ITAÚ).

---

### Controle de Versão e Registros de Evolução
*Sempre que alterar o comportamento da IA importadora ou a Trigger de faturas, deixe um registro de evolução abaixo.*

- **[10/04/2026]** :: Escrito por: *IA Devonildo* | Evolução: "Implementada Auditoria Global nas Triggers. O método de Extração de PDFs foi encapsulado sob Lote Manual (Por Fatura Específica) ao invés do sistema de orfandade em massa que duplicava registros soltos."
