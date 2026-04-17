---
name: Operar Gestão e Análise de Empreendimentos
description: Ensina a IA a mapear estruturalmente Empreendimentos (Loteamentos x Verticais), aplicar Rateio Pró-rata de VGV em Combo de Brindes e calcular o VSO Físico de estoque cruzado.
---

# ⚙️ Manual de Operação Autônoma: Gestão de Empreendimentos e Obras

## 1. Banco de Dados e Parâmetros Base
- **Tabela Relacional Primária:** `empreendimentos` (Colunas vitais: `id`, `nome`, `listado_para_venda`, `categoria` sendo "Horizontal" ou "Vertical").
- **Tabelas de Engrenagem (Relacionais):** `produtos_empreendimento` (a prateleira física), `contratos` (a força financeira blindada), `contrato_produtos` (a ponte pivot que amarra N produtos a um único contrato financeiro).
- **RPCs Acopladas:** `get_corporate_entities` (Identifica as engrenagens de Matrizes do tenant atual).
- **Risco Zero Multitenancy:** Onde quer que se injete uma query, a filtragem rigorosa `.eq('organizacao_id', user.organizacao_id)` é inquebrável, exceto nas raras entidades Globais Nulladas que pertencem ao Elo 1.

## 2. Padrão Ouro Analítico (As Armadilhas e as Soluções)

### Rateio Proporcional de VGV (A Pegadinha do "Brinde")
Quando a cláusula liga 1 contrato a N unidades (ex: unidade + garagem gratuita), NUNCA jogue o valor inteiro à garagem. Você deve somar a Base de Tabela (`valor_venda_calculado`) do combo e destinar a fração da porcentagem ao Preço de Faturamento (`valor_final_venda`). A garagem que valia 0 na tabela recebe 0% e vale feliz 0 no painel.

### Separação Estrutural de Ticket Médio (R$/m²)
Lotes (Terrenos crus) têm seu ticket médio esmagado perto de Unidades Residenciais Construídas. Para painéis, **sempre separe KPI Horizontal KPI versus Vertical KPI**. Misturá-los é viciar matematicamente o relatório executivo.

### O Medidor Físico (VSO)
VSO para fotografia executiva (Snapshot) é cruel e não requer tempo.
Fórmula: `((Quantidade de Produtos Trancafiados em 'Assinado' ou com Status 'Vendido' / Quantidade Total Global Físico) * 100)`.
