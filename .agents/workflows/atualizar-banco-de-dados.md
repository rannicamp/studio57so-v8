---
description: Atualiza o schema local do banco (dbelo57.sql e functions.json) com o estado mais recente do Supabase
---

# Workflow: Atualizar Banco de Dados

Use este workflow sempre que:
- Tiver feito alterações estruturais no banco via Supabase Dashboard (novas colunas, tabelas, funções RPC)
- Precisar consultar a estrutura atual de uma tabela antes de escrever SQL ou migrations
- Quiser confirmar que uma migração foi aplicada corretamente

## Passo a passo

1. **Execute o script de exportação** para atualizar os arquivos locais:

// turbo
```bash
node scripts/exportar-db.cjs
```

Isso irá:
- Gerar o `dbelo57.sql` com a estrutura (`CREATE TABLE`) de todas as tabelas do banco público
- Gerar o `functions.json` com todas as funções RPC (`routine_name`, `routine_definition`)

2. **Verifique se a alteração aparece no arquivo:**
   - Para verificar uma coluna específica, use `grep_search` no `dbelo57.sql`
   - Exemplo: buscar `contato_id` no arquivo para confirmar que a coluna existe e o tipo está correto (`BIGINT` ou `UUID`)

3. **Consulte o tipo correto ANTES de escrever SQL:**
   - Abra `dbelo57.sql` e localize a tabela alvo
   - Identifique o tipo do campo de chave primária (`id`) — pode ser `bigint` (número) ou `uuid`
   - Use esse tipo exato nas FKs, queries e na API do Next.js

4. **Faça o commit dos arquivos atualizados:**

```bash
git add dbelo57.sql functions.json
git commit -m "chore(db): atualiza schema dbelo57.sql e functions.json"
git push
```

## Regra de Ouro

> ⚠️ **NUNCA assuma o tipo de um campo** sem conferir o `dbelo57.sql` primeiro.
> O projeto usa `BIGINT` para a maioria dos IDs da tabela `contatos`, mas `UUID` para tabelas mais novas (ex: `funis`, `historico_movimentacao_funil`).
> Misturar os tipos causa erros de FK como `incompatible types: uuid and bigint`.

## Como o script funciona internamente

O script `scripts/exportar-db.cjs` conecta ao banco (porta `6543`) e:
- Consulta `information_schema.columns` para montar o esquema pseudo-SQL de cada tabela
- Consulta `information_schema.routines` para extrair o código-fonte das funções RPC
- Salva os resultados localmente sobrescrevendo `dbelo57.sql` e `functions.json`
