---
description: Sincronizar schema e funções do banco Studio 57 para o Elo 57 (nunca dados)
---

# 🔄 Protocolo de Sincronização de Banco de Dados
**Studio 57 (dev) → Elo 57 (produção)**

> ⚠️ **REGRA DE OURO:** Apenas **Schema** (tabelas/colunas), **Funções/RPCs** e **Políticas RLS** são sincronizados.
> Os **Dados dos clientes** no Elo 57 NUNCA são tocados.

---

## 🚨 REGRA CRÍTICA PARA O AGENTE DE IA

> **PROIBIDO** executar qualquer sincronização para o **Elo 57 (produção)** sem **autorização explícita e prévia do usuário Ranniere**.

O fluxo obrigatório é:
1. Fazer todas as alterações e testes no **Studio 57 (dev)** primeiro.
2. Verificar o estado atual do Elo 57.
3. **PARAR** e apresentar o resultado ao usuário antes de executar a migração.
4. Só executar após receber o **"sim"** explícito do usuário.

---

## 🔁 Direção Sempre Correta

```
Studio 57 (vhuvnutzklhskkwbpxdz) ──ORIGEM──▶ Elo 57 (alqzomckjnefsmhusnfu)
```

---

## ✅ MÉTODO OFICIAL (Sem Docker)

> **Este é o método padrão do projeto.** Não usar `supabase db dump` (requer Docker).  
> Usar o script `supabase/migrar-studio-elo.js` que se conecta diretamente ao PostgreSQL.

### O que o script sincroniza (em ordem):
1. **Funções/RPCs** — todas as funções `public` do Studio são criadas/atualizadas no Elo.
2. **RLS Enable** — habilita Row Level Security em todas as tabelas com RLS no Studio.
3. **Políticas RLS** — todas as policies são dropadas e recriadas identicamente.
4. **Colunas Novas** — colunas que existem no Studio mas faltam no Elo são adicionadas.
5. **Tabelas Novas** — tabelas que só existem no Studio são criadas no Elo.

---

## PASSO A PASSO

### Passo 1 — Verificar o estado atual do Elo 57

// turbo
```
node supabase/check-elo.js
```

Leia o output e verifique:
- Quantidade de tabelas no Elo 57
- Super Admin está ok

---

### Passo 2 — ⛔ AGUARDAR APROVAÇÃO DO USUÁRIO

**NÃO EXECUTE O PRÓXIMO PASSO SEM APROVAÇÃO EXPLÍCITA.**

Mostre ao usuário o resultado da verificação e pergunte:
> *"Posso aplicar a sincronização completa (Schema + Funções + RLS) no Elo 57 (produção) agora?"*

---

### Passo 3 — Executar a migração completa (SOMENTE após aprovação)

// turbo
```
node supabase/migrar-studio-elo.js
```

O script vai:
1. Sincronizar **Funções/RPCs**
2. Habilitar **RLS** nas tabelas
3. Replicar todas as **Políticas de Segurança**
4. Adicionar **Colunas/Tabelas** novas
5. Salvar o resultado em `supabase/migrations/YYYYMMDD_full_sync.sql`

---

### Passo 4 — Confirmar o resultado

// turbo
```
node supabase/check-elo.js
```

Resultado esperado:
- ✅ Total de tabelas igual ao Studio 57
- ✅ Super Admin encontrado

---

### Passo 5 — Commitar a migration gerada

```
git add supabase/migrations/ supabase/migrar-studio-elo.js
git commit -m "sync: migração completa Studio → Elo (Schema + RLS + Funções)"
git push
```

---

## 🆘 Problemas Comuns

| Problema | Causa | Solução |
|---|---|---|
| `relation does not exist` em policies | Tabela ainda não existe no Elo | Normal em tabelas novas — o script cria a tabela primeiro e re-aplica o RLS |
| Erro de conexão | Senha ou URL incorreta | Verificar `SUPABASE_DB_PASSWORD` no `.env.local` |
| Função com erro | Dependência de extensão | Verificar se a extensão está habilitada no Elo 57 |

---

## 📁 Scripts Disponíveis

| Script | Função |
|---|---|
| `supabase/migrar-studio-elo.js` | **✅ MÉTODO OFICIAL** — Sincroniza Funções + RLS + Colunas |
| `supabase/check-elo.js` | **Verifica** o estado atual do Elo 57 |
| `supabase/sync-schema.js` | Gera relatório de diferenças de colunas (não aplica) |
| `supabase/dump-schema-rls.js` | Gera arquivo SQL de backup do Studio 57 |

---

## 🔐 Credenciais (não comitar no git)

- **Senha do banco:** `SUPABASE_DB_PASSWORD` no `.env.local`
- **Studio URL:** `https://vhuvnutzklhskkwbpxdz.supabase.co`
- **Elo URL:** `https://alqzomckjnefsmhusnfu.supabase.co`
- **Painel Studio:** `supabase.com/dashboard/project/vhuvnutzklhskkwbpxdz`
- **Painel Elo 57:** `supabase.com/dashboard/project/alqzomckjnefsmhusnfu`
