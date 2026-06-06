---
name: "Resolver Erro de Cache de Schema (PGRST204)"
description: "Como a IA deve diagnosticar e resolver erros de colunas não encontradas no Supabase após alterações no banco de dados via SQL."
---

# Resolver Erro de Cache de Schema (PGRST204) no Supabase

Esta skill deve ser ativada **automaticamente** sempre que a IA identificar que o usuário adicionou ou alterou colunas no banco de dados via SQL Editor, e logo em seguida o sistema Frontend retornar erros semelhantes a:
- `Could not find the 'NOME_DA_COLUNA' column of 'NOME_DA_TABELA' in the schema cache`
- Erro `PGRST204`

## 1. O que causa esse erro?
O motor de API do Supabase (PostgREST) mantém um cache estático da estrutura (schema) do banco de dados para garantir alta performance. Quando alterações são feitas diretamente via DDL (como `ALTER TABLE`, `CREATE TABLE` ou adição de novas funções/RPCs) através do SQL Editor, a API **não atualiza seu cache automaticamente**. Como resultado, ela rejeita requisições do frontend que tentam ler ou escrever nessas novas estruturas.

## 2. Protocolo de Resolução da IA

### Passo A: Identificação Rápida
Assim que a IA identificar a string `schema cache` nos logs de erro ou no relato do usuário, ela não deve investigar o código frontend ou sugerir refatorações nos componentes. O problema é exclusivo do banco de dados.

### Passo B: Instrução ao Usuário (Código de Cura)
A IA deve fornecer imediatamente o comando mágico de recarregamento do cache e instruir o usuário a executá-lo no **SQL Editor do Supabase**.

```sql
-- Recarrega o cache interno do PostgREST sem derrubar a API
NOTIFY pgrst, 'reload schema';
```

### Passo C: Como explicar para o usuário (A Analogia do Recepcionista)
Para manter o padrão didático e carinhoso do projeto (Persona Devonildo), a IA deve sempre explicar o "porquê" do erro usando a seguinte analogia caso o usuário pergunte:

> "Imagine que o nosso Banco de Dados é um grande armazém. O Supabase tem um 'Recepcionista' (a API) que tira uma foto de como as prateleiras estão organizadas quando ele chega para trabalhar. Quando nós criamos uma prateleira nova lá no fundo usando código SQL, nós não avisamos o recepcionista! O comando `NOTIFY pgrst, 'reload schema'` é basicamente a gente tocando o sininho do balcão e pedindo para ele tirar uma foto nova do armazém."

## 3. Prevenção (Boas Práticas da IA)
Sempre que a IA gerar um script SQL contendo comandos `ALTER TABLE` ou `CREATE OR REPLACE FUNCTION` para o usuário rodar no Supabase, a IA **DEVE OBRIGATORIAMENTE** incluir o comando `NOTIFY pgrst, 'reload schema';` no final do script gerado, poupando o usuário de enfrentar esse erro no futuro.
