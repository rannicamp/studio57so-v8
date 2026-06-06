---
name: Operar Analytics de RH (Absenteísmo, Abonos e Falta)
description: Ensina a IA a buscar, interpretar e extrair relatórios gerenciais de Recursos Humanos vinculados ao controle de operações e frequência dos funcionários.
---

# ⚙️ Manual de Operação Autônoma: Analytics de RH

## 1. Banco de Dados e Parâmetros Base
- **Tabelas Relacionais:**
  - `abonos`: Guarda todas as faltas, atrasos e saídas justificadas/compensadas diariamente.
  - `abono_tipos`: Dicionário dos Tipos (ex: Atestado Médico, Compensação de Horas).
  - `funcionarios`: Lista do pessoal (para checar vinculo, `jornada_id` e demissões).
- **Regras de Extração e Multitenancy (Pegadinhas):**
  1. **Relacionamento Crucial:** Dados de classificação sempre vêm do join `abono_tipos(descricao)`, referenciando a coluna `tipo_abono_id` (Cuidado: Jamais tente usar `tipo_id` no banco).
  2. **Filtro da Diretoria:** Diretores ou sócios sem `jornada_id` (Carga Horária) e funcionários desligados (`demission_date` < mês atual) **jamais** entram no total da operação, nas métricas de Absenteísmo ou de Custo (Massa Salarial). Eles causam ruído financeiro.
  3. **Atestados Constínuos (INSS):** O sistema cadastra cada dia de atestado como um registro separado. Por exemplo, 30 dias de Atestado geram 30 linhas individuais de `Atestado Médico` daquele funcionário por competência.

## 2. Visão Histórica e Tendências Anuais (Micro-RPCs)
Sempre que a interface precisar consolidar dados ao longo de 12 meses (Ex: Gráficos de barra empilhada, linhas de absenteísmo contínuo, giro de funcionários), **jamais faça o processamento no Frontend com map/reduce**. O Studio 57 utiliza **Micro-RPCs** PostgreSQL nativas para absorver essa carga, retornando JSONs prontos para o Recharts.

**RPCs Oficiais de RH:**
1. `get_rh_tendencia_turnover`: Calcula Média Mensal de Mão de Obra e Movimentações (Entraram/Saíram). **Atenção (Postgres):** Utilize `NULLIF(data_demissao, '')::date` para evitar crashes de string format ao validar demissões vazias.
2. `get_rh_tendencia_absenteismo`: Cruza (Média de Funcionários Ativos * 22 dias úteis médios mensais) e subtrai as entradas de falta da tabela `abonos`.
3. `get_rh_tendencia_abonos`: Monta o *Stacked Bar* agrupando Ocorrências X Meses do ano. 

**🔴 HOTFIX OBRIGATÓRIO EM GRÁFICOS STACKED (Recharts):**
Ao utilizar o retorno de uma RPC para desenhar abonos agrupados (`<Bar dataKey="Atestado..." stackId="a" />`), se o Supabase não retornar **nenhum registro** em todo o ano pesquisado (Resultando em Array flat completamente limpo de chaves customizadas), o *Recharts* se autodestrói visualmente e esconde os Eixos X e Y. 
**A solução oficial Front-end é sempre forçar a injeção:**
```javascript
  if (allAbonoTipos.size === 0) {
      allAbonoTipos.add('Nenhum Registro'); // Força eixos a aparecerem na legenda
  }
  // No flatmap, garanta que todo objeto de mês possua 'Nenhum Registro': 0
```

## 3. Padrão Ouro de Extração Raw (Node.js)
Caso você (IA) precise auditar um mês específico para encontrar "vazios financeiros" no fechamento do caixa da operação, use o modelo abaixo via kernel:

```javascript
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function investigarAbonos() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Pegando a competência inteira referenciada com Left Join
  const { data: abonos, error } = await supabase
    .from('abonos')
    .select('*, abono_tipos(descricao), funcionarios(full_name, jornada_id, organizacao_id)')
    .gte('data_abono', '2026-04-01')
    .lte('data_abono', '2026-04-30');

  if (error) { console.error("Falha na Extração", error); return; }
  
  const atestadosMap = {};
  abonos.forEach(ab => {
      // IGNORAR quem não tem jornada validada (Ex: Sócios)
      if (!ab.funcionarios?.jornada_id) return;
      
      const tipo = ab.abono_tipos?.descricao || 'Não Classificado';
      const nome = ab.funcionarios?.full_name || 'Desconhecido';
      
      if (!atestadosMap[tipo]) atestadosMap[tipo] = {};
      atestadosMap[tipo][nome] = (atestadosMap[tipo][nome] || 0) + 1;
  });

  console.dir(atestadosMap, { depth: null });
}
investigarAbonos();
```
