# Planejamento de Marketing - Beta Suítes

Este plano visa realizar uma varredura completa em todos os dados do banco, baixar arquivos (PDFs e Imagens) relacionados ao Beta Suítes, processar o conteúdo utilizando a Inteligência Artificial (Gemini 2.5 Flash File API) e, por fim, redigir um artefato completo com o Plano de Marketing para Investidores.

## Objetivos
1. **Extração de Dados Locais:** Ler empreendimentos, anexos, pedidos de compra e atividades ligadas ao Beta Suítes.
2. **Download de Arquivos Críticos:** Fazer o download local dos PDFs de marketing (Book de Vendas, Tabela de Vendas, Manual de Identidade Visual, etc.) e plantas/imagens anexadas.
3. **Leitura via Skill Padrão Ouro Gemini:** Aplicar a skill obrigatória para enviar os PDFs à API do Gemini e extrair as informações relevantes de forma estruturada.
4. **Síntese de Planejamento Estratégico:** Gerar o plano final de marketing orientado a investidores.

## User Review Required
> [!IMPORTANT]
> Seu lindo, por favor, valide se os arquivos abaixo são os mais cruciais para lermos com a IA:
> - `[BOK] - BETA PORTIFÓLIO - 2025.pdf` (Book de Vendas)
> - `[TAB] - TABELA DE VENDAS_BETA_050326.pdf`
> - `[RLT] - Manual_de_Identidade_Studio_57.pdf`
> - Imagens das plantas humanizadas e fachadas.
> Além disso, extrairemos contexto dos 20 pedidos de compra já localizados no banco. Concorda com este escopo?

## Fases de Execução

### Fase 1: Setup e Download
- Criar o diretório `c:\Projetos\studio57so-v8\beta_suites`.
- Escrever um script Node.js para baixar os anexos críticos do bucket `empreendimento-anexos` do Supabase para esta pasta.

### Fase 2: Auditoria e Leitura de PDFs (Skill)
- Criar e executar o script `ler_arquivos_beta.js` baseado na skill `Auditoria e Leitura de PDFs (Padrão Ouro Gemini)`.
- Extrair o texto completo, valores, metragens, detalhes técnicos e de publicidade descritos nestes documentos usando o modelo `gemini-2.5-flash`.

### Fase 3: Análise de Metadados (Atividades e Pedidos)
- Consolidar a lista de Pedidos de Compra (ex: "Gradil", "Projetos", "Marketing/Banner", "Limpeza") para inferir o estágio atual da obra e prever o timing da campanha de marketing.
- Verificar tickets/feedbacks pendentes.

### Fase 4: Elaboração do Plano de Marketing
- Escrever o artefato `plano_marketing_investidor_beta_suites.md`.
- Estruturar em: Resumo do Produto (VGV, Unidades, Prazos), Identidade e Posicionamento, Estágio Físico/Ações e Pitch de Vendas para o Investidor.

## Verification Plan
1. Conferir se todos os dados do banco foram cruzados corretamente (VGV, Custos e Prazos do empreendimento `ID=5`).
2. Validar se o texto extraído da leitura de PDFs cobriu os pontos focais da tabela de vendas e do portfólio.
3. Entregar o documento completo em formato Markdown legível.
