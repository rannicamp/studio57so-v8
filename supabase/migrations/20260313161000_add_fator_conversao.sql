-- Migration para adicionar o fator_conversao
ALTER TABLE bim_mapeamentos_propriedades 
ADD COLUMN IF NOT EXISTS fator_conversao text;
