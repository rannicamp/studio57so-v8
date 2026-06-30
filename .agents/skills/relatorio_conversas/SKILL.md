---
name: Relatório de Conversas e Andamento do Funil
description: Skill para auditar conversas do WhatsApp recentes, extrair dados cadastrais, andamento do funil comercial, corretores responsáveis e histórico de movimentação de fases dos leads.
---

# Relatório de Conversas e Andamento do Funil

Esta skill ensina a IA a auditar conversas ativas no WhatsApp, cruzar com dados cadastrais e extrair a linha do tempo de transições de colunas do funil comercial de cada lead.

## Diretrizes de Uso

Sempre que o usuário solicitar um relatório de conversas recentes ou o andamento dos clientes ativos:

1. **Executar o Script de Relatório Rico:**
   Rode o script em `.agents/skills/relatorio_conversas/scripts/gerar_relatorio_rico.js`.
   * Comando: `node .agents/skills/relatorio_conversas/scripts/gerar_relatorio_rico.js`
   * Você pode passar o parâmetro `--horas X` para buscar mensagens das últimas X horas (ex: `--horas 24`). O padrão é 24 horas.

2. **Ler o Relatório Gerado:**
   O script gerará um arquivo Markdown rico e formatado na pasta de artefatos da conversa.
   * Local: `C:\Users\ranni\.gemini\antigravity\brain\<conversacao_id>\scratch\relatorio_clientes_detalhado.md`

3. **Apresentar o Relatório:**
   Apresente o resumo para o usuário ("seu lindo") destacando as novidades, leads duplicados neutralizados, e os relatórios das conversas ativas.

4. **Sempre Sobrescrever:**
   O script sempre sobrescreve o arquivo `.md` anterior para manter a pasta limpa e conter a versão em tempo real.
