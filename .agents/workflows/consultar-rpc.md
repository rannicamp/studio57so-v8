---
description: Como consultar e visualizar o código-fonte de funções (RPCs) no Supabase diretamente pelo terminal
---

# Fluxo para Consulta de RPCs no Banco de Dados

Sempre que houver dúvida sobre como uma regra de negócio está sendo tratada no banco de dados (ex: cálculos de extrato, rotamento de leads, etc.), nós devemos consultar o código-fonte da função (RPC) diretamente no PostgreSQL antes de tentar adivinhar ou reescrever a lógica no frontend.

## Por que fazer isso?
Muitas mágicas do Studio 57 acontecem direto no banco de dados (via Postgres Functions). Se não consultarmos a RPC base, corremos o risco de criar lógicas duplicadas ou conflitantes.

## Ferramenta Oficial: Script de Consulta

Em vez de criar scripts do zero toda vez, sempre utilize o script padrão localizado no projeto (se ele não existir, você deve criá-lo).

### 1. Script Padrão de Leitura (`supabase/consultar-rpc.mjs`)
Este script deve ser capaz de receber o nome exato de uma função e imprimir o seu código SQL completo no terminal.

**Como criar/reaproveitar o script:**
Ele deve usar o pacote `pg` do Node e se conectar ao banco de desenvolvimento (Studio 57).

**A Query SQL interna deve ser:**
```sql
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
  AND specific_schema = 'public'
  AND routine_name = $1;
```

### 2. Passo a passo do Workflow

1. **Identifique a necessidade:** O Ranniere pediu para mexer numa lógica (ex: "lançamento pai da fatura") e você desconfia que já existe uma função que agrupa os dados de outro jeito (ex: `get_extrato_conta`).
2. **Consulte a função:**
   ```bash
   // turbo
   node supabase/consultar-rpc.mjs nome_da_funcao
   ```
3. **Analise o resultado:** Leia o código SQL retornado para entender quais tabelas ele acessa, se ele filtra `is_transfer`, como faz agupamentos (`GROUP BY`), e o quê exatamente ele retorna.
4. **Planeje em cima da verdade:** Com a lógica do banco em mãos, crie o plano de ação no seu `.md` de planejamento.

## Regras de Ouro do Devonildo para RPCs

- **Leitura é Segura:** Fazer `SELECT routine_definition` não quebra nada. Pode rodar à vontade para escovar código!
- **Alteração é Sensível:** NUNCA modifique uma RPC (usando `CREATE OR REPLACE`) sem documentar a versão antiga. Se for sugerir uma mudança, entregue ao Ranniere o bloco SQL COMPLETO da nova função.
- **Se não souber o nome da função:** Crie rapidamente um script (ou adapte o de consulta) para ler `routine_name` usando `ILIKE '%palavra_chave%'` para encontrar a função perdida no banco.
