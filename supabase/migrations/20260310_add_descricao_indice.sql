-- Migration para adicionar a coluna descricao na tabela indices_governamentais

ALTER TABLE indices_governamentais 
ADD COLUMN IF NOT EXISTS descricao TEXT;

-- Atualizar descrições dos índices já cadastrados (opcional, para manter a base limpa)
UPDATE indices_governamentais 
SET descricao = 'Índice Nacional de Preços ao Consumidor Amplo (IBGE)' 
WHERE nome_indice = 'IPCA' AND descricao IS NULL;

UPDATE indices_governamentais 
SET descricao = 'Índice de Geral de Preços - Mercado (FGV)' 
WHERE nome_indice = 'IGP-M' AND descricao IS NULL;

UPDATE indices_governamentais 
SET descricao = 'Índice Nacional de Custo da Construção (FGV)' 
WHERE nome_indice = 'INCC' AND descricao IS NULL;
