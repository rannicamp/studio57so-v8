# Workflow: Relatório e Auditoria das Conversas do WhatsApp (/relatorio-conversas)

Este workflow descreve as diretrizes para a IA coletar, estruturar e auditar as conversas ativas do WhatsApp dos leads comerciais, puxando a linha do tempo de transições de colunas (fases) no CRM de forma visual e premium.

---

## 🚀 Passo a Passo de Execução

### Passo 1: Iniciar a Auditoria de Conversas
Rode o script especializado da skill `relatorio_conversas` para escanear a tabela de mensagens e registrar o histórico de movimentações dos leads ativos.
* **Comando:**
  ```bash
  node .agents/skills/relatorio_conversas/scripts/gerar_relatorio_rico.js
  ```
  *(Por padrão, este comando analisa todas as mensagens de ontem ao meio-dia até agora. Se quiser um fuso horário ou horas específicos, use o parâmetro `--horas X`).*

### Passo 2: Analisar e Ler o Relatório Gerado
O script gera um arquivo markdown de design premium contendo a ficha de cada lead, o corretor humano responsável e a tabela cronológica das transições de coluna do banco `historico_movimentacao_funil`.
* **Caminho do Arquivo:** `C:\Users\ranni\.gemini\antigravity\brain\0254b46f-ded9-44e2-9d20-658a8e0cad55\scratch\relatorio_clientes_detalhado.md`
* Use a ferramenta `view_file` para ler e analisar o relatório gerado.

### Passo 3: Apresentar o Sumário e Links Rápidos
Resuma os principais acontecimentos (quem foi qualificado, qual corretor assumiu, se houve leads duplicados e as desativações correspondentes) de forma muito didática e afetuosa para o usuário ("seu lindo"). 
Forneça sempre o link clicável direto para o artefato [relatorio_clientes_detalhado.md](file:///C:/Users/ranni/.gemini/antigravity/brain/0254b46f-ded9-44e2-9d20-658a8e0cad55/scratch/relatorio_clientes_detalhado.md) gerado no scratch para que ele possa ler na íntegra.
