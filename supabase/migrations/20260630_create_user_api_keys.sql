-- Migração: Criar tabela de chaves de API do Usuário (user_api_keys)
-- Criada em: 2026-06-30

CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organizacao_id bigint NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    key_hash text NOT NULL UNIQUE,
    key_preview text NOT NULL,
    nome text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    ativo boolean DEFAULT true NOT NULL
);

-- Indexar o hash para buscas ultrarápidas na autenticação
CREATE INDEX IF NOT EXISTS idx_user_api_keys_hash ON public.user_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_usuario ON public.user_api_keys (usuario_id);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS)
-- Apenas o próprio usuário correspondente pode interagir com suas chaves de API

CREATE POLICY user_api_keys_select ON public.user_api_keys
    FOR SELECT
    USING (auth.uid() = usuario_id);

CREATE POLICY user_api_keys_insert ON public.user_api_keys
    FOR INSERT
    WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY user_api_keys_update ON public.user_api_keys
    FOR UPDATE
    USING (auth.uid() = usuario_id)
    WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY user_api_keys_delete ON public.user_api_keys
    FOR DELETE
    USING (auth.uid() = usuario_id);
