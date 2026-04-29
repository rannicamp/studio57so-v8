-- 1. Garante que a coluna na tabela de usuários existe (você já tem, mas garantimos)
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS contato_id bigint REFERENCES public.contatos(id);

-- 2. Cria a tabela de configuração (com a coluna is_active e a trava UNIQUE já inclusas!)
CREATE TABLE IF NOT EXISTS public.crm_rodizio_config (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id bigint NOT NULL UNIQUE REFERENCES public.organizacoes(id),
    is_active boolean DEFAULT true,
    fila_usuarios_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    ultimo_indice_atendido integer NOT NULL DEFAULT -1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Habilita segurança
ALTER TABLE public.crm_rodizio_config ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de segurança (remove antes pra não dar erro se já existir)
DROP POLICY IF EXISTS "Leitura de configuração de rodízio" ON public.crm_rodizio_config;
CREATE POLICY "Leitura de configuração de rodízio" ON public.crm_rodizio_config 
FOR SELECT USING (
    organizacao_id IN (SELECT u.organizacao_id FROM public.usuarios u WHERE u.id = auth.uid())
);

DROP POLICY IF EXISTS "Edição de configuração de rodízio" ON public.crm_rodizio_config;
CREATE POLICY "Edição de configuração de rodízio" ON public.crm_rodizio_config 
FOR ALL USING (
    organizacao_id IN (SELECT u.organizacao_id FROM public.usuarios u WHERE u.id = auth.uid())
) WITH CHECK (
    organizacao_id IN (SELECT u.organizacao_id FROM public.usuarios u WHERE u.id = auth.uid())
);

-- 5. Recria a função mágica de sorteio (agora blindada)
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
    v_novo_indice integer;
    v_usuario_sorteado_id text;
    v_contato_sorteado_id bigint;
    v_config_id uuid;
BEGIN
    -- Busca a configuração bloqueando para atualização (evita concorrência)
    SELECT 
        id, fila_usuarios_ids, ultimo_indice_atendido 
    INTO 
        v_config_id, v_fila, v_ultimo_indice
    FROM public.crm_rodizio_config 
    WHERE organizacao_id = p_organizacao_id 
    AND is_active = true
    FOR UPDATE;

    -- Se não tem rodízio ativo ou a fila está vazia
    IF NOT FOUND OR jsonb_array_length(v_fila) = 0 THEN
        RETURN;
    END IF;

    v_tamanho_fila := jsonb_array_length(v_fila);
    v_novo_indice := v_ultimo_indice + 1;

    -- Reinicia o ciclo se chegou ao fim da fila
    IF v_novo_indice >= v_tamanho_fila THEN
        v_novo_indice := 0;
    END IF;

    -- Pega o ID do usuário sorteado (removendo aspas duplas do JSON)
    v_usuario_sorteado_id := trim(both '"' from (v_fila->v_novo_indice)::text);

    -- Busca o contato_id vinculado a este usuário
    SELECT u.contato_id INTO v_contato_sorteado_id
    FROM public.usuarios u
    WHERE u.id::text = v_usuario_sorteado_id;

    -- Atualiza o índice na tabela de configuração
    UPDATE public.crm_rodizio_config
    SET ultimo_indice_atendido = v_novo_indice,
        updated_at = now()
    WHERE id = v_config_id;

    -- Retorna os dados do corretor sorteado
    RETURN QUERY SELECT v_usuario_sorteado_id::uuid, v_contato_sorteado_id;
END;
$$;
