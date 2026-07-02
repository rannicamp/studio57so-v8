-- supabase/migrations/20260702_create_billing_tables.sql
-- SCRIPT DE CRIAÇÃO DO ECOSSISTEMA DE PLANOS E ASSINATURAS ELO 57

-- 1. Criar a Tabela planos
CREATE TABLE IF NOT EXISTS public.planos (
    id serial PRIMARY KEY,
    codigo text UNIQUE NOT NULL, -- 'essencial', 'pro', 'ultra'
    nome text NOT NULL,
    valor_mensal numeric(10,2) NOT NULL,
    valor_anual numeric(10,2) NOT NULL,
    modulos_inclusos jsonb NOT NULL, -- ex: {"bim": true, "financeiro": true}
    ativo boolean DEFAULT true,
    organizacao_id bigint NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para planos
DROP POLICY IF EXISTS "rls_select_planos_policy" ON public.planos;
CREATE POLICY "rls_select_planos_policy" ON public.planos
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

DROP POLICY IF EXISTS "rls_modify_planos_policy" ON public.planos;
CREATE POLICY "rls_modify_planos_policy" ON public.planos
FOR ALL
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- Seed de Planos Comerciais
INSERT INTO public.planos (codigo, nome, valor_mensal, valor_anual, modulos_inclusos, organizacao_id)
VALUES 
('essencial', 'Elo Essencial', 127.00, 101.60, '{"painel": true, "financeiro": true, "empresas": true, "empreendimentos": true, "contatos": true, "simulador": true, "atividades": true}'::jsonb, 1),
('pro', 'Elo Pro', 297.00, 237.60, '{"painel": true, "financeiro": true, "empresas": true, "empreendimentos": true, "contatos": true, "simulador": true, "atividades": true, "recursos_humanos": true, "crm": true, "tabela_vendas": true, "orcamento": true, "pedidos": true, "almoxarifado": true, "rdo": true, "bim": true}'::jsonb, 1),
('ultra', 'Elo Ultra', 497.00, 397.60, '{"painel": true, "financeiro": true, "empresas": true, "empreendimentos": true, "contatos": true, "simulador": true, "atividades": true, "recursos_humanos": true, "crm": true, "tabela_vendas": true, "orcamento": true, "pedidos": true, "almoxarifado": true, "rdo": true, "bim": true, "inteligencia_artificial": true}'::jsonb, 1)
ON CONFLICT (codigo) DO UPDATE 
SET nome = EXCLUDED.nome, valor_mensal = EXCLUDED.valor_mensal, valor_anual = EXCLUDED.valor_anual, modulos_inclusos = EXCLUDED.modulos_inclusos;

-- 2. Criar a Tabela promocoes
CREATE TABLE IF NOT EXISTS public.promocoes (
    id serial PRIMARY KEY,
    codigo text UNIQUE NOT NULL, -- ex: 'amigododono'
    desconto_percentual numeric(5,2) DEFAULT 0.00,
    trial_days integer DEFAULT 15,
    ativo boolean DEFAULT true,
    valido_ate timestamp with time zone,
    organizacao_id bigint NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.promocoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para promocoes
DROP POLICY IF EXISTS "rls_select_promocoes_policy" ON public.promocoes;
CREATE POLICY "rls_select_promocoes_policy" ON public.promocoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_auth_user_org() OR organizacao_id = 1);

DROP POLICY IF EXISTS "rls_modify_promocoes_policy" ON public.promocoes;
CREATE POLICY "rls_modify_promocoes_policy" ON public.promocoes
FOR ALL
TO authenticated
USING (organizacao_id = public.get_auth_user_org())
WITH CHECK (organizacao_id = public.get_auth_user_org());

-- Seed de Promoções / Cupons
INSERT INTO public.promocoes (codigo, desconto_percentual, trial_days, ativo, organizacao_id)
VALUES 
('AMIGODODONO', 10.00, 90, true, 1)
ON CONFLICT (codigo) DO UPDATE 
SET desconto_percentual = EXCLUDED.desconto_percentual, trial_days = EXCLUDED.trial_days, ativo = EXCLUDED.ativo;

-- 3. Adicionar colunas na tabela organizacoes
ALTER TABLE public.organizacoes 
ADD COLUMN IF NOT EXISTS plano_codigo text REFERENCES public.planos(codigo),
ADD COLUMN IF NOT EXISTS seats_contracted integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS cupom_aplicado text REFERENCES public.promocoes(codigo);
