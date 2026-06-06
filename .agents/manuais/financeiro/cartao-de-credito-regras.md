# Cartão de Crédito - Regras de Relacionamento (Engine)

## 📌 Contexto Técnico (O Bug Histórico)
Historicamente no Studio 57, sofremos com um loop de referências não atualizadas das "Faturas de Cartão". Toda vez que um lançamento ligado a um Cartão de Crédito ("fatura_id") tem a sua `data_vencimento` editada pelo usuário ou alterada em massa (ex: Jogar Parcela pra Próximo Mês), a Data de Vencimento de fato era alterada no Banco de Dados.

Entretanto, se a Foreign Key (`fatura_id`) não for recriada/alterada para apontar para a fatura do novo mês respectivo, **o item permanecia invisível no mês que foi jogado** ou aparecia de forma persistente e amarrada na visualização da fatura antiga cujas datas já não condiziam.

## ⚙️ Regra Suprema Padrão Ouro

1. **Trigger Base `fn_vincular_lancamento_fatura`**: 
   No momento em que `INSERT` ou `UPDATE` ocorre nas tabelas de lançamento, essa trigger apenas fará mágica SE `fatura_id` entrar nulo e for realmente um "Cartão". A trigger é "burra" e calcula de acordo com **`data_transacao`**.
   Ou seja, em casos de **edição avulsa do Vencimento**, você não pode depender apenas de dar um "Update To Null". 

2. **Como Resolver o Vínculo Perfeitamente**:
   Toda edição de frontend ou backend que visa MUDAR a competência do Lançamento de Cartão de Crédito precisa forçosamente:
   a) Determinar a `data_vencimento` (Ex: "2026-06-15").
   b) Formatar o `mes_referencia` com o formato `YYYY-MM` (Ex: "2026-06").
   c) Executar um **SELECT (ou UPSERT)** localizando a `id` da `faturas_cartao` onde `conta_id` é o mesmo e `mes_referencia` confere.
   d) Finalmente preencher e aplicar explicitamente o UPDATE na tabela principal alterando as colunas `data_vencimento = novo_vencimento` e `fatura_id = nova_fatura_id`.

3. **Arquitetura (RPC via Supabase)**:
   A partir da resolução do Ticket 115, criamos sempre funções inteligentes no lado Servidor (ex: `reatribuir_lancamento_vencimento_cartao`) onde fazemos esse swap atômico, eliminando a responsabilidade do React de recalcular ciclos de fatura.

---
**NOTA DE AGENTES**: Sempre que você gerar Scripts de correção para atrasos de vencimentos, lembre-se desta regra. Alterou Vencimento = Alterou Fatura ID. Evite scripts complexos, use as RPCs designadas ou garanta a busca da mesma de forma programática.
