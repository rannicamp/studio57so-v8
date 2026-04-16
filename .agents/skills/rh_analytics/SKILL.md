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
  1. **Relacionamento Crucial:** Dados de classificação sempre vêm do join `abono_tipos(descricao)`, referenciando `tipo_abono_id`.
  2. **Filtro da Diretoria:** Diretores ou sócios sem `jornada_id` (Carga Horária) e funcionários desligados (`demission_date` < mês atual) **jamais** entram no total da operação, nas métricas de Absenteísmo ou de Custo (Massa Salarial). Eles causam ruído financeiro.
  3. **Atestados Constínuos (INSS):** O sistema cadastra cada dia de atestado como um registro separado. Por exemplo, 30 dias de Atestado geram 30 linhas individuais de `Atestado Médico` daquele funcionário por competência.

## 2. Padrão Ouro de Extração (Node.js)
Caso você (IA) seja solicitada a investigar algum vazamento de custo da folha ou gerar relatório raw customizado do RH, aplique o *sandbox* autônomo abaixo via script rápido (`run_command` do seu kernel):

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
  
  // Exemplo de Ranking Auditado
  const atestadosMap = {};
  abonos.forEach(ab => {
      // REGRA DE OURO: Ignorar quem não tem jornada validada (Ex: Sócios e Diretores)
      if (!ab.funcionarios?.jornada_id) return;
      
      const tipo = ab.abono_tipos?.descricao || 'Não Classificado';
      const nome = ab.funcionarios?.full_name || 'Desconhecido';
      
      if (!atestadosMap[tipo]) atestadosMap[tipo] = {};
      atestadosMap[tipo][nome] = (atestadosMap[tipo][nome] || 0) + 1;
  });

  console.log("Auditoria de Risco Mensal (Abonos Válidos da Operação):");
  console.dir(atestadosMap, { depth: null });
}

investigarAbonos();
```
