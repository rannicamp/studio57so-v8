---
description: Como exportar e atualizar o esquema do banco (dbelo57.sql) e funções (functions.json)
---

# Fluxo para Exportação do Banco de Dados

Sempre que fizermos alterações estruturais no banco de dados do Studio 57 (como adicionar colunas, criar novas tabelas ou editar funções RPC), é uma ótima prática mantermos os arquivos estruturais locais atualizados na raiz do projeto.

## Arquivos Gerados
1. **`dbelo57.sql`**: Um arquivo SQL contendo a estrutura básica das tabelas do sistema na raiz do projeto.
2. **`functions.json`**: Um arquivo JSON contendo o nome e o código-fonte de todas as funções (RPCs) daquele banco.

## Ferramenta Oficial: Script de Exportação
Nós utilizamos um script Node.js customizado que se conecta ao banco de dados `Studio 57 (dev)`, lê a estrutura atual e sobrescreve esses dois arquivos de forma totalmente automática.

### Passo a Passo do Workflow

1. **Abra o terminal na raiz do projeto.**
2. **Execute o script de exportação:**
   
```bash
// turbo
node supabase/exportar-db.cjs
```

3. **Verifique os arquivos:**
   Abra os arquivos `dbelo57.sql` e `functions.json` na sua IDE. Confira se as suas últimas mudanças (como aquela nova coluna adicionada ontem) estão ali.
   
4. **Commit:**
   Sempre faça o commit desses arquivos! Eles servem como um "mapa" para o Devonildo ou para você mesmo quando forem consultar como o banco está configurado atualmente, sem precisarem acessar o painel do Supabase.

## Como o script funciona por baixo dos panos?
- Para o **JSON de funções**, ele faz uma consulta em `information_schema.routines` buscando tudo com `routine_type = 'FUNCTION'` no esquema `public` e salva num objeto limpo.
- Para o **SQL**, ele faz uma consulta em `information_schema.columns`, itera tabela a tabela e monta declarações pseudo-SQL em formato legível mostrando os nomes das colunas, tipos de dados, se aceita nulos (`NOT NULL`) e valores `DEFAULT`.
