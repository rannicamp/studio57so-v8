-- 1. Cria a coluna jsonb na tabela
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS user_unread_counts jsonb DEFAULT '{}'::jsonb;

-- 2. Cria a função (RPC) para incrementar a bolha de todo mundo daquela organização
CREATE OR REPLACE FUNCTION public.increment_whatsapp_unreads(v_conversation_id uuid, v_org_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    v_current_json jsonb;
    v_current_count int;
BEGIN
    -- Bloqueia a linha da conversa e pega o JSON atual
    SELECT user_unread_counts 
    INTO v_current_json 
    FROM public.whatsapp_conversations 
    WHERE id = v_conversation_id 
    FOR UPDATE;

    IF v_current_json IS NULL THEN
        v_current_json := '{}'::jsonb;
    END IF;

    -- Preenche a bolinha de todos os usuários ativos da organização
    FOR user_record IN 
        SELECT id FROM public.usuarios 
        WHERE organizacao_id = v_org_id AND is_active = true
    LOOP
        -- Tenta ler o valor atual int, senão 0
        v_current_count := COALESCE((v_current_json->>(user_record.id::text))::int, 0);
        
        -- Atualiza o JSON
        v_current_json := jsonb_set(
            v_current_json, 
            ARRAY[user_record.id::text], 
            to_jsonb(v_current_count + 1)
        );
    END LOOP;

    -- Salva o novo resultado na conversa
    UPDATE public.whatsapp_conversations
    SET user_unread_counts = v_current_json
    WHERE id = v_conversation_id;
END;
$$;

-- 3. Cria a função (RPC) para zerar a bolha de UM único usuário
CREATE OR REPLACE FUNCTION public.reset_whatsapp_unreads(v_conversation_id uuid, v_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_json jsonb;
BEGIN
    SELECT user_unread_counts 
    INTO v_current_json 
    FROM public.whatsapp_conversations 
    WHERE id = v_conversation_id 
    FOR UPDATE;

    IF v_current_json IS NULL THEN
        v_current_json := '{}'::jsonb;
    END IF;

    -- Seta para 0 a chave deste usuário sozinho
    v_current_json := jsonb_set(
        v_current_json, 
        ARRAY[v_user_id::text], 
        '0'::jsonb
    );

    UPDATE public.whatsapp_conversations
    SET user_unread_counts = v_current_json
    WHERE id = v_conversation_id;
END;
$$;
