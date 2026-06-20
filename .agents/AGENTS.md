# Regras do Projeto Studio 57 / Elo 57

## 🚀 Protocolo de Teste e Deploy (Regra de Ouro)
1. **PROIBIDO fazer deploy/push prematuro:** Nunca faça `git push` ou acione deploys automáticos no GitHub antes de rodar o servidor de desenvolvimento local e testar as novas funcionalidades implementadas.
2. **Fluxo de Trabalho Obrigatório:**
   - **Passo 1:** Codificar as alterações solicitadas pelo usuário.
   - **Passo 2:** Iniciar e rodar o servidor local (ex: `npm run dev`) e testar as novas telas e APIs.
   - **Passo 3:** Apresentar as mudanças e colher o feedback do usuário ("seu lindo") para que ele também teste em ambiente local.
   - **Passo 4:** Somente após a **aprovação explícita** dele localmente, prosseguir com o commit e push para o repositório remoto.
