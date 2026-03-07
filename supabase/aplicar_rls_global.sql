-- SCRIPT PARA ATIVAR RLS GLOBAL (Organização do Usuário + Org 1 Pública)
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

-- Tabela: abono_tipos
ALTER TABLE public.abono_tipos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.abono_tipos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.abono_tipos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.abono_tipos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.abono_tipos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.abono_tipos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.abono_tipos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.abono_tipos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.abono_tipos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.abono_tipos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: abonos
ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.abonos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.abonos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.abonos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.abonos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.abonos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.abonos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.abonos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.abonos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.abonos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.activities;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.activities;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.activities;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.activities;
DROP POLICY IF EXISTS "rls_org_policy" ON public.activities;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.activities
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.activities
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.activities
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: activity_anexos
ALTER TABLE public.activity_anexos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.activity_anexos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.activity_anexos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.activity_anexos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.activity_anexos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.activity_anexos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.activity_anexos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.activity_anexos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.activity_anexos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.activity_anexos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: ai_planning_sessions
ALTER TABLE public.ai_planning_sessions ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.ai_planning_sessions;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.ai_planning_sessions;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.ai_planning_sessions;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.ai_planning_sessions;
DROP POLICY IF EXISTS "rls_org_policy" ON public.ai_planning_sessions;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.ai_planning_sessions
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.ai_planning_sessions
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.ai_planning_sessions
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.ai_planning_sessions
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: app_logs
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.app_logs;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.app_logs;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.app_logs;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.app_logs;
DROP POLICY IF EXISTS "rls_org_policy" ON public.app_logs;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.app_logs
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.app_logs
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.app_logs
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.app_logs
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: atividades_elementos
ALTER TABLE public.atividades_elementos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.atividades_elementos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.atividades_elementos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.atividades_elementos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.atividades_elementos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.atividades_elementos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.atividades_elementos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.atividades_elementos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.atividades_elementos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.atividades_elementos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: auditoria_ia_logs
ALTER TABLE public.auditoria_ia_logs ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.auditoria_ia_logs;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.auditoria_ia_logs;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.auditoria_ia_logs;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.auditoria_ia_logs;
DROP POLICY IF EXISTS "rls_org_policy" ON public.auditoria_ia_logs;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.auditoria_ia_logs
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.auditoria_ia_logs
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.auditoria_ia_logs
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.auditoria_ia_logs
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: automacoes
ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.automacoes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.automacoes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.automacoes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.automacoes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.automacoes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.automacoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.automacoes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.automacoes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.automacoes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: banco_arquivos_ofx
ALTER TABLE public.banco_arquivos_ofx ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.banco_arquivos_ofx;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.banco_arquivos_ofx;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.banco_arquivos_ofx;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.banco_arquivos_ofx;
DROP POLICY IF EXISTS "rls_org_policy" ON public.banco_arquivos_ofx;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.banco_arquivos_ofx
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.banco_arquivos_ofx
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.banco_arquivos_ofx
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.banco_arquivos_ofx
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: banco_de_horas
ALTER TABLE public.banco_de_horas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.banco_de_horas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.banco_de_horas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.banco_de_horas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.banco_de_horas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.banco_de_horas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.banco_de_horas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.banco_de_horas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.banco_de_horas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.banco_de_horas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: banco_transacoes_ofx
ALTER TABLE public.banco_transacoes_ofx ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.banco_transacoes_ofx;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.banco_transacoes_ofx;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.banco_transacoes_ofx;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.banco_transacoes_ofx;
DROP POLICY IF EXISTS "rls_org_policy" ON public.banco_transacoes_ofx;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.banco_transacoes_ofx
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.banco_transacoes_ofx
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.banco_transacoes_ofx
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.banco_transacoes_ofx
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: bim_notas
ALTER TABLE public.bim_notas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.bim_notas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.bim_notas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.bim_notas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.bim_notas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.bim_notas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.bim_notas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.bim_notas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.bim_notas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.bim_notas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: bim_notas_comentarios
ALTER TABLE public.bim_notas_comentarios ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.bim_notas_comentarios;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.bim_notas_comentarios;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.bim_notas_comentarios;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.bim_notas_comentarios;
DROP POLICY IF EXISTS "rls_org_policy" ON public.bim_notas_comentarios;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.bim_notas_comentarios
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.bim_notas_comentarios
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.bim_notas_comentarios
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.bim_notas_comentarios
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: bim_notas_elementos
ALTER TABLE public.bim_notas_elementos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.bim_notas_elementos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.bim_notas_elementos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.bim_notas_elementos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.bim_notas_elementos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.bim_notas_elementos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.bim_notas_elementos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.bim_notas_elementos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.bim_notas_elementos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.bim_notas_elementos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: bim_vistas_federadas
ALTER TABLE public.bim_vistas_federadas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.bim_vistas_federadas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.bim_vistas_federadas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.bim_vistas_federadas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.bim_vistas_federadas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.bim_vistas_federadas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.bim_vistas_federadas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.bim_vistas_federadas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.bim_vistas_federadas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.bim_vistas_federadas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: cadastro_empresa
ALTER TABLE public.cadastro_empresa ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.cadastro_empresa;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.cadastro_empresa;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.cadastro_empresa;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.cadastro_empresa;
DROP POLICY IF EXISTS "rls_org_policy" ON public.cadastro_empresa;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.cadastro_empresa
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.cadastro_empresa
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.cadastro_empresa
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.cadastro_empresa
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: campos_sistema
ALTER TABLE public.campos_sistema ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.campos_sistema;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.campos_sistema;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.campos_sistema;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.campos_sistema;
DROP POLICY IF EXISTS "rls_org_policy" ON public.campos_sistema;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.campos_sistema
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.campos_sistema
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.campos_sistema
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.campos_sistema
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: cargos
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.cargos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.cargos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.cargos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.cargos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.cargos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.cargos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.cargos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.cargos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.cargos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: categorias_financeiras
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "rls_org_policy" ON public.categorias_financeiras;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.categorias_financeiras
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.categorias_financeiras
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.categorias_financeiras
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.categorias_financeiras
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: chat_conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.chat_conversations;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.chat_conversations;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.chat_conversations;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.chat_conversations;
DROP POLICY IF EXISTS "rls_org_policy" ON public.chat_conversations;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.chat_conversations
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.chat_conversations
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.chat_messages;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.chat_messages;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.chat_messages;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.chat_messages;
DROP POLICY IF EXISTS "rls_org_policy" ON public.chat_messages;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.chat_messages
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.chat_messages
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.chat_messages
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: colunas_funil
ALTER TABLE public.colunas_funil ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.colunas_funil;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.colunas_funil;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.colunas_funil;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.colunas_funil;
DROP POLICY IF EXISTS "rls_org_policy" ON public.colunas_funil;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.colunas_funil
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.colunas_funil
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.colunas_funil
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.colunas_funil
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: conciliacao_historico
ALTER TABLE public.conciliacao_historico ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.conciliacao_historico;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.conciliacao_historico;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.conciliacao_historico;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.conciliacao_historico;
DROP POLICY IF EXISTS "rls_org_policy" ON public.conciliacao_historico;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.conciliacao_historico
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.conciliacao_historico
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.conciliacao_historico
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.conciliacao_historico
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: configuracoes_belvo
ALTER TABLE public.configuracoes_belvo ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.configuracoes_belvo;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.configuracoes_belvo;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.configuracoes_belvo;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.configuracoes_belvo;
DROP POLICY IF EXISTS "rls_org_policy" ON public.configuracoes_belvo;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.configuracoes_belvo
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.configuracoes_belvo
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.configuracoes_belvo
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.configuracoes_belvo
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: configuracoes_ia
ALTER TABLE public.configuracoes_ia ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.configuracoes_ia;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.configuracoes_ia;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.configuracoes_ia;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.configuracoes_ia;
DROP POLICY IF EXISTS "rls_org_policy" ON public.configuracoes_ia;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.configuracoes_ia
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.configuracoes_ia
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.configuracoes_ia
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.configuracoes_ia
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: configuracoes_venda
ALTER TABLE public.configuracoes_venda ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.configuracoes_venda;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.configuracoes_venda;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.configuracoes_venda;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.configuracoes_venda;
DROP POLICY IF EXISTS "rls_org_policy" ON public.configuracoes_venda;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.configuracoes_venda
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.configuracoes_venda
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.configuracoes_venda
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.configuracoes_venda
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: configuracoes_whatsapp
ALTER TABLE public.configuracoes_whatsapp ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.configuracoes_whatsapp;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.configuracoes_whatsapp;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.configuracoes_whatsapp;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.configuracoes_whatsapp;
DROP POLICY IF EXISTS "rls_org_policy" ON public.configuracoes_whatsapp;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.configuracoes_whatsapp
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.configuracoes_whatsapp
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.configuracoes_whatsapp
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.configuracoes_whatsapp
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contas_financeiras
ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contas_financeiras;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contas_financeiras;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contas_financeiras;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contas_financeiras;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contas_financeiras;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contas_financeiras
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contas_financeiras
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contas_financeiras
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contas_financeiras
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contatos
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contatos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contatos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contatos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contatos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contatos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contatos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contatos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contatos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contatos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contatos_no_funil
ALTER TABLE public.contatos_no_funil ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contatos_no_funil;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contatos_no_funil;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contatos_no_funil;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contatos_no_funil;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contatos_no_funil;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contatos_no_funil
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contatos_no_funil
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contatos_no_funil
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contatos_no_funil
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contatos_no_funil_produtos
ALTER TABLE public.contatos_no_funil_produtos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contatos_no_funil_produtos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contatos_no_funil_produtos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contatos_no_funil_produtos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contatos_no_funil_produtos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contatos_no_funil_produtos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contatos_no_funil_produtos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contatos_no_funil_produtos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contatos_no_funil_produtos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contatos_no_funil_produtos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contracheques
ALTER TABLE public.contracheques ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contracheques;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contracheques;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contracheques;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contracheques;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contracheques;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contracheques
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contracheques
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contracheques
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contracheques
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contrato_anexos
ALTER TABLE public.contrato_anexos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contrato_anexos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contrato_anexos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contrato_anexos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contrato_anexos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contrato_anexos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contrato_anexos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contrato_anexos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contrato_anexos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contrato_anexos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contrato_parcelas
ALTER TABLE public.contrato_parcelas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contrato_parcelas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contrato_parcelas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contrato_parcelas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contrato_parcelas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contrato_parcelas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contrato_parcelas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contrato_parcelas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contrato_parcelas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contrato_parcelas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contrato_permutas
ALTER TABLE public.contrato_permutas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contrato_permutas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contrato_permutas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contrato_permutas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contrato_permutas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contrato_permutas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contrato_permutas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contrato_permutas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contrato_permutas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contrato_permutas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contrato_produtos
ALTER TABLE public.contrato_produtos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contrato_produtos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contrato_produtos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contrato_produtos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contrato_produtos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contrato_produtos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contrato_produtos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contrato_produtos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contrato_produtos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contrato_produtos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contratos
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contratos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contratos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contratos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contratos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contratos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contratos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contratos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contratos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contratos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contratos_terceirizados
ALTER TABLE public.contratos_terceirizados ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contratos_terceirizados;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contratos_terceirizados;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contratos_terceirizados;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contratos_terceirizados;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contratos_terceirizados;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contratos_terceirizados
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contratos_terceirizados
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contratos_terceirizados
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contratos_terceirizados
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: contratos_terceirizados_anexos
ALTER TABLE public.contratos_terceirizados_anexos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.contratos_terceirizados_anexos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.contratos_terceirizados_anexos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.contratos_terceirizados_anexos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.contratos_terceirizados_anexos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.contratos_terceirizados_anexos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.contratos_terceirizados_anexos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.contratos_terceirizados_anexos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.contratos_terceirizados_anexos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.contratos_terceirizados_anexos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: crm_notas
ALTER TABLE public.crm_notas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.crm_notas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.crm_notas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.crm_notas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.crm_notas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.crm_notas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.crm_notas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.crm_notas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.crm_notas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.crm_notas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: debug_notificacoes
ALTER TABLE public.debug_notificacoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.debug_notificacoes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.debug_notificacoes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.debug_notificacoes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.debug_notificacoes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.debug_notificacoes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.debug_notificacoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.debug_notificacoes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.debug_notificacoes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.debug_notificacoes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: diarios_obra
ALTER TABLE public.diarios_obra ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.diarios_obra;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.diarios_obra;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.diarios_obra;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.diarios_obra;
DROP POLICY IF EXISTS "rls_org_policy" ON public.diarios_obra;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.diarios_obra
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.diarios_obra
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.diarios_obra
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.diarios_obra
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: disciplinas_projetos
ALTER TABLE public.disciplinas_projetos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.disciplinas_projetos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.disciplinas_projetos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.disciplinas_projetos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.disciplinas_projetos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.disciplinas_projetos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.disciplinas_projetos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.disciplinas_projetos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.disciplinas_projetos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.disciplinas_projetos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: documento_tipos
ALTER TABLE public.documento_tipos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.documento_tipos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.documento_tipos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.documento_tipos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.documento_tipos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.documento_tipos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.documento_tipos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.documento_tipos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.documento_tipos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.documento_tipos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: documentos_funcionarios
ALTER TABLE public.documentos_funcionarios ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.documentos_funcionarios;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.documentos_funcionarios;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.documentos_funcionarios;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.documentos_funcionarios;
DROP POLICY IF EXISTS "rls_org_policy" ON public.documentos_funcionarios;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.documentos_funcionarios
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.documentos_funcionarios
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.documentos_funcionarios
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.documentos_funcionarios
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: elementos_bim
ALTER TABLE public.elementos_bim ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.elementos_bim;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.elementos_bim;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.elementos_bim;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.elementos_bim;
DROP POLICY IF EXISTS "rls_org_policy" ON public.elementos_bim;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.elementos_bim
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.elementos_bim
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.elementos_bim
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.elementos_bim
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: email_configuracoes
ALTER TABLE public.email_configuracoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.email_configuracoes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.email_configuracoes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.email_configuracoes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.email_configuracoes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.email_configuracoes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.email_configuracoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.email_configuracoes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.email_configuracoes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.email_configuracoes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: email_messages_cache
ALTER TABLE public.email_messages_cache ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.email_messages_cache;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.email_messages_cache;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.email_messages_cache;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.email_messages_cache;
DROP POLICY IF EXISTS "rls_org_policy" ON public.email_messages_cache;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.email_messages_cache
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.email_messages_cache
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.email_messages_cache
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.email_messages_cache
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: email_regras
ALTER TABLE public.email_regras ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.email_regras;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.email_regras;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.email_regras;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.email_regras;
DROP POLICY IF EXISTS "rls_org_policy" ON public.email_regras;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.email_regras
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.email_regras
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.email_regras
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.email_regras
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: emails
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.emails;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.emails;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.emails;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.emails;
DROP POLICY IF EXISTS "rls_org_policy" ON public.emails;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.emails
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.emails
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.emails
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.emails
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: empreendimento_anexos
ALTER TABLE public.empreendimento_anexos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.empreendimento_anexos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.empreendimento_anexos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.empreendimento_anexos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.empreendimento_anexos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.empreendimento_anexos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.empreendimento_anexos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.empreendimento_anexos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.empreendimento_anexos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.empreendimento_anexos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: empreendimento_documento_embeddings
ALTER TABLE public.empreendimento_documento_embeddings ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.empreendimento_documento_embeddings;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.empreendimento_documento_embeddings;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.empreendimento_documento_embeddings;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.empreendimento_documento_embeddings;
DROP POLICY IF EXISTS "rls_org_policy" ON public.empreendimento_documento_embeddings;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.empreendimento_documento_embeddings
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.empreendimento_documento_embeddings
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.empreendimento_documento_embeddings
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.empreendimento_documento_embeddings
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: empreendimentos
ALTER TABLE public.empreendimentos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.empreendimentos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.empreendimentos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.empreendimentos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.empreendimentos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.empreendimentos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.empreendimentos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.empreendimentos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.empreendimentos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.empreendimentos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: empresa_anexos
ALTER TABLE public.empresa_anexos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.empresa_anexos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.empresa_anexos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.empresa_anexos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.empresa_anexos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.empresa_anexos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.empresa_anexos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.empresa_anexos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.empresa_anexos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.empresa_anexos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: estoque
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.estoque;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.estoque;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.estoque;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.estoque;
DROP POLICY IF EXISTS "rls_org_policy" ON public.estoque;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.estoque
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.estoque
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.estoque
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.estoque
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: etapa_obra
ALTER TABLE public.etapa_obra ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.etapa_obra;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.etapa_obra;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.etapa_obra;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.etapa_obra;
DROP POLICY IF EXISTS "rls_org_policy" ON public.etapa_obra;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.etapa_obra
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.etapa_obra
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.etapa_obra
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.etapa_obra
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: faturas_cartao
ALTER TABLE public.faturas_cartao ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.faturas_cartao;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.faturas_cartao;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.faturas_cartao;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.faturas_cartao;
DROP POLICY IF EXISTS "rls_org_policy" ON public.faturas_cartao;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.faturas_cartao
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.faturas_cartao
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.faturas_cartao
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.faturas_cartao
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.feedback;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.feedback;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.feedback;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.feedback;
DROP POLICY IF EXISTS "rls_org_policy" ON public.feedback;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.feedback
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.feedback
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.feedback
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: feriados
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.feriados;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.feriados;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.feriados;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.feriados;
DROP POLICY IF EXISTS "rls_org_policy" ON public.feriados;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.feriados
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.feriados
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.feriados
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.feriados
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: funcionarios
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.funcionarios;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.funcionarios;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.funcionarios;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.funcionarios;
DROP POLICY IF EXISTS "rls_org_policy" ON public.funcionarios;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.funcionarios
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.funcionarios
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.funcionarios
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.funcionarios
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: funcoes
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.funcoes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.funcoes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.funcoes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.funcoes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.funcoes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.funcoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.funcoes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.funcoes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.funcoes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: funis
ALTER TABLE public.funis ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.funis;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.funis;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.funis;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.funis;
DROP POLICY IF EXISTS "rls_org_policy" ON public.funis;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.funis
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.funis
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.funis
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.funis
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: historico_movimentacao_funil
ALTER TABLE public.historico_movimentacao_funil ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.historico_movimentacao_funil;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.historico_movimentacao_funil;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.historico_movimentacao_funil;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.historico_movimentacao_funil;
DROP POLICY IF EXISTS "rls_org_policy" ON public.historico_movimentacao_funil;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.historico_movimentacao_funil
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.historico_movimentacao_funil
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.historico_movimentacao_funil
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.historico_movimentacao_funil
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: historico_salarial
ALTER TABLE public.historico_salarial ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.historico_salarial;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.historico_salarial;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.historico_salarial;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.historico_salarial;
DROP POLICY IF EXISTS "rls_org_policy" ON public.historico_salarial;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.historico_salarial
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.historico_salarial
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.historico_salarial
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.historico_salarial
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: indices_financeiros
ALTER TABLE public.indices_financeiros ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.indices_financeiros;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.indices_financeiros;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.indices_financeiros;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.indices_financeiros;
DROP POLICY IF EXISTS "rls_org_policy" ON public.indices_financeiros;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.indices_financeiros
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.indices_financeiros
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.indices_financeiros
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.indices_financeiros
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: integracoes_google
ALTER TABLE public.integracoes_google ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.integracoes_google;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.integracoes_google;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.integracoes_google;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.integracoes_google;
DROP POLICY IF EXISTS "rls_org_policy" ON public.integracoes_google;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.integracoes_google
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.integracoes_google
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.integracoes_google
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.integracoes_google
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: integracoes_meta
ALTER TABLE public.integracoes_meta ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.integracoes_meta;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.integracoes_meta;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.integracoes_meta;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.integracoes_meta;
DROP POLICY IF EXISTS "rls_org_policy" ON public.integracoes_meta;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.integracoes_meta
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.integracoes_meta
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.integracoes_meta
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.integracoes_meta
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: jornada_detalhes
ALTER TABLE public.jornada_detalhes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.jornada_detalhes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.jornada_detalhes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.jornada_detalhes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.jornada_detalhes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.jornada_detalhes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.jornada_detalhes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.jornada_detalhes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.jornada_detalhes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.jornada_detalhes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: jornadas
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.jornadas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.jornadas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.jornadas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.jornadas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.jornadas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.jornadas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.jornadas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.jornadas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.jornadas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: kpis_personalizados
ALTER TABLE public.kpis_personalizados ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.kpis_personalizados;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.kpis_personalizados;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.kpis_personalizados;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.kpis_personalizados;
DROP POLICY IF EXISTS "rls_org_policy" ON public.kpis_personalizados;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.kpis_personalizados
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.kpis_personalizados
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.kpis_personalizados
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.kpis_personalizados
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: lancamentos
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.lancamentos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.lancamentos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.lancamentos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.lancamentos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.lancamentos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.lancamentos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.lancamentos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.lancamentos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.lancamentos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: lancamentos_anexos
ALTER TABLE public.lancamentos_anexos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.lancamentos_anexos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.lancamentos_anexos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.lancamentos_anexos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.lancamentos_anexos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.lancamentos_anexos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.lancamentos_anexos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.lancamentos_anexos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.lancamentos_anexos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.lancamentos_anexos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: marcas_uploads
ALTER TABLE public.marcas_uploads ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.marcas_uploads;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.marcas_uploads;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.marcas_uploads;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.marcas_uploads;
DROP POLICY IF EXISTS "rls_org_policy" ON public.marcas_uploads;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.marcas_uploads
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.marcas_uploads
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.marcas_uploads
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.marcas_uploads
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: materiais
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.materiais;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.materiais;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.materiais;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.materiais;
DROP POLICY IF EXISTS "rls_org_policy" ON public.materiais;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.materiais
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.materiais
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.materiais
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.materiais
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: meta_ads
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.meta_ads;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.meta_ads;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.meta_ads;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.meta_ads;
DROP POLICY IF EXISTS "rls_org_policy" ON public.meta_ads;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.meta_ads
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.meta_ads
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.meta_ads
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.meta_ads
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: meta_ads_historico
ALTER TABLE public.meta_ads_historico ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.meta_ads_historico;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.meta_ads_historico;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.meta_ads_historico;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.meta_ads_historico;
DROP POLICY IF EXISTS "rls_org_policy" ON public.meta_ads_historico;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.meta_ads_historico
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.meta_ads_historico
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.meta_ads_historico
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.meta_ads_historico
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: meta_adsets
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.meta_adsets;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.meta_adsets;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.meta_adsets;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.meta_adsets;
DROP POLICY IF EXISTS "rls_org_policy" ON public.meta_adsets;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.meta_adsets
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.meta_adsets
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.meta_adsets
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.meta_adsets
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: meta_campaigns
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.meta_campaigns;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.meta_campaigns;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.meta_campaigns;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.meta_campaigns;
DROP POLICY IF EXISTS "rls_org_policy" ON public.meta_campaigns;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.meta_campaigns
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.meta_campaigns
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.meta_campaigns
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.meta_campaigns
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: meta_form_config
ALTER TABLE public.meta_form_config ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.meta_form_config;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.meta_form_config;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.meta_form_config;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.meta_form_config;
DROP POLICY IF EXISTS "rls_org_policy" ON public.meta_form_config;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.meta_form_config
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.meta_form_config
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.meta_form_config
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.meta_form_config
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: meta_forms_catalog
ALTER TABLE public.meta_forms_catalog ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.meta_forms_catalog;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.meta_forms_catalog;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.meta_forms_catalog;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.meta_forms_catalog;
DROP POLICY IF EXISTS "rls_org_policy" ON public.meta_forms_catalog;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.meta_forms_catalog
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.meta_forms_catalog
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.meta_forms_catalog
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.meta_forms_catalog
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: modelos_contrato
ALTER TABLE public.modelos_contrato ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.modelos_contrato;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.modelos_contrato;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.modelos_contrato;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.modelos_contrato;
DROP POLICY IF EXISTS "rls_org_policy" ON public.modelos_contrato;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.modelos_contrato
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.modelos_contrato
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.modelos_contrato
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.modelos_contrato
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: monitor_visitas
ALTER TABLE public.monitor_visitas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.monitor_visitas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.monitor_visitas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.monitor_visitas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.monitor_visitas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.monitor_visitas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.monitor_visitas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.monitor_visitas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.monitor_visitas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.monitor_visitas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: movimentacoes_estoque
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "rls_org_policy" ON public.movimentacoes_estoque;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.movimentacoes_estoque
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.movimentacoes_estoque
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.movimentacoes_estoque
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.movimentacoes_estoque
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: notificacoes
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.notificacoes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.notificacoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.notificacoes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.notificacoes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.notificacoes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: notification_subscriptions
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "rls_org_policy" ON public.notification_subscriptions;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.notification_subscriptions
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.notification_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.notification_subscriptions
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.notification_subscriptions
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: ocorrencias
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.ocorrencias;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.ocorrencias;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.ocorrencias;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.ocorrencias;
DROP POLICY IF EXISTS "rls_org_policy" ON public.ocorrencias;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.ocorrencias
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.ocorrencias
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.ocorrencias
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.ocorrencias
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: orcamento_itens
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.orcamento_itens;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.orcamento_itens;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.orcamento_itens;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.orcamento_itens;
DROP POLICY IF EXISTS "rls_org_policy" ON public.orcamento_itens;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.orcamento_itens
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.orcamento_itens
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.orcamento_itens
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.orcamento_itens
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: orcamentos
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.orcamentos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.orcamentos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.orcamentos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.orcamentos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.orcamentos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.orcamentos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.orcamentos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.orcamentos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.orcamentos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: parcelas_adicionais
ALTER TABLE public.parcelas_adicionais ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.parcelas_adicionais;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.parcelas_adicionais;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.parcelas_adicionais;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.parcelas_adicionais;
DROP POLICY IF EXISTS "rls_org_policy" ON public.parcelas_adicionais;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.parcelas_adicionais
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.parcelas_adicionais
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.parcelas_adicionais
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.parcelas_adicionais
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: pedidos_compra
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.pedidos_compra;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.pedidos_compra;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.pedidos_compra;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.pedidos_compra;
DROP POLICY IF EXISTS "rls_org_policy" ON public.pedidos_compra;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.pedidos_compra
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.pedidos_compra
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.pedidos_compra
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.pedidos_compra
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: pedidos_compra_anexos
ALTER TABLE public.pedidos_compra_anexos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.pedidos_compra_anexos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.pedidos_compra_anexos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.pedidos_compra_anexos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.pedidos_compra_anexos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.pedidos_compra_anexos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.pedidos_compra_anexos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.pedidos_compra_anexos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.pedidos_compra_anexos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.pedidos_compra_anexos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: pedidos_compra_historico_fases
ALTER TABLE public.pedidos_compra_historico_fases ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.pedidos_compra_historico_fases;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.pedidos_compra_historico_fases;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.pedidos_compra_historico_fases;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.pedidos_compra_historico_fases;
DROP POLICY IF EXISTS "rls_org_policy" ON public.pedidos_compra_historico_fases;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.pedidos_compra_historico_fases
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.pedidos_compra_historico_fases
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.pedidos_compra_historico_fases
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.pedidos_compra_historico_fases
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: pedidos_compra_itens
ALTER TABLE public.pedidos_compra_itens ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS "rls_org_policy" ON public.pedidos_compra_itens;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.pedidos_compra_itens
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.pedidos_compra_itens
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.pedidos_compra_itens
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.pedidos_compra_itens
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: pedidos_compra_status_historico_legacy
ALTER TABLE public.pedidos_compra_status_historico_legacy ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.pedidos_compra_status_historico_legacy;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.pedidos_compra_status_historico_legacy;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.pedidos_compra_status_historico_legacy;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.pedidos_compra_status_historico_legacy;
DROP POLICY IF EXISTS "rls_org_policy" ON public.pedidos_compra_status_historico_legacy;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.pedidos_compra_status_historico_legacy
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.pedidos_compra_status_historico_legacy
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.pedidos_compra_status_historico_legacy
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.pedidos_compra_status_historico_legacy
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: pedidos_fases
ALTER TABLE public.pedidos_fases ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.pedidos_fases;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.pedidos_fases;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.pedidos_fases;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.pedidos_fases;
DROP POLICY IF EXISTS "rls_org_policy" ON public.pedidos_fases;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.pedidos_fases
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.pedidos_fases
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.pedidos_fases
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.pedidos_fases
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: permissoes
ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.permissoes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.permissoes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.permissoes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.permissoes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.permissoes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.permissoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.permissoes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.permissoes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.permissoes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: pontos
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.pontos;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.pontos;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.pontos;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.pontos;
DROP POLICY IF EXISTS "rls_org_policy" ON public.pontos;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.pontos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.pontos
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.pontos
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.pontos
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: produtos_empreendimento
ALTER TABLE public.produtos_empreendimento ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.produtos_empreendimento;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.produtos_empreendimento;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.produtos_empreendimento;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.produtos_empreendimento;
DROP POLICY IF EXISTS "rls_org_policy" ON public.produtos_empreendimento;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.produtos_empreendimento
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.produtos_empreendimento
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.produtos_empreendimento
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.produtos_empreendimento
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: projetos_bim
ALTER TABLE public.projetos_bim ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.projetos_bim;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.projetos_bim;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.projetos_bim;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.projetos_bim;
DROP POLICY IF EXISTS "rls_org_policy" ON public.projetos_bim;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.projetos_bim
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.projetos_bim
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.projetos_bim
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.projetos_bim
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: rdo_fotos_uploads
ALTER TABLE public.rdo_fotos_uploads ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.rdo_fotos_uploads;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.rdo_fotos_uploads;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.rdo_fotos_uploads;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.rdo_fotos_uploads;
DROP POLICY IF EXISTS "rls_org_policy" ON public.rdo_fotos_uploads;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.rdo_fotos_uploads
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.rdo_fotos_uploads
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.rdo_fotos_uploads
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.rdo_fotos_uploads
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: regras_notificacao
ALTER TABLE public.regras_notificacao ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.regras_notificacao;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.regras_notificacao;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.regras_notificacao;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.regras_notificacao;
DROP POLICY IF EXISTS "rls_org_policy" ON public.regras_notificacao;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.regras_notificacao
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.regras_notificacao
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.regras_notificacao
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.regras_notificacao
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: regras_roteamento_funil
ALTER TABLE public.regras_roteamento_funil ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.regras_roteamento_funil;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.regras_roteamento_funil;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.regras_roteamento_funil;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.regras_roteamento_funil;
DROP POLICY IF EXISTS "rls_org_policy" ON public.regras_roteamento_funil;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.regras_roteamento_funil
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.regras_roteamento_funil
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.regras_roteamento_funil
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.regras_roteamento_funil
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: simulacoes
ALTER TABLE public.simulacoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.simulacoes;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.simulacoes;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.simulacoes;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.simulacoes;
DROP POLICY IF EXISTS "rls_org_policy" ON public.simulacoes;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.simulacoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.simulacoes
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.simulacoes
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.simulacoes
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: sinapi
ALTER TABLE public.sinapi ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.sinapi;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.sinapi;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.sinapi;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.sinapi;
DROP POLICY IF EXISTS "rls_org_policy" ON public.sinapi;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.sinapi
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.sinapi
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.sinapi
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.sinapi
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: subetapas
ALTER TABLE public.subetapas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.subetapas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.subetapas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.subetapas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.subetapas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.subetapas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.subetapas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.subetapas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.subetapas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.subetapas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: tabelas_sistema
ALTER TABLE public.tabelas_sistema ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.tabelas_sistema;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.tabelas_sistema;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.tabelas_sistema;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.tabelas_sistema;
DROP POLICY IF EXISTS "rls_org_policy" ON public.tabelas_sistema;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.tabelas_sistema
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.tabelas_sistema
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.tabelas_sistema
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.tabelas_sistema
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: telefones
ALTER TABLE public.telefones ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.telefones;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.telefones;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.telefones;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.telefones;
DROP POLICY IF EXISTS "rls_org_policy" ON public.telefones;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.telefones
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.telefones
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.telefones
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.telefones
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: telefones_backup_faxina
ALTER TABLE public.telefones_backup_faxina ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.telefones_backup_faxina;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.telefones_backup_faxina;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.telefones_backup_faxina;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.telefones_backup_faxina;
DROP POLICY IF EXISTS "rls_org_policy" ON public.telefones_backup_faxina;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.telefones_backup_faxina
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.telefones_backup_faxina
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.telefones_backup_faxina
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.telefones_backup_faxina
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: termos_aceite
ALTER TABLE public.termos_aceite ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.termos_aceite;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.termos_aceite;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.termos_aceite;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.termos_aceite;
DROP POLICY IF EXISTS "rls_org_policy" ON public.termos_aceite;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.termos_aceite
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.termos_aceite
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.termos_aceite
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.termos_aceite
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: termos_uso
ALTER TABLE public.termos_uso ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.termos_uso;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.termos_uso;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.termos_uso;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.termos_uso;
DROP POLICY IF EXISTS "rls_org_policy" ON public.termos_uso;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.termos_uso
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.termos_uso
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.termos_uso
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.termos_uso
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: usuario_aceite_politicas
ALTER TABLE public.usuario_aceite_politicas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.usuario_aceite_politicas;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.usuario_aceite_politicas;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.usuario_aceite_politicas;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.usuario_aceite_politicas;
DROP POLICY IF EXISTS "rls_org_policy" ON public.usuario_aceite_politicas;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.usuario_aceite_politicas
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.usuario_aceite_politicas
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.usuario_aceite_politicas
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.usuario_aceite_politicas
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.usuarios;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.usuarios;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.usuarios;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.usuarios;
DROP POLICY IF EXISTS "rls_org_policy" ON public.usuarios;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.usuarios
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.usuarios
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.usuarios
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: vales_agendados
ALTER TABLE public.vales_agendados ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.vales_agendados;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.vales_agendados;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.vales_agendados;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.vales_agendados;
DROP POLICY IF EXISTS "rls_org_policy" ON public.vales_agendados;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.vales_agendados
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.vales_agendados
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.vales_agendados
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.vales_agendados
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: variaveis_virtuais
ALTER TABLE public.variaveis_virtuais ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.variaveis_virtuais;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.variaveis_virtuais;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.variaveis_virtuais;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.variaveis_virtuais;
DROP POLICY IF EXISTS "rls_org_policy" ON public.variaveis_virtuais;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.variaveis_virtuais
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.variaveis_virtuais
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.variaveis_virtuais
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.variaveis_virtuais
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: whatsapp_broadcast_lists
ALTER TABLE public.whatsapp_broadcast_lists ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.whatsapp_broadcast_lists;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.whatsapp_broadcast_lists;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.whatsapp_broadcast_lists;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.whatsapp_broadcast_lists;
DROP POLICY IF EXISTS "rls_org_policy" ON public.whatsapp_broadcast_lists;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.whatsapp_broadcast_lists
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.whatsapp_broadcast_lists
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.whatsapp_broadcast_lists
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.whatsapp_broadcast_lists
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: whatsapp_conversations
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "rls_org_policy" ON public.whatsapp_conversations;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.whatsapp_conversations
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.whatsapp_conversations
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.whatsapp_conversations
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.whatsapp_conversations
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: whatsapp_list_members
ALTER TABLE public.whatsapp_list_members ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.whatsapp_list_members;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.whatsapp_list_members;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.whatsapp_list_members;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.whatsapp_list_members;
DROP POLICY IF EXISTS "rls_org_policy" ON public.whatsapp_list_members;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.whatsapp_list_members
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.whatsapp_list_members
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.whatsapp_list_members
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.whatsapp_list_members
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: whatsapp_messages
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "rls_org_policy" ON public.whatsapp_messages;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.whatsapp_messages
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: whatsapp_scheduled_broadcasts
ALTER TABLE public.whatsapp_scheduled_broadcasts ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.whatsapp_scheduled_broadcasts;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.whatsapp_scheduled_broadcasts;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.whatsapp_scheduled_broadcasts;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.whatsapp_scheduled_broadcasts;
DROP POLICY IF EXISTS "rls_org_policy" ON public.whatsapp_scheduled_broadcasts;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.whatsapp_scheduled_broadcasts
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.whatsapp_scheduled_broadcasts
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.whatsapp_scheduled_broadcasts
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.whatsapp_scheduled_broadcasts
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());

-- Tabela: whatsapp_webhook_logs
ALTER TABLE public.whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas se existirem
DROP POLICY IF EXISTS "rls_select_org_policy" ON public.whatsapp_webhook_logs;
DROP POLICY IF EXISTS "rls_insert_org_policy" ON public.whatsapp_webhook_logs;
DROP POLICY IF EXISTS "rls_update_org_policy" ON public.whatsapp_webhook_logs;
DROP POLICY IF EXISTS "rls_delete_org_policy" ON public.whatsapp_webhook_logs;
DROP POLICY IF EXISTS "rls_org_policy" ON public.whatsapp_webhook_logs;

-- POLICY DE LEITURA (SELECT): Pode ver os dados da própria organização OU dados da Org 1 (Público)
CREATE POLICY "rls_select_org_policy" ON public.whatsapp_webhook_logs
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

-- POLICY DE INSERÇÃO (INSERT): Só pode inserir dados para a própria organização
CREATE POLICY "rls_insert_org_policy" ON public.whatsapp_webhook_logs
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE ATUALIZAÇÃO (UPDATE): Só pode alterar dados da própria organização
CREATE POLICY "rls_update_org_policy" ON public.whatsapp_webhook_logs
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- POLICY DE EXCLUSÃO (DELETE): Só pode excluir dados da própria organização
CREATE POLICY "rls_delete_org_policy" ON public.whatsapp_webhook_logs
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_auth_user_org());
