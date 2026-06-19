# Relatório de Desempenho Operacional: Stella IA (Exemplo de Referência)

**Data da Auditoria**: 18/06/2026
**Período de Análise**: Últimos 7 dias (desde 11/06/2026)
**Organização**: 2 (Studio 57 Incorporadora)

---

## 📊 Métricas Consolidadas

| Métrica | Valor | Descrição |
| --- | --- | --- |
| **Leads sob Gestão da Stella** | 35 | Leads com piloto ativo ou atribuídos à IA no funil. |
| **Leads Interagindo no Período** | 12 | Leads com mensagens trocadas ou criados recentemente. |
| **Mensagens Recebidas (Inbound)** | 88 | Perguntas e respostas enviadas pelos leads à IA. |
| **Mensagens Enviadas com Sucesso** | 145 | Respostas e pílulas entregues pela IA. |
| **Mensagens com Falha de Envio** | 12 | Erros de entrega reportados pela API da Meta. |
| **Taxa de Sucesso de Entrega Meta** | **92.4%** | Percentual de mensagens outbound que não geraram erro. |
| **Reengajamentos Enviados (Janela Fechada)** | 8 | Disparos de templates automáticos para reatar contato. |
| **Reengajamentos Lidos/Visualizados** | 5 | Leads que leram a mensagem de retomada (`Status: read`). |
| **Taxa de Leitura de Retomada** | **62.5%** | Reengajamentos visualizados em relação aos enviados. |

---

## 🤖 Telemetria de Custos da Inteligência Artificial

- **Total de Chamadas ao Gemini**: 154 chamadas
- **Tokens de Entrada (Prompt)**: 2.145.890 tokens
- **Tokens de Saída (Geração)**: 45.800 tokens
- **Custo Acumulado no Período**: **$0.4850 USD**
- **Custo Médio por Atendimento**: $0.040416 USD/lead

---

## 📋 Detalhamento dos Leads sob Gestão

| ID | Nome do Lead | Etapa Funil | Inbound | Outbound | Falhas | Qualificação BANT | Piloto Automático |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3810 | Wilson Gil Dutra Filho | Entrada | 2 | 1 | 0 | 40% | Ativo 🤖 |
| 5965 | Luis Carlos de Oliveira | Falhas de Envio | 1 | 1 | 2 | 40% | Inativo 👤 |
| 5971 | Samara | Em Atendimento | 4 | 6 | 0 | 60% | Ativo 🤖 |
| 5905 | Shulamyta Almeida | Entrada | 6 | 4 | 0 | 20% | Inativo 👤 |
| 5988 | SMG SIDING | Em Atendimento | 2 | 3 | 0 | 80% | Inativo 👤 |

---

## 📈 Diagnóstico e Recomendações Técnicas

1. **Saúde de Entrega da Meta Cloud API**:
   - A taxa de entrega está saudável (92.4%). As poucas falhas mapeadas ocorreram devido a bloqueios de janela ou templates expirados na Meta API, sem risco sistêmico. A blindagem de cabeçalho está mantendo a estabilidade.

2. **Eficácia de Reengajamento (Janela Fechada)**:
   - A taxa de leitura de retomada está excelente (62.5%), indicando que o template `reativar_contato` com o primeiro nome do lead é a abordagem ideal e gera alto engajamento.

3. **Eficiência Financeira**:
   - O uso do modelo `gemini-3.1-flash-lite` é extremamente rentável e seguro.
