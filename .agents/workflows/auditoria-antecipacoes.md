---
description: Guia definitivo e passo-a-passo para a IA investigar, fatiar e conciliar Lotes de Antecipação de Recebíveis do Sicoob de forma cirúrgica na Conta 33.
---

# 🕵️ Workflow de Auditoria Sicoob (Antecipação de Recebíveis)

Sempre que o usuário pedir para **Auditar, Fechar ou Conciliar um Lote de Antecipação de Recebíveis do Sicoob**, a IA deve seguir restritamente este protocolo para garantir fechamentos matemáticos na casa dos centavos e a correta atribuição contábil na **Conta 33**.

---

## 🧭 1. A Fonte da Verdade (Os Borderôs Originais)
⚠️ **REGRA DE OURO:** NUNCA confie cegamente em tabelas markdown, relatórios de IA anteriores ou planilhas de pendências. A **ÚNICA** fonte da verdade são os arquivos de borderô físicos extraídos no sistema (geralmente localizados em `TXT_EXTRAIDOS/`).
- Se um Lote "aparecer" na lista de pendências mas você não encontrar o `.txt` dele, o Lote é uma **Alucinação** e deve ser ignorado.
- Extraia do borderô o **Valor Bruto Total** (a soma exata que deve bater).
- Liste as **Vítimas (Boletos Antecipados)** com `Nome`, `Vencimento` e `Valor de Face`.

---

## 🔍 2. A Caça aos "Fantasmas" (Busca Larga e Matemática)
Nunca tente buscar um boleto usando matching exato como `.eq('valor', 4495.12)` ou `.ilike('descricao', '%Nome%')`. O banco de dados do Studio 57 possui fantasmas gerados por fatores migratórios silenciosos:

1. **A Sujeita Decimal (Dízimas Periódicas):** Devido ao recálculo do INCC e divisões de parcelas, valores como `4333.33` no borderô muitas vezes estão gravados no Supabase como floats flutuantes (`4333.333333333333`). 
   - **Tática**: Use ALVOS MATEMÁTICOS. Busque com margem de segurança: `.gte('valor', alvo - 2).lte('valor', alvo + 2)`.
2. **O Cliente Invisível (Boletos Sem Nome):** Em muitos casos antigos, a coluna descricao/nome do cliente ficou totalmente vazia (`""`). Buscar por `.ilike('descricao', '%Marcelo%')` falhará miseravelmente. O único farol é o cruzamento da Data (Mês) e o Valor Aproximado.
3. **Lotes Gêmeos (Coincidências Perigosas):** O Sicoob pode ter dois borderôs em dias quase consecutivos (ex: 04/03 e 06/03) contendo os **mesmos clientes** e exato **mesmo valor contábil** (ex: R$ 30.688,02), apenas adiantando meses consecutivos (Agosto e logo após Setembro). Não caia no erro de somar os dois lotes achando que é um "rombo" de R$ 60 Mil. Trate-os estritamente de acordo com a Data de Vencimento do mês em questão.
4. **Fatiamento Gêmeo (Boletos Conjuntos):** Se o Sicoob antecipou `14.380` da "Angela", mas no BD a parcela está `28.760`, significa que o apartamento tem 2 compradores. Clone a parcela (`insert`), divida o valor ao meio e vincule aos seus devidos `contato_id`.

---

## 🧩 3. Tratamento de Atrasos e Débitos do Sicoob (A Roda de Cura)
Quando um boleto antecipado **não é pago na data pelo cliente**, o Sicoob executa o débito automático (D+3) direto na **Conta Corrente** do Studio. Dias depois, o cliente paga atrasado com *Juros e Multa* na Conta Corrente.

1. **Conta 33 é uma Carteira (Wallet):** Não a trate com funções de "Transferência Financeira" nativas pra debito. Todo trâmite é um jogo pareado de Despesa/Receita (Categoria 351).
2. **Caçando o Débito:** Procure na **Conta Corrente (31)** a Despesa correspondente.
3. **Reposição do Lote (A Compensação):**
   - Crie uma **Receita** na **Conta 33** no exato valor do borderô, com descrição `Débito por Atraso - Parcela X`. Associe o mesmo `antecipacao_grupo_id`.
4. **Respeito ao Saldo Devedor do Terceiro (Cisão de Juros):**
   - O cliente pagou com juros na Conta Corrente. Reverta esse lançamento para o **Valor Base Original**.
   - Crie um novo registro de `Juros e Multa -` contendo a diferença monetária do ágio. Faça o `.insert()` atrelando a um `agrupamento_id` comum (para agrupar visualmente no extrato).

---

## 🔪 4. A Matriz de Atualização (O Patch Node.js)
Após rastrear todos os responsáveis do Lote, o script cirúrgico final deve sempre seguir essas leis imutáveis:

1. **Purificação Decimal:** TODO boleto inserido num lote DEVE sofrer `.update({ valor: MATH_EXACT })` forçando o arredondamento (ex: de `4333.333333` para `4333.33`).
2. **O Grande Movimento:** Atualizar `conta_id: 33` (Carteira Antecipações), `categoria_id: 351` e injetar o `antecipacao_grupo_id` (a UUID Mestra do Lote).
3. **Armadilhas de OFX (Criação de Mestres de Lastro):**
   - Se os boletos existirem, mas o Lote é muito recente e a Transação "Mestre" do Sicoob ainda não caiu no Extrato OFX (Conta Corrente), a IA **deve pré-criar a Transferência Mestra**.
   - **Mestre Perfeito:** `.insert({ tipo: 'Receita', valor: TOTAL_LOTE, descricao: 'TRANSFERÊNCIA - SICOOB (LOTE XX/YY) [Mestre IA]', conta_id: 31, categoria_id: 351, antecipacao_grupo_id: UUID, transferencia_id: UUID, conciliado: false })`
   - Essa "Armadilha" aguardará placidamente. Quando o usuário realizar o upload do arquivo base do banco real (OFX), o Studio 57 dará *Match Perfeitamente* com a nossa linha sem criar duplicidade, blindando o fluxo!

---

## ✅ 5. Prova Real Final
Ao final do seu Patch, o script SEMPRE deve validar o agrupamento cruzando a soma limpa:

```javascript
const { data: auditoria } = await supabase.from('lancamentos')
    .select('valor')
    .eq('antecipacao_grupo_id', 'UUID_DA_TRANSFERENCIA_MASTER');

const somaReal = auditoria.reduce((acc, cr) => acc + Number(cr.valor), 0);

if (Math.abs(somaReal - VALOR_BRUTO_BORDERÔ) < 0.05) {
   console.log("🏆 MATEMÁTICA BATEU NA VÍRGULA!");
} else {
   console.error(`⚠️ ATENÇÃO: Discrepância Fatal! Esperado: ${VALOR_BRUTO_BORDERÔ} | Recebido: ${somaReal}`);
   // ABORTAR OU REVERTAR OPERAÇÃO
}
```
Se a Prova Real falhar, o Lote NUNCA deve ser dado como **🟢 RESOLVIDO**. 
A matemática dos centavos deve reinar.
