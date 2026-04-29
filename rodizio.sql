ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS contato_id bigint REFERENCES public.contatos(id);

CREATE TABLE IF NOT EXISTS public.crm_rodizio_config (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id bigint NOT NULL REFERENCES public.organizacoes(id),
    fila_usuarios_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    ultimo_indice_atendido integer NOT NULL DEFAULT -1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_rodizio_config ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Leitura de configuração de rodízio" ON public.crm_rodizio_config FOR SELECT USING (organizacao_id = (SELECT (auth.jwt() ->> 'user_metadata')::jsonb ->> 'organizacao_id')::bigint);
CREATE POLICY "Edição de configuração de rodízio" ON public.crm_rodizio_config FOR ALL USING (organizacao_id = (SELECT (auth.jwt() ->> 'user_metadata')::jsonb ->> 'organizacao_id')::bigint);

-- Função de sorteio de lead (Rodízio)
CREATE OR REPLACE FUNCTION public.fn_distribuir_lead_rodizio(p_organizacao_id bigint)
RETURNS TABLE (
    usuario_id uuid,
    contato_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fila jsonb;
    v_ultimo_indice integer;
    v_tamanho_fila integer;
    v_proximo_indice integer;
    v_usuario_id uuid;
    v_contato_id bigint;
BEGIN
    -- Busca a configuração atual com lock para evitar concorrência (Race condition)
    SELECT fila_usuarios_ids, ultimo_indice_atendido 
    INTO v_fila, v_ultimo_indice
    FROM public.crm_rodizio_config 
    WHERE organizacao_id = p_organizacao_id
    FOR UPDATE;

    IF v_fila IS NULL OR jsonb_array_length(v_fila) = 0 THEN
        RETURN; -- Ninguém na fila
    END IF;

    v_tamanho_fila := jsonb_array_length(v_fila);
    v_proximo_indice := v_ultimo_indice + 1;

    IF v_proximo_indice >= v_tamanho_fila THEN
        v_proximo_indice := 0;
    END IF;

    -- Pega o ID do usuário (em texto JSON e casta para UUID)
    v_usuario_id := (v_fila ->> v_proximo_indice)::uuid;

    -- Busca o contato_id vinculado ao usuário
    SELECT u.contato_id INTO v_contato_id
    FROM public.usuarios u
    WHERE u.id = v_usuario_id;

    -- Atualiza a fila
    UPDATE public.crm_rodizio_config
    SET ultimo_indice_atendido = v_proximo_indice,
        updated_at = now()
    WHERE organizacao_id = p_organizacao_id;

    -- Retorna os dados
    RETURN QUERY SELECT v_usuario_id, v_contato_id;
END;
$$;
