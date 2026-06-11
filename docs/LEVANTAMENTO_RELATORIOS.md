# 📊 Manual Supremo de Relatórios e Inteligência de Dados — Elo 57

Olá, seu lindo! Aqui é o seu mentor, Devonildo. Preparei este mapa completo e detalhado de tudo o que rege a inteligência de dados, relatórios e KPIs do nosso sistema **Elo 57** (desenvolvido no laboratório do **Studio 57**).

Fiz uma varredura profunda no nosso banco de dados, nas nossas rotas, nos hooks e nas regras de negócio para explicar exatamente como cada engrenagem se move, desde a origem dos cliques de marketing até o fechamento financeiro e de folha de pagamento.

---

## 🏛️ 1. O Coração da Consistência: O "Porteiro Único" (`financeiro_montar_where`)

Quando filtramos uma data, categoria ou obra no financeiro, o resultado precisa ser rigorosamente idêntico na listagem de lançamentos, nos gráficos de pizza, na DRE e nos KPIs do topo da tela. 

Para evitar que filtros fiquem diferentes entre as telas, o sistema utiliza uma função SQL centralizadora no Postgres chamada `financeiro_montar_where`. Ela reside no arquivo de funções do Supabase e é chamada dinamicamente por outras RPCs:

*   **Arquivo de Definição**: [`functions.json` (Função: `financeiro_montar_where`)](file:///c:/Projetos/studio57so-v8/functions.json#L77)
*   **Hook Frontend**: [`useRelatorioFinanceiro.js`](file:///c:/Projetos/studio57so-v8/hooks/financeiro/useRelatorioFinanceiro.js)

### Como funciona:
O frontend envia um objeto JSON com os filtros selecionados pelo usuário (como data de início, data de fim, IDs de categorias, IDs de obras, etc.) para o banco. A função `financeiro_montar_where` interpreta esse JSON e escreve dinamicamente a cláusula `WHERE` do SQL.

> [!TIP]
> **A Regra de Competência vs. Caixa:**
> *   **Regime de Caixa:** Filtra pela data real em que o dinheiro se moveu: `(CASE WHEN l.data_pagamento IS NOT NULL THEN l.data_pagamento WHEN l.data_vencimento IS NOT NULL THEN l.data_vencimento ELSE l.data_transacao END)`.
> *   **Regime de Competência:** Filtra pela data em que o fato gerador ocorreu: `l.data_transacao`.

Essa função também aplica a **Lógica de Exclusão de Especiais**:
*   Ignora transferências entre contas (para não inflar artificialmente as receitas e despesas).
*   Ignora estornos e abatimentos quando solicitado.

---

## ⚖️ 2. A Lei dos Sinais: Trigger `formatar_sinal_lancamento`

No Elo 57, toda a matemática financeira do banco de dados funciona de forma algébrica pura. Isso significa que receitas entram somando e despesas entram subtraindo. Para garantir que nenhum erro humano grave no preenchimento de formulários ou na importação de faturas inverta esses sinais, o banco de dados possui uma trigger automática.

*   **Função do Postgres**: [`formatar_sinal_lancamento` no `functions.json`](file:///c:/Projetos/studio57so-v8/functions.json#L91)

### O Motor de Sinais:
```sql
BEGIN
    IF NEW.tipo IN ('Despesa', 'Passivo') THEN
        NEW.valor := -ABS(NEW.valor);
    ELSIF NEW.tipo IN ('Receita', 'Ativo') THEN
        NEW.valor := ABS(NEW.valor);
    END IF;
    RETURN NEW;
END;
```
Graças a esse gatilho, no banco de dados a despesa sempre transitará com o sinal **negativo (-)**. Isso permite que qualquer relatório faça um simples `SUM(valor)` para obter o saldo real líquido das contas, descontando os custos de forma natural.

---

## ⚡ 3. O Radar Studio (Tráfego & Comercial)

O módulo de **Radar** é composto por dois pilares: a telemetria de visitas e cliques de tráfego orgânico/pago, e a análise de agilidade de atendimento (SLA) do CRM conectada ao WhatsApp.

*   **Página Principal**: [`app/(main)/relatorios/radar/page.js`](file:///c:/Projetos/studio57so-v8/app/(main)/relatorios/radar/page.js)
*   **Actions no Servidor**: [`app/(main)/relatorios/radar/actions.js`](file:///c:/Projetos/studio57so-v8/app/(main)/relatorios/radar/actions.js)
*   **Hook de Vendas**: [`useRelatorioComercial.js`](file:///c:/Projetos/studio57so-v8/hooks/relatorios/useRelatorioComercial.js)

### Mapeamento Técnico de RPCs:

### A. Estatísticas de Tráfego (`get_radar_stats`)
Invocada no primeiro carregamento do painel. A RPC varre a tabela `monitor_visitas` (onde registramos os acessos de usuários ao site) e agrupa cliques por dispositivo (celular vs computador), top origens (campanhas do Instagram, Facebook, Google ou cliques diretos) e páginas mais acessadas do Studio.

### B. O Motor do CRM (`fn_relatorio_comercial`)
Esta RPC de alta complexidade compila toda a inteligência do nosso CRM e do tráfego integrado em um único payload JSONb contendo:
1.  **Total de Leads**: Contagem de contatos criados no período.
2.  **Distribuição Geográfica e Perfil**: Agrupa por país (+55 para Brasil, +1 para EUA) e segmenta por objetivo de compra (Investimento vs Moradia) cruzando com a faixa de renda informada pelo lead.
3.  **Funil de Vendas**: Calcula a taxa de conversão em cada etapa do funil (Entrada, Contato, Visita, Proposta, etc.) rastreando o histórico de movimentações na tabela `historico_movimentacao_funil`.
4.  **Cálculo de SLA (Ritmo de Conversa)**: Puxa o tempo médio de resposta da equipe comercial e o tempo médio de resposta do próprio lead através do cruzamento com a RPC `get_conversation_response_kpis`.
5.  **Performance de Modelos (WhatsApp Templates)**: Analisa o desempenho de cada template disparado (taxa de entrega, taxa de leitura e taxa de resposta).

### C. A Lupa de Conversação (`get_conversation_response_kpis`)
Esta função calcula a velocidade de resposta nas conversas de WhatsApp. Ela faz um loop temporal nas mensagens (`whatsapp_messages`) associadas a uma conversa, medindo a diferença de tempo (`EXTRACT(EPOCH FROM ...)`) sempre que a direção do fluxo muda:
*   De **Lead (Inbound)** para **Corretor (Outbound)**: Mede o tempo que o corretor levou para responder ao lead (SLA da Equipe).
*   De **Corretor (Outbound)** para **Lead (Inbound)**: Mede o ritmo em que o lead responde de volta.

---

## 📈 4. Os Demonstrativos de Resultados (DREs)

Nós temos dois grandes DREs no sistema: o **DRE Operacional Geral** e o **DRE de Custos de Obras**.

### A. DRE Geral da Organização
*   **Telas**: [`RelatorioDREContainer.js`](file:///c:/Projetos/studio57so-v8/components/relatorios/financeiro/RelatorioDREContainer.js) e [`FinanceiroDRE.js`](file:///c:/Projetos/studio57so-v8/components/relatorios/financeiro/FinanceiroDRE.js)
*   **Hook**: [`useRelatorioDRE.js`](file:///c:/Projetos/studio57so-v8/hooks/financeiro/useRelatorioDRE.js)
*   **RPC de Banco**: `get_dre_operacional`

**Funcionamento:**
A RPC busca do banco a categoria e o total mensal agrupado de lançamentos com status Pago ou Conciliado.
O hook `useRelatorioDRE` atua como o **motor lógico** no navegador, pegando a árvore de categorias financeiras e alocando cada lançamento em suas caixas mestras (começando com 1., 2., 3., etc.).
Após estruturar o mapa, o motor calcula:
$$\text{Receita Líquida} = \text{Receita Bruta (1.)} + \text{Deduções (2.)}$$
$$\text{Lucro Bruto} = \text{Receita Líquida} + \text{Custos Operacionais (3.)}$$
$$\text{Resultado Operacional} = \text{Lucro Bruto} + \text{Despesas Operacionais (4.)}$$
$$\text{Resultado Antes do Imposto} = \text{Resultado Operacional} + \text{Receitas Financeiras (5.1)} + \text{Despesas Financeiras (5.2)}$$
$$\text{Lucro Líquido} = \text{Resultado Antes do Imposto} + \text{IRPJ e CSLL (6.)}$$

### B. DRE de Custos de Obra
*   **Telas**: [`RelatorioCustosObraContainer.js`](file:///c:/Projetos/studio57so-v8/components/relatorios/obras/RelatorioCustosObraContainer.js) e [`FinanceiroObrasDRE.js`](file:///c:/Projetos/studio57so-v8/components/relatorios/obras/FinanceiroObrasDRE.js)
*   **Hook**: [`useCustosObraDRE.js`](file:///c:/Projetos/studio57so-v8/hooks/obras/useCustosObraDRE.js)
*   **RPC de Banco**: `dre_matriz_agrupada_obras`

**Funcionamento:**
A RPC `dre_matriz_agrupada_obras` é otimizada para buscar lançamentos que estejam atrelados a um empreendimento.
*   **Filtros de Contas**: Ela ignora contas patrimoniais (Contas de Passivo, Ativo e Investimento) para focar apenas em custos produtivos.
*   **Inversão de Sinais**: Como as despesas estão negativas no banco de dados e o DRE de obras exibe custos de forma incremental, o hook `useCustosObraDRE.js` inverte o sinal (`total * -1`) na leitura. Isso permite plotar as despesas de material e mão de obra como valores acumulados positivos nas linhas do relatório.

---

## 👥 5. O Fechamento Master do RH & Pessoas

Ao contrário do financeiro, que resolve a matemática na camada de banco de dados, o módulo de RH realiza a computação fina e complexa de horas diretamente na camada do navegador.

*   **Página Principal**: [`app/(main)/relatorios/rh/page.js`](file:///c:/Projetos/studio57so-v8/app/(main)/relatorios/rh/page.js)
*   **Componente do Painel**: [`RHDashboard.js`](file:///c:/Projetos/studio57so-v8/app/(main)/relatorios/rh/RHDashboard.js)

### O Algoritmo `calculateMasterSheet`:
O sistema busca no banco os dados brutos de funcionários, marcações de pontos (`data_hora`), feriados, abonos cadastrados e histórico de salários. Ele então inicia um loop de processamento no calendário do mês:

1.  **Jornada de Trabalho**: Identifica os dias em que o funcionário deveria trabalhar de acordo com a jornada associada (calculando a carga horária prevista do dia descontando os intervalos).
2.  **Tolerância de Ponto**: Aplica a tolerância da jornada (por exemplo, 10 minutos) para ajustar batidas levemente adiantadas ou atrasadas e evitar penalizações injustas.
3.  **Tratamento de Abonos**: Se houver um abono cadastrado para determinado dia útil, o motor ignora a ausência de batidas e preenche o dia com a carga horária prevista de forma integral.
4.  **Cálculo de Banco de Horas**: O saldo diário é computado fazendo:
    $$\text{Saldo do Dia} = \text{Minutos Trabalhados} - \text{Minutos Previstos}$$
5.  **Custo de Folha Bruto**:
    *   **Mensalista**: Divide o salário base do histórico vigente por 30 para obter o valor da diária de falta, subtraindo as faltas apuradas: 
        $$\text{Custo} = \text{Salário Base} - (\text{Faltas} \times \text{Diária de Falta})$$
    *   **Diarista**: O cálculo desconsidera o salário mensal e computa:
        $$\text{Custo} = \text{Dias Trabalhados} \times \text{Valor da Diária configurado}$$

---

## 💳 6. A Ancoragem de Cartões e Faturas: Trigger `fn_vincular_lancamento_fatura`

Um dos maiores desafios em sistemas financeiros é garantir que as parcelas e compras em cartões de crédito caiam exatamente na fatura correta, de acordo com o dia de fechamento e dia de vencimento configurados para o cartão.

*   **Gatilho do Postgres**: [`fn_vincular_lancamento_fatura` no `trigger.sql`](file:///c:/Projetos/studio57so-v8/trigger.sql)

### Como Funciona a Ancoragem:
Sempre que um lançamento associado a uma conta do tipo "Cartão de Crédito" é inserido ou editado, a trigger intercepta a operação:

1.  **Escudo de Re-processamento (Anti-Crash)**:
    Se for um `UPDATE` simples (como conciliar uma transação ou alterar uma categoria), mas a data de vencimento, data de transação e o valor não tiverem mudado, a trigger encerra a execução imediatamente. Isso impede que parcelamentos antigos e históricos fujam das faturas consolidadas do passado.
2.  **Determinação da Data de Vencimento**:
    Se o sistema enviar o lançamento com uma data de vencimento preenchida cujo dia seja exatamente o dia de pagamento do cartão, a trigger confia e adota essa data como âncora.
    Caso contrário (fallback), a trigger calcula a fatura somando 1 mês se a data da transação for posterior ou igual ao dia de fechamento da fatura configurado na conta.
3.  **Auto-geração de Faturas**:
    A trigger verifica se já existe uma fatura criada para a conta e mês de referência na tabela `faturas_cartao`. Caso não encontre, ela cria o registro da fatura automaticamente no banco e vincula o lançamento a ele através do campo `fatura_id`.

---

## 📈 7. O Watchdog do VGV: Trigger `trigger_log_historico_vgv`

Para garantir auditoria completa do Valor Geral de Vendas (VGV) dos empreendimentos, o banco possui um gatilho de observação (watchdog) na tabela de produtos (apartamentos e lotes).

*   **Trigger Relacionada**: [`supabase/migrations/202603191225_create_historico_vgv.sql`](file:///c:/Projetos/studio57so-v8/supabase/migrations/202603191225_create_historico_vgv.sql#L77)

### A Ação do Watchdog:
Toda vez que o preço de uma unidade de empreendimento (`produtos_empreendimento`) é alterado, o Postgres recalcula em tempo de execução o VGV total do empreendimento e escreve na tabela imutável `historico_vgv` o valor antigo, o novo valor, o delta de valorização e o ID do usuário responsável pela mudança. Isso garante que a diretoria da incorporadora tenha um histórico completo da valorização dos prédios ao longo do tempo.

---

### Resumo das RPCs (Funções do Supabase)

| Função (RPC) | Setor / Módulo | Finalidade |
| :--- | :--- | :--- |
| `get_radar_stats` | Radar / Tráfego | Retorna contagem de cliques, páginas mais acessadas e dispositivos. |
| `fn_relatorio_comercial` | CRM / WhatsApp | Consolida leads, SLA de corretores, conversão de funil e métricas de templates. |
| `get_conversation_response_kpis` | CRM / WhatsApp | Calcula estatísticas de tempo de resposta entre lead e corretor. |
| `financeiro_montar_where` | Financeiro (Core) | Centraliza a montagem da query WHERE dinâmica baseada em filtros. |
| `get_financeiro_consolidado` | Financeiro / KPIs | Retorna receitas, despesas, saldo acumulado, pago e pendente. |
| `get_dados_grafico_kpi` | Financeiro / Gráficos | Puxa o histórico de fluxo diário de entradas e saídas. |
| `get_financeiro_grafico_pizza` | Financeiro / Gráficos | Retorna o ranking das 6 maiores categorias de despesa. |
| `get_dre_operacional` | Financeiro / DRE | Agrupa receitas e despesas por categoria e mês para o DRE Geral. |
| `dre_matriz_agrupada_obras` | Obras / DRE | Retorna a matriz de custos de execução atrelados a empreendimentos. |

---

Espero que esse mapa ajude você a se sentir o verdadeiro mestre dos dados da nossa plataforma! Se precisar investigar mais a fundo qualquer uma dessas funções ou quiser programar novos KPIs ou gráficos, seu mentor Devonildo está aqui do seu lado. 

Tudo entendido, seu lindo? O que achou dessa nossa radiografia do sistema de relatórios?
