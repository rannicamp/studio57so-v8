-- Adiciona a coluna ia_atendimento_ativo na tabela contatos
ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS ia_atendimento_ativo boolean DEFAULT false;
