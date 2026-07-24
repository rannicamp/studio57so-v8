# Relatório de Bugs — Ferramentas de listagem do MCP Elo 57

Encontrados pela auditoria black-box (`elo57-auditor-de-seguranca`) e confirmados lendo o código-fonte (`app/api/mcp/route.js`) e o schema do banco (`supabase/dbelo57.sql`). São bugs de **funcionalidade** (colunas/relacionamentos incorretos), não falhas de segurança — as ferramentas falham com erro em vez de vazar dado.

---

## Bug 1 — `listar_itens_orcamento` e `adicionar_item_orcamento`: coluna `custo_unitario` não existe

**Erro reportado:** `column orcamento_itens.custo_unitario does not exist`

**Causa raiz:** o código usa o nome de coluna `custo_unitario`, mas a tabela `orcamento_itens` no banco tem a coluna **`preco_unitario`** (confirmado em `supabase/dbelo57.sql`, linha 1322).

**Onde corrigir — `app/api/mcp/route.js`:**

```js
// linha 1976-1990 — listar_itens_orcamento
case 'listar_itens_orcamento': {
  const { orcamento_id } = args;
  const { data, error } = await supabase
    .from('orcamento_itens')
    .select(`
      id, 
      quantidade, 
      custo_unitario,   // ❌ trocar por: preco_unitario
      material:materiais(id, nome, unidade_medida)
    `)
    .eq('orcamento_id', orcamento_id);
  ...
}
```

```js
// linha 1992-2006 — adicionar_item_orcamento
case 'adicionar_item_orcamento': {
  const { orcamento_id, material_id, quantidade, valor_unitario } = args;
  const { data, error } = await supabase
    .from('orcamento_itens')
    .insert({
      orcamento_id,
      material_id,
      quantidade,
      custo_unitario: valor_unitario,  // ❌ trocar chave por: preco_unitario: valor_unitario
      organizacao_id: user.organizacao_id
    })
    ...
}
```

**Correção:** trocar `custo_unitario` por `preco_unitario` nos dois lugares (o parâmetro de entrada `valor_unitario` da ferramenta pode continuar com esse nome — é só o nome da coluna do banco que está errado).

---

## Bug 2 — `listar_unidades_empreendimento`: coluna `bloco` não existe

**Erro reportado:** `column produtos_empreendimento.bloco does not exist`

**Causa raiz:** a tabela `produtos_empreendimento` **não tem coluna `bloco`** (schema atual, linhas 1486-1500): `id, empreendimento_id, tipo, unidade, area_m2, valor_base, fator_reajuste_percentual, valor_venda_calculado, status, created_at, organizacao_id, matricula, preco_m2`.

**Onde corrigir — `app/api/mcp/route.js`, linha 3218-3232:**

```js
case 'listar_unidades_empreendimento': {
  const { empreendimento_id } = args;
  let query = supabase
    .from('produtos_empreendimento')
    .select('id, unidade, bloco, area_m2, valor_base, valor_venda_calculado, status, empreendimento_id')
    // ❌ 'bloco' não existe
    .order('unidade');
  ...
}
```

**Duas opções de correção:**
1. Se "bloco" é um dado que deveria existir (ex: bloco/torre de um condomínio), criar a coluna via migração (`ALTER TABLE produtos_empreendimento ADD COLUMN bloco text;`) e ajustar a UI/fluxo que a alimenta.
2. Se não é mais necessário, remover `bloco` da lista de `.select(...)` nessa ferramenta.

Recomendo confirmar com o time se essa coluna é esperada em algum lugar da aplicação (frontend) antes de decidir entre as duas opções.

---

## Bug 3 — `listar_leads_funil`: ambiguidade de relacionamento entre `contatos_no_funil` e `contatos`

**Erro reportado:** `Could not embed because more than one relationship was found for 'contatos_no_funil' and 'contatos'`

**Causa raiz (mais provável, a confirmar):** a tabela `contatos_no_funil` tem mais de uma coluna que referencia `contatos` — pelo menos `contato_id` (o lead em si) e possivelmente `corretor_id` (se o corretor também for um registro em `contatos`). O PostgREST, ao montar o embed `contato:contatos(...)`, não consegue decidir automaticamente qual chave estrangeira usar quando existe mais de uma ligação entre as duas tabelas.

**Onde está — `app/api/mcp/route.js`, linha 1687-1699:**

```js
case 'listar_leads_funil': {
  const { data, error } = await supabase
    .from('contatos_no_funil')
    .select(`
      id,
      contato:contatos(id, nome, celular, status),  // ❌ ambíguo
      coluna:funil_colunas(id, nome, ordem),
      created_at
    `);
  ...
}
```

**Correção:** especificar explicitamente qual chave estrangeira usar no embed, com a sintaxe do PostgREST/Supabase (`nome_da_fk!coluna_fk`), por exemplo:

```js
.select(`
  id,
  contato:contatos!contatos_no_funil_contato_id_fkey(id, nome, celular, status),
  coluna:funil_colunas(id, nome, ordem),
  created_at
`);
```

(o nome exato da constraint — `contatos_no_funil_contato_id_fkey` ou o que estiver definido no banco — precisa ser confirmado direto no Supabase, já que o dump de schema local não trouxe os nomes de constraint de FK dessa tabela).

---

## Resumo

| # | Ferramenta | Causa | Correção |
|---|---|---|---|
| 1 | `listar_itens_orcamento`, `adicionar_item_orcamento` | Nome de coluna errado: `custo_unitario` → deveria ser `preco_unitario` | Trocar o nome da coluna no código |
| 2 | `listar_unidades_empreendimento` | Coluna `bloco` não existe na tabela | Criar a coluna (se necessária) ou remover do `select` |
| 3 | `listar_leads_funil` | Embed ambíguo entre `contatos_no_funil` e `contatos` (mais de uma FK) | Especificar a FK explicitamente no `.select()` |

Nenhum desses bugs expõe ou mistura dado de outra organização — eles falham com erro (comportamento seguro), só impedem o uso normal dessas 3 ferramentas.
