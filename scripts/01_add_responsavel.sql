-- Executar este SQL diretamente no painel do Supabase (SQL Editor)

-- 1. Cria a coluna relacional do Responsável apontando para a matriz universal de Contatos
ALTER TABLE public.cadastro_empresa 
ADD COLUMN IF NOT EXISTS responsavel_id BIGINT REFERENCES public.contatos(id) ON DELETE SET NULL;

-- 2. Índice de performance para consultas rápidas de JOIN
CREATE INDEX IF NOT EXISTS idx_cadastro_empresa_responsavel_id ON public.cadastro_empresa(responsavel_id);

-- Comentário da coluna para documentação da equipe
COMMENT ON COLUMN public.cadastro_empresa.responsavel_id IS 'Chave Estrangeira ligando a empresa ao seu Sócio Administrador registrado na tabela de contatos.';
