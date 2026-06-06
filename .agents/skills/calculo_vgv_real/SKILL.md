---
name: Operar Cálculo de VGV Real (Segurança e Auditoria)
description: Ensina a IA a processar e exibir corretamente o Valor Geral de Vendas (VGV) de um Empreendimento, garantindo sigilo contratual para Corretores e exatidão financeira para a Diretoria.
---

# ⚙️ Manual de Operação Autônoma: Cálculo de VGV Real

## 1. Banco de Dados e Parâmetros Base
- **Tabelas Relacionais Envolvidas:** 
  1. `produtos_empreendimento` (Onde reside o estoque com os valores estritos e nominais de tabela).
  2. `contratos` (Onde residem os valores finais e trancafiados de contratos já assinados).
  3. `contrato_produtos` (Tabela-ponte vital para cruzar quais unidades pertencem a quais vendas).

## 2. A "Regra de Prata" (Limites Visuais)
- **Tabela Comercial (Área de Corretores / Vitrine):** 
  - EM HIPÓTESE ALGUMA o corretor pode visualizar ou ter listado sob o pano o `valor_final_venda` dos contratos assinados. 
  - Toda listagem de "Tabela de Vendas" deve carregar exclusivamentela e cegamente os dados da tabela `produtos_empreendimento`. O valor visto de qualquer unidade (vendida ou disponível) é SOMENTE seu valor de prateleira base. NUNCA misture query de `contratos` aqui.
- **Relatório Gerencial (Dashboard da Diretoria):** 
  - Aqui o VGV absoluto impera. O cálculo dinâmico une a realidade do mercado atual e as dívidas garantidas de clientes no passado.
  - VGV Possível Total = (Valor de Tabela de Unidades *Ainda Disponíveis/Não Vendidas*) + (`valor_final_venda` dos *Contratos Assinados* referentes às vendidas).

## 3. Padrão Ouro de Cálculo Analítico (Dashboard Executivo)
Sempre que chamado para criar um painel gerencial de VGV, utilize este agrupamento tático no Frontend/Backend:

```javascript
// Exemplo lógico Padrão Ouro
// Fontes vindas de consultas simples
const produtosVinculados = produtos.filter(p => p.empreendimento_id === emp.id);
const contratosAssinados = contratos.filter(c => c.empreendimento_id === emp.id && c.status_contrato === 'Assinado');

// PARTE A) ESTOQUE DE PRATELEIRA VIGENTE
// Apenas soma o que AINDA DEPENDE de negociação para compor o fluxo.
const valorEstoqueListado = produtosVinculados.reduce((sum, p) => {
    if (p.status !== 'Vendido' && p.status !== 'Permuta') {
        return sum + (Number(p.valor_venda_calculado) || 0);
    }
    return sum;
}, 0);

// PARTE B) VGV ASSEGURADO HISTÓRICO
// Blinda a contabilidade: não importa se o apartamento foi vendido ano passado e hoje
// vale mais na plataforma, o VGV garantido deste foi fixado na assinatura do contrato.
// E por somar diretamente da "contratos", evitamos duplicidade se houverem 2 unidades (ex: garagem + casa) no mesmo contrato.
const valorContratadoBlindado = contratosAssinados.reduce((sum, c) => sum + (Number(c.valor_final_venda) || 0), 0);

// RESULTADO FINAL - VGV REAL DO EMPREENDIMENTO
const vgvTotal = valorEstoqueListado + valorContratadoBlindado;
```
