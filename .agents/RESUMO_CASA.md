# 🏡 Transição de Contexto: Roteamento de Leads & Correções no CRM (Para Continuar de Casa)

Este documento foi gerado pelo seu mentor técnico **Devonildo** para garantir que você possa retomar os trabalhos em casa exatamente de onde paramos, mantendo o histórico de progresso 100% alinhado.

---

## 🚀 1. Resumo do que foi Consertado Hoje

### A. Roteamento de Leads por Origem (`origem`)
* **Banco de Dados**:
  * Adicionamos a coluna `origem` (`text`) na tabela `regras_roteamento_funil`.
  * Reformulamos a RPC `fn_rotear_lead` para considerar o campo `origem` do lead e ordenar pela especificidade dos filtros (anúncio > campanha > página > origem).
  * **Busca de Colunas Inteligente**: Atualizamos a RPC para buscar de forma robusta a coluna de destino do funil, priorizando o `tipo_coluna = 'entrada'`, caindo para o nome `ENTRADA` (case-insensitive) e finalmente usando a primeira coluna do funil por ordem (`ordem ASC`) caso não encontre. Isso resolveu falhas em funis que tinham a primeira etapa marcada erroneamente como `'etapa'` em vez de `'entrada'`.

### B. Bug do Funil Trocado na Landing Page (Elo 57)
* **O Erro**: O processador de leads (`leadActions.js`) estava inserindo leads novos no funil customizado `"Funil de Vendas"` (ID `c0dd9026...`), enquanto a tela visual do CRM utiliza o funil de sistema global **`Funil de Entrada`** (ID `8dfe1533-d397-4c70-8f3c-36e989b1502d`).
* **A Correção**: Atualizamos as constantes de fallback em `leadActions.js` para apontarem para o ID e nome corretos do **`Funil de Entrada`** e sua respectiva coluna **`ENTRADA`** (ID `902f7707...`).
* **Resgate**: Rodamos um script que resgatou os leads de teste de Ranniere (`Ranniere Campos Mendes Teste 3`) e os moveu para a coluna `ENTRADA` correta no banco.

### C. Bug de Multi-Tenancy (Deduplicação de Telefone/Email)
* **O Erro**: A busca de contato existente pelo telefone ou e-mail na Landing Page não filtrava pela organização do lead. Por conta disso, contatos de teste antigos cadastrados na **Organização 57** eram encontrados e atualizados, movendo o card no funil da Org 57 (invisível para a sua conta atual da Org 2).
* **A Correção**: Adicionamos a cláusula `.eq('organizacao_id', organizacaoId)` na deduplicação de telefone e e-mail no arquivo `leadActions.js`. Agora cada tenant é 100% isolado.

### D. Novo Construtor de Automações Dinâmico
* **O que mudou**: Implementamos tanto no modal de Kanban quanto na página de CRM o Construtor Dinâmico de Condições, permitindo filtros combinados (E/AND) de Campanha, Anúncio, Origem e DDI de País. Também incluímos a capacidade de reordenar a prioridade (setas Up/Down) e editar regras (botão Lápis).

---

## 📦 2. Estado do Deploy e Repositório Git
* **Commit e Push**: Todas as alterações locais foram comitadas e enviadas para o GitHub na branch `main` com sucesso (`To https://github.com/rannicamp/studio57so-v8.git`).
* **Netlify**: O deploy automático é acionado a cada push e a versão de produção é atualizada automaticamente.

---

## 🎯 3. Onde Paramos & Próximos Passos (Para Fazer de Casa)

Quando você abrir o projeto em casa, tudo estará pronto para uso:
1. **Comando de Inicialização Rápida (PowerShell)**:
   Se o PowerShell externo travar ou bloquear o script do `npm` na sua máquina de casa, use a nossa nova skill rodando este comando unificado:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; cd c:\Projetos\studio57so-v8; npm run dev
   ```
   * Detalhes na nova skill em: [.agents/skills/iniciar_servidor_seguro/SKILL.md](file:///c:/Projetos/studio57so-v8/.agents/skills/iniciar_servidor_seguro/SKILL.md)
2. **Criação de Regras e Testes**:
   * Crie uma regra de automação no painel associando a origem `"Landing Page - Elo 57 (Pré-Lançamento)"` para direcionar para o funil customizado `"Elo 57"`.
   * Faça novas submissões do formulário no site e verifique o roteamento dinâmico funcionando em tempo real.
