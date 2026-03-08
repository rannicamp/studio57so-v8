-- Remove a obrigatoriedade do CNPJ (necessário para PF)
ALTER TABLE public.cadastro_empresa ALTER COLUMN cnpj DROP NOT NULL;

-- Garante que se um CNPJ for inserido, a formatação exija que não seja repetido se for o caso
-- Mas nosso principal objetivo aqui é o DROP NOT NULL.

-- Cria a coluna que conecta a organização à empresa/entidade gestora, se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organizacoes'
          AND column_name = 'entidade_principal_id'
    ) THEN
        ALTER TABLE public.organizacoes ADD COLUMN entidade_principal_id bigint;
    END IF;
END $$;
