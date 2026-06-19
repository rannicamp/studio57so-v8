---
name: Auditoria de Performance e Caixa de Entrada da Stella IA
description: Skill para auditar conversas, volumetria de mensagens, taxas de erro na API da Meta, custos de API e qualificação BANT de leads da Stella IA, gerando relatórios gerenciais estruturados de desempenho de SDR.
---

# Auditoria de Performance e Caixa de Entrada da Stella IA

Esta skill ensina o agente a analisar, auditar e compilar relatórios gerenciais de desempenho da Stella IA (a assistente virtual e SDR da incorporadora). A auditoria ajuda o time e os gestores a entender a volumetria de mensagens, a eficiência da IA em qualificar contatos (método BANT), a integridade das conexões com a Meta Cloud API (erros e taxas de entrega) e os custos da inteligência artificial.

## 📋 Pré-requisitos
- Conexão ativa com o banco de dados Supabase da Elo 57/Studio 57.
- Variáveis de ambiente configuradas no `.env.local` (especificamente `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).

## 🛠️ Procedimento de Auditoria Automatizada

O projeto conta com um script automatizado que realiza os cruzamentos de dados no banco de dados e cospe o relatório consolidado em markdown.

### Passo 1: Executar o Script de Performance
No terminal do projeto (`c:/Projetos/studio57so-v8`), execute o seguinte comando:
```powershell
node .agents/skills/auditoria_stella/scripts/run-stella-audit.js --days=7
```
*(Você pode mudar o parâmetro `--days` para qualquer quantidade de dias desejada, ex: `--days=15` ou `--days=30`)*.

### Passo 2: Localizar os Relatórios Gerados
O script salvará o relatório gerado em dois locais:
1. **No repositório do projeto**: `c:/Projetos/studio57so-v8/relatorios/relatorio_desempenho_stella.md`
2. **Na pasta de artefatos da conversa ativa**: `C:/Users/ranni/.gemini/antigravity/brain/[conversation_id]/relatorio_desempenho_stella.md`

---

## 🔬 Auditoria Manual de Caixa de Entrada (Diretrizes para a IA)

Se for necessário realizar uma investigação qualitativa detalhada de leads individuais, a IA deve seguir os seguintes procedimentos:

### 1. Verificar Status de Piloto Automático e Governança
- **Objetivo**: Garantir que a Stella não está respondendo a contatos atribuídos a corretores humanos.
- **Como verificar**:
  - Faça uma consulta cruzando `contatos` e `contatos_no_funil`.
  - Se `contatos_no_funil.corretor_id` for diferente do ID de contato da Stella (`5792` na Org 2) e `ia_atendimento_ativo` do contato estiver `true`, há uma inconsistência. O piloto automático do contato deve ser definido como `false` para evitar intrusão no atendimento manual.

### 2. Verificar Histórico de Conversas e Falhas da Meta
- **Objetivo**: Detectar se há mensagens falhando por restrições ou cabeçalhos.
- **Consultas no Banco**:
  - Busque na tabela `whatsapp_messages` as mensagens do contato nos últimos dias ordenadas por data de criação descrescente.
  - Verifique se o campo `status` está como `'failed'`. Se sim, examine o `error_message` e o `raw_payload`.
  - Se a falha for o erro **131049** (ecosystem engagement), significa que a Meta barrou por falta de engajamento do cliente. Verifique se o autopilot foi desativado automaticamente pelo webhook (regra correta) e se o lead foi movido para a etapa de **FALHAS** do funil.
  - Se a falha for o erro **132012** (parameter format mismatch), verifique se o template exige imagem/mídia de cabeçalho e se a rota `/api/whatsapp/send` falhou em injetar a imagem de fallback.

### 3. Avaliar Nível de Qualificação BANT do Lead
- **Objetivo**: Quantificar a eficiência da IA em qualificar o contato.
- **Fatores BANT**:
  - **B (Budget)**: Examine se `contatos.renda_familiar` ou `ai_analysis.dados_cliente.renda_familiar` está preenchido.
  - **A (Authority)**: Examine se campos cadastrais como `cpf` ou `cnpj` foram extraídos.
  - **N (Need)**: Examine se o campo `contatos.objetivo` (Moradia, Lazer, Investimento) foi preenchido.
  - **T (Timeline)**: Examine se há alguma atividade futura ou comentário sobre o prazo do cliente nas notas do CRM.
