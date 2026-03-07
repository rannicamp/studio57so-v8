const fs = require('fs');
const path = require('path');

const sqlFile = fs.readFileSync('dbelo57.sql', 'utf8');
const lines = sqlFile.split('\n');

const tables = [];
let currentTable = null;

// Tentar identificar e ignorar views
const ignoredTables = ['latest_ad_snapshots', 'vw_', 'view_'];

for (const line of lines) {
    if (line.startsWith('CREATE TABLE public.')) {
        currentTable = line.split(' ')[2].replace('public.', '').split(' (')[0].trim();
    } else if (line.includes('organizacao_id') && currentTable) {
        tables.push(currentTable);
        currentTable = null;
    } else if (line.includes(');') && currentTable) {
        currentTable = null;
    }
}

// Filtra para remover duplicados e ignorar as views conhecidas
const uniqueTables = [...new Set(tables)].filter(t => !ignoredTables.some(ig => t.includes(ig)));

let outSql = `-- SCRIPT PARA ATIVAR RLS GLOBAL (Organização do Usuário + Org 1 Pública)
-- IMPORTANTE: Rode este script no Editor SQL (SQL Editor) do Painel do Supabase.

-- 1. Cria a função segura que pega a organização do usuário logado sem causar loop infinito
CREATE OR REPLACE FUNCTION public.get_auth_user_org()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id bigint;
BEGIN
  SELECT organizacao_id INTO v_org_id FROM public.usuarios WHERE id = auth.uid();
  RETURN v_org_id;
END;
$$;

-- 2. Aplica o RLS em todas as tabelas com organizacao_id
-- (A tabela 'latest_ad_snapshots' foi removida pois é uma View)
`;

for (const t of uniqueTables) {
    outSql += `
-- Tabela: ${t}
ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.${t};
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.${t};
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.${t};
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.${t};
DROP POLICY IF EXISTS "rls_org_policy" ON public.${t};

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.${t}
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.${t}
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.${t}
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.${t}
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());
`;
}

fs.writeFileSync('supabase/aplicar_rls_global.sql', outSql, 'utf8');
console.log(`Script 'aplicar_rls_global.sql' gerado com sucesso para ${uniqueTables.length} tabelas!`);
