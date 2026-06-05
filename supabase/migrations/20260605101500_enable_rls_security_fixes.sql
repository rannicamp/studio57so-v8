-- SCRIPT DE CORREÇÃO DE SEGURANÇA: Habilitação de RLS e Criação de Políticas

-- ==========================================
-- 1. Tabela: public.organizacoes
-- ==========================================
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "rls_select_organizacoes_policy" ON public.organizacoes;
DROP POLICY IF EXISTS "rls_insert_organizacoes_policy" ON public.organizacoes;
DROP POLICY IF EXISTS "rls_update_organizacoes_policy" ON public.organizacoes;
DROP POLICY IF EXISTS "rls_delete_organizacoes_policy" ON public.organizacoes;

-- Política de leitura: Qualquer usuário autenticado só pode ler a sua própria organização OU a organização matriz 1
CREATE POLICY "rls_select_organizacoes_policy" ON public.organizacoes
FOR SELECT
TO authenticated
USING (id = public.get_auth_user_org() OR id = 1);

-- Política de inserção: Usuários normais não podem criar organizações diretamente
CREATE POLICY "rls_insert_organizacoes_policy" ON public.organizacoes
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Política de atualização: Pode atualizar os dados da própria organização
CREATE POLICY "rls_update_organizacoes_policy" ON public.organizacoes
FOR UPDATE
TO authenticated
USING (id = public.get_auth_user_org())
WITH CHECK (id = public.get_auth_user_org());

-- Política de exclusão: Usuários normais não podem excluir organizações
CREATE POLICY "rls_delete_organizacoes_policy" ON public.organizacoes
FOR DELETE
TO authenticated
USING (false);


-- ==========================================
-- 2. Tabela: public.meta_ativos
-- ==========================================
ALTER TABLE public.meta_ativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_select_meta_ativos_policy" ON public.meta_ativos;
DROP POLICY IF EXISTS "rls_insert_meta_ativos_policy" ON public.meta_ativos;
DROP POLICY IF EXISTS "rls_update_meta_ativos_policy" ON public.meta_ativos;
DROP POLICY IF EXISTS "rls_delete_meta_ativos_policy" ON public.meta_ativos;

CREATE POLICY "rls_select_meta_ativos_policy" ON public.meta_ativos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

CREATE POLICY "rls_insert_meta_ativos_policy" ON public.meta_ativos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

CREATE POLICY "rls_update_meta_ativos_policy" ON public.meta_ativos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

CREATE POLICY "rls_delete_meta_ativos_policy" ON public.meta_ativos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());


-- ==========================================
-- 3. Tabela: public.sync_queue
-- ==========================================
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_select_sync_queue_policy" ON public.sync_queue;
DROP POLICY IF EXISTS "rls_insert_sync_queue_policy" ON public.sync_queue;
DROP POLICY IF EXISTS "rls_update_sync_queue_policy" ON public.sync_queue;
DROP POLICY IF EXISTS "rls_delete_sync_queue_policy" ON public.sync_queue;

CREATE POLICY "rls_select_sync_queue_policy" ON public.sync_queue
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

CREATE POLICY "rls_insert_sync_queue_policy" ON public.sync_queue
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

CREATE POLICY "rls_update_sync_queue_policy" ON public.sync_queue
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

CREATE POLICY "rls_delete_sync_queue_policy" ON public.sync_queue
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());


-- ==========================================
-- 4. Tabela: public.temp_debug_logs
-- ==========================================
ALTER TABLE public.temp_debug_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_select_temp_debug_logs_policy" ON public.temp_debug_logs;
DROP POLICY IF EXISTS "rls_insert_temp_debug_logs_policy" ON public.temp_debug_logs;
DROP POLICY IF EXISTS "rls_update_temp_debug_logs_policy" ON public.temp_debug_logs;
DROP POLICY IF EXISTS "rls_delete_temp_debug_logs_policy" ON public.temp_debug_logs;

CREATE POLICY "rls_select_temp_debug_logs_policy" ON public.temp_debug_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "rls_insert_temp_debug_logs_policy" ON public.temp_debug_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "rls_update_temp_debug_logs_policy" ON public.temp_debug_logs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "rls_delete_temp_debug_logs_policy" ON public.temp_debug_logs
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
