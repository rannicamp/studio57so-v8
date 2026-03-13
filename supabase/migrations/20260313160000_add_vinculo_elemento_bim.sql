-- Migration: 20260313160000_add_vinculo_elemento_bim.sql

-- 1. Adicionar nova coluna para saber de qual propriedade puxar a quantidade quando o vinculo for por elemento
ALTER TABLE public.bim_mapeamentos_propriedades
ADD COLUMN propriedade_quantidade text;

-- 2. Atualizar a constraint de tipo_vinculo para aceitar 'elemento'
ALTER TABLE public.bim_mapeamentos_propriedades
DROP CONSTRAINT IF EXISTS bim_mapeamentos_propriedades_tipo_vinculo_check;

ALTER TABLE public.bim_mapeamentos_propriedades
ADD CONSTRAINT bim_mapeamentos_propriedades_tipo_vinculo_check 
CHECK (tipo_vinculo = ANY (ARRAY['material'::text, 'servico'::text, 'quantitativo'::text, 'ignorar'::text, 'elemento'::text]));
