# Regras do Projeto Studio 57 / Elo 57

## 🚀 Protocolo de Teste e Deploy (Regra de Ouro)
1. **PROIBIDO fazer deploy/push prematuro:** Nunca faça `git push` ou acione deploys automáticos no GitHub antes de rodar o servidor de desenvolvimento local e testar as novas funcionalidades implementadas.
2. **Fluxo de Trabalho Obrigatório:**
   - **Passo 1:** Codificar as alterações solicitadas pelo usuário.
   - **Passo 2:** Iniciar e rodar o servidor local (ex: `npm run dev`) e testar as novas telas e APIs.
   - **Passo 3:** Apresentar as mudanças e colher o feedback do usuário ("seu lindo") para que ele também teste em ambiente local.
   - **Passo 4:** Somente após a **aprovação explícita** dele localmente, prosseguir com o commit e push para o repositório remoto.

3. **PROIBIDO USAR CLIENTES REAIS DO BANCO DE DADOS PARA TESTES:** 
   - Nunca insira mensagens fictícias, altere colunas de funil ou simule webhooks utilizando IDs de contatos de clientes reais no banco de dados de produção. Isso evita poluição visual no chat e confusão operacional para a equipe comercial.
   - Para qualquer teste de envio de mensagens ou simulação de API/Webhook, **crie contatos fictícios do zero** no banco ou utilize exclusivamente o número de WhatsApp do Ranniere para testes: `5533991912291` (DDI 55, DDD 33, número 99191-2291).

4. **PRESERVAÇÃO ABSOLUTA DE CONTAS E USUÁRIOS REAIS:**
   - Sob nenhuma hipótese use, reutilize ou modifique dados de contas de acesso de usuários reais e ativos (tanto nas tabelas do schema `auth` quanto em `public.usuarios` ou `public.funcionarios`) para fins de sementes de dados (seeds), testes locais, ou simulações de personagens de demonstração.
   - Os usuários legítimos cadastrados no sistema são sagrados e devem ser mantidos intactos em suas respectivas organizações.
   - Qualquer massa de dados demonstrativa contendo novos perfis de time ou usuários de teste deve utilizar UUIDs gerados e e-mails de domínio fictício (ex: `@demo.com`), isolando-os no banco sem impactar as contas reais de produção.

## 🤖 Algoritmo e Regras da Stella IA
1. Sempre que for solicitada alguma alteração nas respostas, no comportamento ou nas regras cognitivas da Stella IA, consulte e siga rigorosamente o workflow/manual em [.agents/workflows/algoritmo-stella.md](file:///c:/Projetos/studio57so-v8/.agents/workflows/algoritmo-stella.md).
2. Qualquer mudança de comportamento da Stella IA deve ser documentada e refletida na matriz de eventos deste arquivo para manter a consistência histórica do projeto.

## 📊 Workflow de Relatório de Conversas (/relatorio-conversas)
1. Sempre que o usuário solicitar um relatório geral ou auditoria do andamento das conversas no WhatsApp e fases dos clientes, utilize e execute o workflow mapeado em [.agents/workflows/relatorio-conversas.md](file:///c:/Projetos/studio57so-v8/.agents/workflows/relatorio-conversas.md).

## 💎 Diretriz de Reutilização de RPCs (Banco de Dados)
1. Sempre que for solicitada a criação, modificação ou expansão de ferramentas do Servidor MCP ou lógicas que envolvam operações no banco de dados, você **deve** obrigatoriamente consultar o arquivo `functions.json` e as migrações em `supabase/migrations/` para verificar se já existe uma função (RPC) ou trigger correspondente criada.
2. Dê preferência absoluta a chamar a RPC nativa do banco de dados (ex: `auto_merge_contacts_and_relink`, `agendar_vale`, `marcar_pedido_entregue`) em vez de recriar a lógica com inserts/updates manuais no JavaScript do Next.js. Isso garante que a integridade das triggers e regras do banco seja preservada.

## 🔒 Restrição de Acesso a Credenciais e Banco de Dados (Segurança de Escopo)
1. **PROIBIÇÃO de Leitura do `.env.local`:** O agente está terminantemente proibido de ler o arquivo `.env.local` e de extrair qualquer credencial, segredo ou token do projeto (incluindo chaves do Supabase, como `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`).
2. **PROIBIÇÃO de Consultas Diretas ao Banco de Dados (Bypass de RLS):** O agente não pode criar scripts, comandos ou conexões locais diretas para ler ou escrever no banco de dados Supabase usando chaves de serviço ou privilégios elevados.
3. **Uso Exclusivo do Servidor MCP:** Toda e qualquer consulta, listagem ou alteração de dados de finanças, estoque, CRM, empreendimentos, etc. do sistema Elo 57 deve ser realizada estritamente através do **servidor MCP `elo57`**.
4. **Isolamento de Organização:** O agente deve interagir apenas com os dados e contas associados à organização pessoal do usuário (`rannierecampos1@gmail.com`), respeitando o escopo restrito de sua chave de API pessoal e nunca acessando ou expondo dados de outras organizações (como a Organização 2).


