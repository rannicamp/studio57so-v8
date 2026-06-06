---
description: Guia definitivo e passo-a-passo para a IA investigar e conciliar Lotes de Antecipação (Sicoob) e auditar Faturas de Cartões de Crédito (Cachoeira).
---

# 🕵️ Workflow de Auditoria Financeira do Studio 57

Sempre que o usuário pedir para **Auditar, Fechar ou Conciliar** questões financeiras severas (Lotes de Antecipação ou Status de Faturas de Cartão), a IA deve seguir restritamente este protocolo para garantir a matemática cega contra erros de preenchimento humano.

---

## 🧠 0. Ponto de Partida Obrigatório (Memória Financeira da IA)
⚠️ **REGRA ZERO:** Antes de iniciar qualquer análise, varredura ou operação financeira complexa do Studio 57, a IA DEVE obrigatoriamente resgatar e revisar a grande conversa de fundação financeira.
- **ID Obrigatório da Conversa:** `39938ccc-f495-4960-88da-52a37cb7b449`
- Nesta conversa residem os conhecimentos sobre: paginação severa de contas volumosas, truncamento de dízimas periódicas (`NUMERIC(15,2)`), margens dinâmicas de 15 dias no filtro OFX e a busca textual no painel dual.

---
## 💳 PARTE 1: Auditoria de Cartões de Crédito ("A Cachoeira")

As faturas de cartão no Studio 57 possuem cálculo dinâmico "à prova de erros humanos" conhecido como a **Cachoeira de Dívida Retroativa (LIFO)**.

⚠️ **Problema Clássico:** O usuário reporta: *"A fatura de Março está PAGA, mas eu não fiz nenhum pagamento nela! E a de Abril, onde o pagamento caiu, consta em ABERTO!"*

### 1. Como a IA deve diagnosticar o LIFO:
1. Nunca confie na associação física (`fatura_id`). O usuário pode (e vai) colar um recibo de pagamento na fatura errada.
2. A IA deve rodar um script de auditoria que:
   - Some **TUDO o que foi gasto (Despesas)** no cartão desde o início dos tempos (Global).
   - Some **TUDO o que foi pago (Receitas de Pagamento de Fatura, Cat. 370)** desde o início dos tempos.
   - Calcule a **Dívida Remanescente Global**.
3. Aplique a "Cachoeira" andando de trás para frente (do futuro para o passado):
   - Pegue a Dívida Global e subtraia os gastos da fatura mais recente. Se a dívida sumir (zerar no meio da fatura atual), todas as faturas anteriores serão matematicamente **100% DECLARADAS PAGAS**, indiferente de onde o usuário vinculou o pagamento físico.

### 2. Tratativa com o Usuário
- Se o cálculo LIFO estiver perfeito, a lógica do sistema está correta. A IA deve educar o usuário de que o *status verde de Pago* reflete o saldo real.
- Caso o usuário exija alinhamento visual, oriente-o a modificar o campo `fatura_id` ou Data de Vencimento do lançamento físico para a fatura correta (ex: empurrar o pagamento de 09/03 para a fatura de Abril). 

---

## 🧾 PARTE 2: Antecipação de Recebíveis (Lotes Sicoob)

### 1. A Fonte da Verdade (Os Borderôs Originais)
⚠️ **REGRA DE OURO:** A **ÚNICA** fonte da verdade são os arquivos de borderô físicos extraídos no sistema (em `TXT_EXTRAIDOS/`).
- Se um Lote "aparecer" mas você não encontrar o `.txt` dele, o Lote é uma **Alucinação** e deve ser ignorado.
- Extraia do borderô o **Valor Bruto Total** (a soma exata que deve bater).

### 2. A Caça aos "Fantasmas" (Busca Larga e Matemática)
Nunca tente buscar um boleto usando matching exato como `.eq('valor', 4495.12)`.
1. **A Sujeita Decimal:** Dízimas periódicas podem truncar. Busque com margem: `.gte('valor', alvo - 2).lte('valor', alvo + 2)`.
2. **O Cliente Invisível:** Descrições vazias (`""`). Cruze a Data (Mês) e o Valor.
3. **Lotes Gêmeos:** Sicoob adianta 2 borderôs gêmeos em dias seguidos. Cuidado para não cruzar dados.
4. **Fatiamento Gêmeo:** Boleto de `28.760` no BD e `14.380` no Sicoob = 2 compradores. Clone a parcela (`insert`).

### 3. Tratamento de Atrasos e Débitos
1. **Conta 33:** É uma Carteira. Todo trâmite é um jogo pareado de Despesa/Receita (Categoria 351).
2. **Reposição do Lote:** Crie Receita na Conta 33 no exato valor do borderô (Débito por Atraso - Parcela X).
3. **Respeito ao Saldo do Terceiro:** Se o cliente pagou com Juros na Conta 31, crie um novo registro de `Juros e Multa` atrelando a um `agrupamento_id` comum.

### 4. A Matriz de Atualização (O Patch Node.js)
1. **Purificação Decimal:** Forçar `.update({ valor: MATH_EXACT })` (cortar dízimas flutuantes longas).
2. **Armadilhas de OFX:** Crie uma Receita Mestra (`conciliado: false`) com a chave correta. Quando o usuário enviar o Extrato, a conciliação dará Match perfeito!

### 5. Prova Real Final
Ao final do seu Patch, valide sempre cruzando a soma limpa:
O script só é vitorioso se: `Math.abs(somaReal - VALOR_BRUTO_BORDERÔ) < 0.05`.
Se falhar, NUNCA declare como resolvido. A matemática dos centavos deve reinar.
