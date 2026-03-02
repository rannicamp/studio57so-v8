-- ================================================
-- SYNC SCRIPT: LAB → PROD
-- Gerado em: 01/03/2026, 15:34:09
-- ⚠️  REVISE ANTES DE EXECUTAR NO PROD!
-- ================================================

-- 
📦 Comparando schema: public

-- 
🔍 Comparando colunas de 119 tabelas em comum...

-- ALTERAÇÕES NA TABELA: campos_sistema
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|YES|2|int8
-- PROD: bigint|null|YES|null|int8
ALTER TABLE public.campos_sistema ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: contratos_terceirizados_anexos
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|YES|2|int8
-- PROD: bigint|null|YES|null|int8
ALTER TABLE public.contratos_terceirizados_anexos ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: disciplinas_projetos
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|NO|2|int8
-- PROD: bigint|null|NO|null|int8
ALTER TABLE public.disciplinas_projetos ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: empreendimento_documento_embeddings
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|YES|2|int8
-- PROD: bigint|null|YES|null|int8
ALTER TABLE public.empreendimento_documento_embeddings ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: marcas_uploads
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|YES|2|int8
-- PROD: bigint|null|YES|null|int8
ALTER TABLE public.marcas_uploads ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: pedidos_compra_status_historico_legacy
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|YES|2|int8
-- PROD: bigint|null|YES|null|int8
ALTER TABLE public.pedidos_compra_status_historico_legacy ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: termos_aceite
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|NO|2|int8
-- PROD: bigint|null|NO|null|int8
ALTER TABLE public.termos_aceite ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: termos_uso
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|YES|2|int8
-- PROD: bigint|null|YES|null|int8
ALTER TABLE public.termos_uso ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;

-- ALTERAÇÕES NA TABELA: usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS data_aceite_termos timestamp with time zone;

-- ALTERAÇÕES NA TABELA: variaveis_virtuais
-- ⚠️  COLUNA ALTERADA: organizacao_id
-- LAB:  bigint|null|YES|2|int8
-- PROD: bigint|null|YES|null|int8
ALTER TABLE public.variaveis_virtuais ALTER COLUMN organizacao_id TYPE bigint USING organizacao_id::bigint;
-- 
⚡ Comparando funções/RPCs...

-- ================================================
-- FIM DO SCRIPT | Total de diferenças: 10
-- ================================================