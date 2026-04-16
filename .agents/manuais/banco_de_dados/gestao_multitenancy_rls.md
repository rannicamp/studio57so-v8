---
description: Como funciona a relação entre a organização_id no Frontend e as regras de RLS no Supabase para Multi-Tenancy (SaaS)
---

# Regras de Multi-Tenancy e RLS (Row Level Security)

Este guia documenta o padrão ouro de segurança e filtragem de dados para o sistema SaaS Multi-Tenant (Múltiplas Organizações) do Studio 57 / Elo 57.

Embora o Supabase possua **RLS (Row Level Security)** que protege os dados em nível de banco de dados, o Frontend precisa atuar em conjunto com o Backend para evitar vazamento de informações e garantir agilidade, especialmente diante da regra global da "Organização Matriz (ID: 1)".

## 1. O Papel do RLS (O Cofre Forte)

No Supabase, as políticas de segurança (RLS) são escritas diretamente no banco de dados.
Isso significa que, mesmo que um desenvolvedor mal intencionado (ou um robô) faça um `supabase.from('contatos').select('*')` (sem Nenhum filtro `eq`), o banco de dados vai interceptar essa requisição antes de devolver os dados e aplicar automaticamente uma "capa" de segurança:

```sql
-- Exemplo mental da Regra RLS atual:
-- O usuário logado SÓ pode ler os dados se estiverem na sua Organização
-- OU se os dados pertencerem à Organização Global (Elo 57 - ID: 1)
(organizacao_id = get_auth_user_org() OR organizacao_id = 1)
```

**Por que isso não é o suficiente?**
Muitas desenvolvedores confiam cegamente no RLS. Porém, confiar 100% no RLS pode gerar bugs na interface de usuário. Se você faz buscas globais usando RPCs customizados (Ex: `.rpc('filtrar_ids_contatos')` ou faz um `.in` gigante, você passa a depender também dos filtros via Frontend.

## 2. O Papel do Frontend (O Recepcionista)

O Frontend **deve** passar a `organizacaoId` de forma redundante e colaborativa. Sempre extraia o `organizacao_id` do Usuário através do contexto local:

### 🌟 No Next.js App Router (Client Components):
```javascript
import { useAuth } from '@/contexts/AuthContext';
// ...
const { user } = useAuth();
const organizacaoId = user?.organizacao_id;

// ✅ O que FAZER (Filtrando explicitamente no Frontend para ajudar a base extrair só sua "org"):
const { data } = await supabase
    .from('contatos')
    .select('*')
    .in('organizacao_id', [organizacaoId, 1]); // Traz os da Org logada E os da Elo57 (1 - Global)
```

### 🚨 Onde ocorrem as falhas:
1. **Esquecer de incluir o Global (ID: 1):**
   Se o JS fizer `.eq('organizacao_id', organizacaoId)`, ele filtrará com **exclusividade** os dados daquele inquilino. O RLS permitiria que o contato Global via ID=1 entrasse, mas o JavaScript está ativamente o descartando antes!
2. **Uso Indevido em Componentes Desacoplados:**
   Modais, Cartões e Sidebars frequentemente perdem a `organizacaoId` se ela não for repassada explicitamente via Contexto ou props. Sem ela `(undefined)`, a consulta perde performance e quebra lógicas em componentes de buscas.
3. **Assinaturas da RPC (Remote Procedure Call):**
   Funções escritas no PostgreSQL (.rpc) frequentemente **não herdam** a RLS automaticamente dependendo do contexto (`SECURITY DEFINER` vs `SECURITY INVOKER`). Isso significa que a RPC tem que fazer `WHERE c.organizacao_id = p_organizacao_id` em sua própria construção e, muitas vezes, esquecem do `OR c.organizacao_id = 1`.

## 3. Workflow Rápido para Auditoria

Sempre que a IA ou o Ranniere trabalharem em uma nova tabela Saas ou módulo de busca:

1. **Pegue a Identidade:** Descubra de onde o componente pai está puxando o `user?.organizacao_id` (Geralmente via `useLayout`, `useAuth` ou recebendo via `props`).
2. **Defina a Consulta JS:** Adonize a consulta. O componente é listagem misturada (dados da franqueadora Elo57 + franquiado)? Se for público para leitura, aplique `.in('organizacao_id', [organizacaoId, 1])`. Se for privado e estrito à loja logada, use `.eq('organizacao_id', organizacaoId)`.
3. **RPCs e Edge Functions:** Avalie o código-fonte SQL. Uma função estática no Postgres deve saber lidar com a organização ou herdar perfeitamente a segurança através de `auth.uid()`.

---

> Essa dupla camada (Database interceptando o macro, Frontend filtrando as abas e o escopo exato) é o segredo de ouro para arquiteturas SaaS sem falhas de cruzamento de dados.
