---
description: Guia definitivo e passo-a-passo para a IA investigar, fatiar e conciliar Lotes de Antecipação de Recebíveis do Sicoob de forma cirúrgica na Conta 33.
---

# 🕵️ Workflow de Auditoria Sicoob (Antecipação de Recebíveis)

Sempre que o usuário pedir para **Auditar, Fechar ou Conciliar um Lote de Antecipação de Recebíveis do Sicoob**, a IA deve seguir restritamente este protocolo para garantir fechamentos matemáticos na casa dos centavos e a correta atribuição contábil na **Conta 33**.

---

## 🧭 1. Entendimento do Borderô Mestre
Todo lote Sicoob tem um Borderô base Mestre (em PDF ou `.txt` exportado no diretório `TXT_EXTRAIDOS`).
- Extraia do borderô o **Valor Bruto Total** (a ser cravado).
- Liste as **Vítimas (Boletos Antecipados)** com `Nome`, `Vencimento` e `Valor de Face`.
- Consiga com o usuário o `transferencia_id` (a despesa raiz da taxa/antecipação no BD do Studio57) que representará o grupo (Campo: `antecipacao_grupo_id`).

---

## 🔍 2. A Caça aos "Fantasmas" (Busca Flexível)
Nunca tente buscar um boleto usando exatamente `.eq('valor', 4495.12)` ou `.eq('data_vencimento', '2026-03-20')`. Use **sempre range flexível** nas suas queries, senão boletos parecerão "perdidos" (Fantasmas):

1. **Dízimas Periódicas (INCC/Juros):** Durante o percurso, o Studio 57 pode ter corrigido a parcela (ex: de `4495.12` virar `4495.1172222...`). 
   - **Tática**: Use `gte(valor - 2)` e `lte(valor + 2)`. Identifique o boleto e anote para reverter/assentar o valor cravado do Borderô no final.
2. **Dias Derrapados (Finais de Semana):** O vencimento do BD pode divergir do Sicoob em 1 ou 2 dias por conta de sábados/domingos. 
   - **Tática**: Ordene por data de vencimento e procure um `diff` no range de 5 dias do mesmo valor para o contanto aproximado.
3. **Contratos Conjuntos (Fatiamento de Cota Gorda):** Se o Sicoob pagou `14.380` da "Angela", mas a busca só retorna valores de `28.760` no mês para aquele contrato...
   - **Tática**: Significa que o apartamento tem múltiplos donos (Ex: Angela e Alessandra). O Sicoob comprou só a metade da Angela! O boleto no sistema terá que ser **Fatiado**.

---

## 🔪 3. Execução Círugica (O Patch Node.js)
Após encontrar os registros, a IA deve escrever um script pontual (`patch_lote_DDMM.mjs`) que aplique as regras financeiras:

1. **Reversão Cúbica:** Qualquer boleto vítima de dízima ou diferença de centavos, deve sofrer um `.update({ valor: VALOR_CRAVADO_BORDEO })`. Do contrário, a Conta 33 nunca baterá na vírgula final.
2. **O Fatiamento (Caso ocorra Boletos Conjuntos):**
   - Busque a Parcela Gorda Mestre (`ex: 28.760`).
   - Clone as propriedades para uma const `novaParcela`. Remova `id` e `created_at`.
   - Atualize `novaParcela.valor` para a metade remanescente (`14.380`) e relacione ao `contato_id` do segundo comprador (no passivo). Faça o `.insert()`.
   - Pegue o boleto original e `.update()` o seu valor para a cota comprada do mês (`14.380`).

---

## 🔒 4. O Selo de Ouro (Conta 33 e Categoria 351)
Para todos os boletos do grupo, deve-se assinar e mover os fundos (no mass `.update()`):

```javascript
// Exemplo de atualização de todos os boletos validados da Antecipação
await supabase.from('lancamentos').update({ 
    conta_id: 33, // CAIXA FORTE: Conta Antecipações Sicoob Crediriodoce
    categoria_id: 351, // CATEGORIA BI: Antecipação de Recebíveis
    antecipacao_grupo_id: 'UUID_DA_TRANSFERENCIA_MASTER',
    conciliado: false, // Deixar false para fluir no DRE e não se cruzar com pagamentos padrão
    data_pagamento: null // Boleto de antecipação ainda existe pro cliente pagar, não está pago!
}).in('id', arrayDosBoletosAuditos);
```
> **Não esqueça**: A `Transferência Mestre` (A despesa gigantesca que puxou o dinheiro ou fez as taxas e que forneceu o `antecipacao_grupo_id`), TAMBÉM deve forçadamente ser atualizada para `categoria_id: 351`. 

---

## ✅ 5. Prova Real (Check Final de Matemática)
Ao final do seu Patch script Node.js, inclua um redutor que cruza a soma:

```javascript
const { data: auditoria } = await supabase.from('lancamentos')
    .select('valor')
    .eq('antecipacao_grupo_id', 'UUID_DA_TRANSFERENCIA_MASTER');

const somaReal = auditoria.reduce((acc, cr) => acc + Number(cr.valor), 0);

if (Math.abs(somaReal - VALOR_BRUTO_BORDERÔ) < 0.05) {
   console.log("🏆 MATEMÁTICA BATEU NA VÍRGULA!");
} else {
   console.log("⚠️ ATENÇÃO: Discrepância de Centavos/Verificar IDs não linkados!");
}
```

Nenhum lote deve ser dado como **RESOLVIDO** ou **🟢 VERDE** se a prova real final apresentar *Discrepância* diferente de `Zero/R$ 0,00`.
