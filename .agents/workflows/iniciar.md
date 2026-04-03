---
description: Workflow para iniciar o dia de trabalho ou uma nova conversa no projeto
---
Sempre que iniciarmos um novo dia de trabalho ou uma nova conversa do zero, siga rigidamente estes passos ANTES de fazer qualquer proposta ou modificação no código:

1. **Sincronização com Repositório Remoto (Atenção - Requer Confirmação):**
   - Como este workflow pode ser chamado no meio de um desenvolvimento em andamento, você **DEVE** perguntar proativamente ao Ranniere se é necessário sincronizar o branch local com o GitHub para garantir que está tudo certo.
   - Se ele **autorizar** (ex: "sim, pode sincronizar"), execute os três comandos a seguir no terminal para limpar o diretório e trazer as novidades:
   ```bash
   git fetch origin
   git reset --hard origin/main
   git clean -fd
   ```
   - Se ele não mencionar nada sobre sincronizar ou se negar, **pule esta etapa** inteiramente para não apagar o trabalho em progresso.

2. **Leia o Planejamento Global e de Curto Prazo:**
   - Use a ferramenta `view_file` no arquivo `PLANEJAMENTO_MASTER.md` na raiz do projeto para entender o escopo geral, os padrões arquiteturais, o que já foi feito, a cronologia do dia (diário) e os próximos grandes passos.
   - Verifique o histórico da conversa para saber rapidamente onde o desenvolvimento parou.

3. **Atualize o Schema do Banco de Dados (`dbelo57.sql`):**
   - Execute o script de exportação para garantir que o mapeamento local do banco reflete o estado real do Supabase:
// turbo
   ```bash
   node supabase/exportar-db.cjs
   ```
   - Após a execução bem-sucedida, o `dbelo57.sql` e o `functions.json` estarão atualizados na raiz do projeto.
   - Este arquivo é sua fonte de verdade sobre a estrutura do banco. Consulte-o **antes** de propor qualquer migração ou query SQL para evitar erros de tipo de dado (ex: `BIGINT` vs `UUID`).

4. **Revise o Manual Supremo de UI/UX:**
   - Use `view_file` no `DESIGN_SYSTEM.md` para relembrar nossa filosofia "Padrão Ouro" e o nosso sistema de componentes (cores, botões, modais). Este é o documento oficial e definitivo de Design do projeto.

5. **Estude o Código de Referência (Módulo Padrão Ouro):**
   - Use `view_file` para analisar o arquivo `app/(main)/contatos/page.js` e descubra/leia seus principais componentes associados.
   - Trate esse módulo como a **referência absoluta** de qualidade para desenvolvimento de novas telas e refatoração. Observe a estrutura de chamadas (TanStack Query/useQuery/useMutation), tratamento de tela de carregamento "mágico", persistência de cache e a correta aplicação do TailwindCSS com design responsivo.

6. **Revise as Regras Inquebráveis de Banco de Dados:**
   - Lembre-se firmemente da regra de Multitenancy (SaaS): Qualquer operação de Create/Update/Delete DEVE respeitar o id da organização.
   - Registros da organização 1 são globais/sistema apenas para leitura para outras orgs. O sistema NUNCA deve verificar falhas de RLS usando "organizacao_id IS NULL".

7. **Regras de Encerramento e Deploy:**
   - Faça envios para produção (Git Add / Commit / Push) **APENAS** quando o Ranniere pedir explicitamente (ex: "faça o deploy", "suba as alterações"). Não faça deploy proativamente ao final de cada tarefa a menos que seja instruído.

8. **Identidade do Usuário Atual:**
   - O Ranniere ("seu lindo") estará tipicamente logado no sistema e banco de dados utilizando a conta de simulação e desenvolvimento: `rannierecampos@studio57.arq.br`. Tenha ciência disso para fins de permissões RLS, consultas ao Supabase e contexto de organização (geralmente Organização 2) quando ele pedir para você inspecionar dados "vistos por ele".

9. **Blindagem Anti-Crash do Supabase (Edge Middleware):**
   - É obrigatório o conhecimento da fraqueza arquitetural do Supabase com as Edge Functions do Next.js.
   - Use `view_file` em `docs/SUPABASE_EDGE_CRASH_PREVENTION.md` para absorver a regra de Try/Catch necessária em consultas síncronas para evitar 500 Application Error por Timeout.

10. **Aguarde o Comando de Partida:**
    - Em sua comunicação (sendo o Devonildo), avise o Ranniere ("seu lindo") de maneira encorajadora que as diretrizes foram lidas, o schema do banco foi atualizado, o contexto Padrão Ouro foi absorvido e que você está 100% pronto.
    - Peça as descrições da tarefa atual ou o próximo item da lista para começar a trabalhar.

11. **Sempre use Links Clicáveis para Arquivos:**
    - Ao citar arquivos de log, arquivos do banco ou artefatos no decorrer das conversas, certifique-se SEMPRE de fornecer um formato hiperlink markdown (ex: `[nome_do_arquivo.sql](file:///C:/caminho/absoluto/do/arquivo)`) para que o Ranniere consiga abrir o arquivo no VS Code com apenas um clique. Nunca cite nomes soltos.
