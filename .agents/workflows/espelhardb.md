---
description: Sincronizar schema e funções do banco Studio 57 para o Elo 57 (nunca dados)
---

# Protocolo de Sincronização de Banco de Dados
**Studio 57 (dev) → Elo 57 (produção)**

> ⚠️ **REGRA DE OURO:** Apenas **Schema** (tabelas/colunas) e **Funções/RPCs** são espelhados.
> Os **Dados dos clientes** no Elo 57 NUNCA são tocados.

---

## 🔁 Direção Sempre Correta

```
Studio 57 (vhuvnutzklhskkwbpxdz) ──ORIGEM──▶ Elo 57 (alqzomckjnefsmhusnfu)
```

---

## PASSO A PASSO

### Passo 1 — Verificar o estado atual dos dois bancos

// turbo
Execute o script de verificação para ver o que está diferente:

```
node supabase/check-elo.js
```

Leia o output e verifique:
- Quantidade de tabelas no Elo 57
- Se há funções faltando
- Se o usuário super admin está correto

---

### Passo 2 — Gerar o relatório de diferenças (opcional, para revisão)

// turbo
Execute o sync-schema para gerar um relatório SQL comparativo:

```
node supabase/sync-schema.js
```

Abra o arquivo `supabase/sync_output.sql` e revise as diferenças antes de aplicar.

---

### Passo 3 — Executar a sincronização completa

Execute o script principal. Ele faz as 3 etapas automaticamente:

```
node supabase/sync-final.js
```

O que acontece internamente:
1. **Etapa 1 – Schema:** Cria tabelas novas e adiciona colunas faltantes no Elo 57
2. **Etapa 2 – Funções:** Copia funções/RPCs do Studio para o Elo 57
3. **Etapa 3 – Super Admin:** Garante que o usuário `rannierecampos1@hotmail.com` existe como super admin

---

### Passo 4 — Confirmar o resultado

// turbo
Execute novamente a verificação para confirmar o sucesso:

```
node supabase/check-elo.js
```

Resultado esperado:
- ✅ Total de tabelas igual ao Studio 57
- ✅ Super Admin encontrado em `auth.users` e `public.usuarios`
- ✅ Funções listadas corretamente

---

### Passo 5 — Commitar os scripts atualizados (se houve mudanças nos scripts)

```
git add supabase/
git commit -m "sync: atualiza scripts de sincronização Studio → Elo"
git push
```

---

## 🆘 Problemas Comuns

| Problema | Causa | Solução |
|---|---|---|
| Super Admin não aparece no Elo 57 | Usuário não foi criado no Auth do Elo 57 | Acessar `supabase.com/dashboard/project/alqzomckjnefsmhusnfu` → Authentication → Invite User |
| Erro `column already exists` | Coluna já foi sincronizada antes | Normal, o script usa `IF NOT EXISTS`, pode ignorar |
| Erro de conexão | Senha ou URL incorreta | Verificar `SUPABASE_DB_PASSWORD` no `.env.local` |
| Função com erro | Dependência de extensão | Verificar se a extensão está habilitada no Elo 57 |

---

## 📁 Scripts Disponíveis

| Script | Função |
|---|---|
| `supabase/sync-final.js` | **Script principal** — Sincroniza tudo (schema + funções + super admin) |
| `supabase/sync-schema.js` | Apenas **gera o relatório** de diferenças (não aplica nada) |
| `supabase/check-elo.js` | **Verifica** o estado atual do Elo 57 |
| `supabase/apply-functions.js` | Aplica apenas **funções específicas** no Elo 57 |
| `supabase/mirror-db.js` | Mirror completo de funções e extensões |

---

## 🔐 Credenciais (não comitar no git)

- **Senha do banco:** `SUPABASE_DB_PASSWORD` no `.env.local`
- **Studio URL:** `https://vhuvnutzklhskkwbpxdz.supabase.co`
- **Elo URL:** `https://alqzomckjnefsmhusnfu.supabase.co`
- **Painel Studio:** `supabase.com/dashboard/project/vhuvnutzklhskkwbpxdz`
- **Painel Elo 57:** `supabase.com/dashboard/project/alqzomckjnefsmhusnfu`
