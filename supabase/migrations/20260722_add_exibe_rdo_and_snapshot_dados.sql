-- Adiciona a coluna exibe_rdo em activities para controle de exibição no Diário de Obras
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS exibe_rdo boolean DEFAULT true;

-- Adiciona a coluna snapshot_dados em diarios_obra para congelamento imutável do RDO
ALTER TABLE public.diarios_obra ADD COLUMN IF NOT EXISTS snapshot_dados jsonb DEFAULT NULL;
