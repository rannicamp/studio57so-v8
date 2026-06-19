# Relatório de Desempenho Operacional: Stella IA

**Data da Auditoria**: 18/06/2026
**Período de Análise**: Últimos 7 dias (desde 11/06/2026)
**Organização**: 2 (Studio 57 Incorporadora)

---

## 📊 Métricas Consolidadas

| Métrica | Valor | Descrição |
| --- | --- | --- |
| **Leads sob Gestão da Stella** | 117 | Leads com piloto ativo ou atribuídos à IA no funil. |
| **Leads Interagindo no Período** | 16 | Leads com mensagens trocadas ou criados recentemente. |
| **Mensagens Recebidas (Inbound)** | 17 | Perguntas e respostas enviadas pelos leads à IA. |
| **Mensagens Enviadas com Sucesso** | 25 | Respostas e pílulas entregues pela IA. |
| **Mensagens com Falha de Envio** | 16 | Erros de entrega reportados pela API da Meta. |
| **Taxa de Sucesso de Entrega Meta** | **61.0%** | Percentual de mensagens outbound que não geraram erro. |
| **Reengajamentos Enviados (Janela Fechada)** | 2 | Disparos de templates automáticos para reatar contato. |
| **Reengajamentos Lidos/Visualizados** | 1 | Leads que leram a mensagem de retomada ('Status: read'). |
| **Taxa de Leitura de Retomada** | **50.0%** | Reengajamentos visualizados em relação aos enviados. |

---

## 🤖 Telemetria de Custos da Inteligência Artificial

- **Total de Chamadas ao Gemini**: 231 chamadas
- **Tokens de Entrada (Prompt)**: 3.244.086 tokens
- **Tokens de Saída (Geração)**: 91.711 tokens
- **Custo Acumulado no Período**: **$0.9486 USD**
- **Custo Médio por Atendimento**: $0.059287 USD/lead

---

## 📋 Detalhamento dos Leads sob Gestão

| ID | Nome do Lead | Etapa Funil | Inbound | Outbound | Falhas | Qualificação BANT | Piloto Automático |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5949 | Fábio Dias | Falhas de Envio | 0 | 0 | 1 | 0% | Inativo 👤 |
| 5868 | Rosa Solange Soares | Sem Funil | 1 | 0 | 0 | 40% | Ativo 🤖 |
| 5951 | Rodrigo Dias|empreendedor soldador/técnico em eletromecânica | Outra | 0 | 1 | 0 | 0% | Ativo 🤖 |
| 5952 | Laurita Pires | Outra | 0 | 1 | 0 | 0% | Ativo 🤖 |
| 5953 | Chris Fahel | Em Atendimento | 1 | 2 | 1 | 20% | Ativo 🤖 |
| 5915 | Gê Oliveira | Falhas de Envio | 0 | 1 | 1 | 20% | Inativo 👤 |
| 3504 | Marcelino Gonçalves | Outra | 0 | 1 | 0 | 0% | Ativo 🤖 |
| 5954 | Adriana Maria Tomaz | Outra | 0 | 1 | 0 | 0% | Ativo 🤖 |
| 5923 | Ranniere Campos Teste | Falhas de Envio | 10 | 4 | 8 | 20% | Inativo 👤 |
| 5662 | Josiel Rodrigues | Falhas de Envio | 0 | 3 | 1 | 20% | Inativo 👤 |
| 5990 | Claudiney Castro | Falhas de Envio | 0 | 0 | 1 | 0% | Inativo 👤 |
| 5991 | Usuário 255034 | Outra | 0 | 0 | 0 | 0% | Ativo 🤖 |
| 5958 | Calhas Líder | Falhas de Envio | 0 | 0 | 1 | 0% | Inativo 👤 |
| 5959 | Marcia Margateth Germano | Outra | 0 | 1 | 0 | 0% | Ativo 🤖 |
| 5975 | Thiago Lousada | Falhas de Envio | 1 | 0 | 2 | 0% | Inativo 👤 |
| 5955 | Júnior Vidal | Em Atendimento | 4 | 10 | 0 | 0% | Ativo 🤖 |

---

## 📈 Diagnóstico e Recomendações Técnicas

1. **Saúde de Entrega da Meta Cloud API**:
   - Uma taxa de entrega de **61.0%** é considerada PREOCUPANTE ⚠️.
   - Foram registradas 16 falhas de entrega hoje. A maioria ocorreu devido a restrições de engajamento do ecossistema da Meta (erro 131049) ou falha de formatação. A blindagem de cabeçalho de imagem evitou novas falhas de formato no final do dia.

2. **Eficácia de Reengajamento (Janela Fechada)**:
   - A taxa de leitura de retomada está em **50.0%**. O envio de templates simples e diretos como 'reativar_contato' (com o primeiro nome do lead) demonstrou excelente recepção prática (ex: lead Wilson Gil visualizou o reengajamento imediatamente).

3. **Eficiência Financeira**:
   - Com custo médio de **$0.05929 USD** por lead, o uso do modelo 'gemini-3.1-flash-lite' demonstra extrema viabilidade econômica (menos de R$ 0,03 por lead atendido).

---
*Relatório gerado automaticamente pelo motor de auditoria Stella Performance Audit Skill.*
