# 📘 Manual de Sincronização de Banco de Dados
## Studio 57 (Dev) → Elo 57 (Produção)

> **Versão:** 1.0 | **Criado em:** Março 2026

---

## 🧭 Entenda o Ecossistema

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│        🔬 STUDIO 57          │         │         🏢 ELO 57            │
│   (Desenvolvimento/Lab)      │         │   (Produção dos Clientes)    │
│                              │         │                              │
│  vhuvnutzklhskkwbpxdz        │ ──────▶ │  alqzomckjnefsmhusnfu        │
│                              │ Schema  │                              │
│  • Onde você testa           │ Funções │  • O que os clientes usam    │
│  • Onde você desenvolve      │  NUNCA  │  • Dados reais e privados    │
│  • Dados de exemplo/teste    │  Dados  │  • Dados ISOLADOS            │
└─────────────────────────────┘         └─────────────────────────────┘
```

> **Lei de Ouro:** O Studio é a fonte da verdade para o **código**. O Elo é a fonte da verdade para os **dados dos clientes**.

---

## 🚦 Quando Sincronizar?

Sincronize o banco sempre que fizer uma das seguintes alterações no Studio 57:

- ✅ Criou uma nova tabela
- ✅ Adicionou uma nova coluna em uma tabela existente
- ✅ Criou ou modificou uma Função/RPC no SQL Editor do Supabase
- ✅ Criou ou modificou uma Trigger
- ✅ Precisa ativar um novo usuário como Super Admin no Elo 57

---

## 🗂️ Pré-requisitos

Antes de começar, confirme que você tem:

- [ ] Node.js instalado (`node --version`)
- [ ] Biblioteca `pg` instalada (`npm install pg`)
- [ ] Acesso ao terminal no diretório `c:\projetos\studio57so-v8-main`
- [ ] Os scripts na pasta `supabase/` atualizados

---

## 📋 Protocolo Passo a Passo

### ◆ Passo 1 — Verifique o estado atual

Antes de qualquer coisa, veja a situação atual do Elo 57:

```powershell
node supabase/check-elo.js
```

**O que verificar na saída:**
- Quantidade de tabelas (deve ser igual ou menor que o Studio 57)
- Se as funções importantes existem
- Se o super admin está configurado

---

### ◆ Passo 2 — Gere o relatório de diferenças *(opcional)*

Para ver exatamente o que vai ser alterado **antes** de aplicar:

```powershell
node supabase/sync-schema.js
```

Abra o arquivo `supabase/sync_output.sql` e leia as alterações. Isso é como um "preview" — nada é alterado ainda.

---

### ◆ Passo 3 — Execute a sincronização principal ⭐

Este é o comando principal. Ele faz **tudo** automaticamente:

```powershell
node supabase/sync-final.js
```

**O que o script faz internamente:**

| Etapa | Ação |
|-------|------|
| **1 — Tabelas** | Cria tabelas novas no Elo e adiciona colunas faltantes |
| **2 — Funções** | Copia funções/RPCs do Studio que ainda não existem no Elo |
| **3 — Super Admin** | Garante que `rannierecampos1@hotmail.com` está como super admin |

**Tempo estimado:** 1 a 3 minutos

---

### ◆ Passo 4 — Confirme o sucesso

Rode a verificação novamente para garantir que tudo funcionou:

```powershell
node supabase/check-elo.js
```

**Resultado esperado:**
```
=== VERIFICAÇÃO DO ELO 57 ===
Total tabelas no Elo 57: 119 ✅
[AUTH] Usuario encontrado: rannierecampos1@hotmail.com ✅
[TABELA] Usuario na public.usuarios: { is_superadmin: true } ✅
Funcoes no Elo 57 (XX): ... ✅
```

---

### ◆ Passo 5 — Commit dos scripts *(se houve alterações nos scripts)*

```powershell
git add supabase/
git commit -m "sync: atualiza scripts de sincronização Studio → Elo"
git push
```

---

## 🗺️ Mapa dos Scripts

| Script | Para que serve | Quando usar |
|--------|---------------|-------------|
| `sync-final.js` | **Tudo em um** — sync completo | Seu comando principal |
| `check-elo.js` | Verificar o estado do Elo 57 | Antes e depois do sync |
| `sync-schema.js` | Gerar relatório de diferenças | Para revisar antes de aplicar |
| `apply-functions.js` | Aplicar apenas funções específicas | Quando só precisa de uma função |
| `mirror-db.js` | Mirror de extensões e funções | Uso avançado/emergência |

---

## 🔐 Credenciais e Painéis

| Ambiente | Projeto ID | Painel Admin |
|----------|-----------|--------------|
| **Studio 57** | `vhuvnutzklhskkwbpxdz` | [Abrir painel](https://supabase.com/dashboard/project/vhuvnutzklhskkwbpxdz) |
| **Elo 57** | `alqzomckjnefsmhusnfu` | [Abrir painel](https://supabase.com/dashboard/project/alqzomckjnefsmhusnfu) |

> 🔒 A senha do banco está em `.env.local` como `SUPABASE_DB_PASSWORD`

---

## 🆘 Solução de Problemas

### ❌ "Super Admin não aparece no Elo 57"
**Causa:** O usuário não foi criado no Auth do Elo 57 (os Auth são separados por projeto).

**Solução:**
1. Acesse o painel do Elo 57: `supabase.com/dashboard/project/alqzomckjnefsmhusnfu`
2. Vá em **Authentication → Users**
3. Clique em **Invite User** e insira o email
4. Rode novamente: `node supabase/sync-final.js`

---

### ❌ "column already exists"
**Causa:** A coluna já foi sincronizada em uma execução anterior.

**Solução:** Normal! O script usa `IF NOT EXISTS`, pode ignorar esta mensagem com segurança.

---

### ❌ Erro de conexão
**Causa:** Senha ou URL do banco incorreta.

**Solução:** 
1. Verifique `SUPABASE_DB_PASSWORD` no arquivo `.env.local`
2. Acesse o painel do Supabase e confirme que a senha bate

---

### ❌ Trigger não encontrada
**Causa:** Triggers precisam ser recriadas manualmente — elas são mais complexas que funções.

**Solução:** Copie o SQL da trigger do SQL Editor do Studio 57 e cole no SQL Editor do Elo 57.

---

## 🔄 Usando via Agente (IA)

Você pode simplesmente digitar no chat com a IA:

```
/espelhardb
```

E a IA executará todo o protocolo automaticamente para você! ✨

---

*Manual criado automaticamente pelo Devonildo com base na sessão de sincronização de 01/03/2026.*
