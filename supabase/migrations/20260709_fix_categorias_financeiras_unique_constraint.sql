-- Corrige a restrição de unicidade em categorias_financeiras para suportar multi-tenancy.
-- Permite que diferentes organizações criem categorias com o mesmo nome e tipo.
ALTER TABLE public.categorias_financeiras DROP CONSTRAINT IF EXISTS categorias_financeiras_nome_tipo_unique;
ALTER TABLE public.categorias_financeiras ADD CONSTRAINT categorias_financeiras_nome_tipo_unique UNIQUE (nome, tipo, organizacao_id);
