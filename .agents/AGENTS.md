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

## 🤖 Algoritmo e Regras da Stella IA
1. Sempre que for solicitada alguma alteração nas respostas, no comportamento ou nas regras cognitivas da Stella IA, consulte e siga rigorosamente o workflow/manual em [.agents/workflows/algoritmo-stella.md](file:///c:/Projetos/studio57so-v8/.agents/workflows/algoritmo-stella.md).
2. Qualquer mudança de comportamento da Stella IA deve ser documentada e refletida na matriz de eventos deste arquivo para manter a consistência histórica do projeto.
