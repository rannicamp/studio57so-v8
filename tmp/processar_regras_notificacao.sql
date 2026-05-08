CREATE OR REPLACE FUNCTION public.processar_regras_notificacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ 

DECLARE
    r_regra RECORD;
    r_user RECORD;
    r_variavel RECORD;
    r_condicao RECORD;
    
    v_titulo_final text;
    v_mensagem_final text;
    v_link_final text;
    v_atendeu_todas boolean;
    
    v_json_dados jsonb;
    v_valor_novo text;
    v_valor_antigo text;
    
    v_nome_empreendimento text := '';
    v_nome_contato text := '';
    v_nome_corretor text := '';
    v_unidade text := '';
    v_dono_id uuid;
    
    v_phone_clean text;
    v_query_dinamica text;
    v_valor_resolvido text;
    v_valor_num_novo numeric;
    v_valor_num_gatilho numeric;
    
BEGIN
    v_json_dados := to_jsonb(NEW);

    -- ====================================================================
    -- 🕵️‍♂️ 1. INTELIGÊNCIA NATIVA E IDENTIFICAÇÃO DO DONO
    -- ====================================================================
    IF (TG_TABLE_NAME = 'whatsapp_messages') THEN
        IF (NEW.contato_id IS NOT NULL) THEN
            SELECT nome INTO v_nome_contato FROM public.contatos WHERE id = NEW.contato_id;
        END IF;
        IF (v_nome_contato IS NULL OR v_nome_contato = '') AND NEW.sender_id IS NOT NULL THEN
            v_phone_clean := regexp_replace(NEW.sender_id, '\\D', '', 'g');
            SELECT c.nome INTO v_nome_contato
            FROM public.contatos c
            JOIN public.telefones t ON c.id = t.contato_id
            WHERE t.telefone LIKE '%' || right(v_phone_clean, 8) LIMIT 1;
        END IF;
        v_nome_contato := COALESCE(v_nome_contato, NEW.nome_remetente, NEW.sender_id, 'Lead');
    END IF;

    IF (TG_TABLE_NAME = 'produtos_empreendimento') THEN
        v_unidade := COALESCE(NEW.unidade, 'N/A');
        IF (NEW.empreendimento_id IS NOT NULL) THEN
            SELECT nome INTO v_nome_empreendimento FROM public.empreendimentos WHERE id = NEW.empreendimento_id;
        END IF;
    END IF;

    -- Lógica para identificar o Dono (Corretor associado ou criador)
    v_dono_id := NULL;
    IF v_json_dados ? 'criado_por_usuario_id' THEN 
        v_dono_id := (v_json_dados->>'criado_por_usuario_id')::uuid;
    ELSIF v_json_dados ? 'user_id' THEN 
        v_dono_id := (v_json_dados->>'user_id')::uuid;
    ELSIF v_json_dados ? 'corretor_id' AND (v_json_dados->>'corretor_id') IS NOT NULL THEN 
        BEGIN
            SELECT id INTO v_dono_id FROM public.usuarios WHERE contato_id = (v_json_dados->>'corretor_id')::bigint LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_dono_id := NULL;
        END;
    END IF;

    IF v_dono_id IS NULL AND (TG_TABLE_NAME = 'whatsapp_messages' OR TG_TABLE_NAME = 'contatos') THEN
        DECLARE
            v_target_contato_id bigint;
        BEGIN
            IF TG_TABLE_NAME = 'whatsapp_messages' THEN
                v_target_contato_id := (v_json_dados->>'contato_id')::bigint;
            ELSE
                v_target_contato_id := (v_json_dados->>'id')::bigint;
            END IF;

            IF v_target_contato_id IS NOT NULL THEN
                DECLARE
                    v_corr_id bigint;
                BEGIN
                    SELECT corretor_id INTO v_corr_id
                    FROM public.contatos_no_funil
                    WHERE contato_id = v_target_contato_id
                    ORDER BY updated_at DESC
                    LIMIT 1;
                    
                    IF v_corr_id IS NOT NULL THEN
                        SELECT id INTO v_dono_id FROM public.usuarios WHERE contato_id = v_corr_id LIMIT 1;
                    END IF;
                END;
                
                IF v_dono_id IS NULL THEN
                    SELECT criado_por_usuario_id INTO v_dono_id
                    FROM public.contatos
                    WHERE id = v_target_contato_id;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
        END;
    END IF;

    IF v_dono_id IS NOT NULL THEN
        SELECT nome INTO v_nome_corretor FROM public.usuarios WHERE id = v_dono_id;
    END IF;

    v_nome_empreendimento := COALESCE(v_nome_empreendimento, '');
    v_nome_contato := COALESCE(v_nome_contato, '');
    v_nome_corretor := COALESCE(v_nome_corretor, 'Nenhum corretor associado');

    -- ====================================================================
    -- 🔄 2. PROCESSAMENTO DAS REGRAS
    -- ====================================================================
    FOR r_regra IN 
        SELECT * FROM public.regras_notificacao 
        WHERE tabela_alvo = TG_TABLE_NAME 
          AND evento = TG_OP 
          AND ativo = true 
          AND organizacao_id = NEW.organizacao_id
    LOOP
        BEGIN 
            v_atendeu_todas := true;

            IF r_regra.regras_avancadas IS NOT NULL AND jsonb_array_length(r_regra.regras_avancadas) > 0 THEN
                FOR r_condicao IN SELECT * FROM jsonb_to_recordset(r_regra.regras_avancadas) AS x(campo text, operador text, valor text) LOOP
                    v_valor_novo := v_json_dados->>r_condicao.campo;
                    CASE r_condicao.operador
                        WHEN 'igual' THEN IF v_valor_novo IS DISTINCT FROM r_condicao.valor THEN v_atendeu_todas := false; END IF;
                        WHEN 'diferente' THEN IF v_valor_novo IS NOT DISTINCT FROM r_condicao.valor THEN v_atendeu_todas := false; END IF;
                        WHEN 'contem' THEN IF v_valor_novo NOT ILIKE '%' || r_condicao.valor || '%' THEN v_atendeu_todas := false; END IF;
                        WHEN 'nao_contem' THEN IF v_valor_novo ILIKE '%' || r_condicao.valor || '%' THEN v_atendeu_todas := false; END IF;
                        WHEN 'vazio' THEN IF v_valor_novo IS NOT NULL AND v_valor_novo <> '' THEN v_atendeu_todas := false; END IF;
                        WHEN 'nao_vazio' THEN IF v_valor_novo IS NULL OR v_valor_novo = '' THEN v_atendeu_todas := false; END IF;
                        WHEN 'maior' THEN
                            BEGIN
                                v_valor_num_novo := v_valor_novo::numeric;
                                v_valor_num_gatilho := r_condicao.valor::numeric;
                                IF NOT (v_valor_num_novo > v_valor_num_gatilho) THEN v_atendeu_todas := false; END IF;
                            EXCEPTION WHEN OTHERS THEN v_atendeu_todas := false; END;
                        WHEN 'menor' THEN
                            BEGIN
                                v_valor_num_novo := v_valor_novo::numeric;
                                v_valor_num_gatilho := r_condicao.valor::numeric;
                                IF NOT (v_valor_num_novo < v_valor_num_gatilho) THEN v_atendeu_todas := false; END IF;
                            EXCEPTION WHEN OTHERS THEN v_atendeu_todas := false; END;
                        WHEN 'mudou' THEN
                            IF TG_OP = 'UPDATE' THEN
                                v_valor_antigo := to_jsonb(OLD)->>r_condicao.campo;
                                IF v_valor_antigo IS NOT DISTINCT FROM v_valor_novo THEN v_atendeu_todas := false; END IF;
                            END IF;
                    END CASE;
                    IF v_atendeu_todas = false THEN EXIT; END IF;
                END LOOP;
            ELSIF r_regra.coluna_monitorada IS NOT NULL AND r_regra.coluna_monitorada <> '' THEN
                 v_valor_novo := v_json_dados->>r_regra.coluna_monitorada;
                 IF v_valor_novo IS DISTINCT FROM r_regra.valor_gatilho THEN
                    v_atendeu_todas := false;
                 END IF;
                 IF TG_OP = 'UPDATE' AND v_atendeu_todas = true THEN
                    v_valor_antigo := to_jsonb(OLD)->>r_regra.coluna_monitorada;
                    IF v_valor_antigo IS NOT DISTINCT FROM v_valor_novo THEN
                        v_atendeu_todas := false;
                    END IF;
                 END IF;
            END IF;

            IF v_atendeu_todas = false THEN 
                CONTINUE; 
            END IF;

            -- ==============================================================
            -- C. PREPARAÇÃO DO TEXTO (Templates)
            -- ==============================================================
            v_titulo_final := r_regra.titulo_template;
            v_mensagem_final := r_regra.mensagem_template;
            v_link_final := r_regra.link_template;

            v_titulo_final := replace(v_titulo_final, '{nome_contato}', v_nome_contato);
            v_mensagem_final := replace(v_mensagem_final, '{nome_contato}', v_nome_contato);
            v_titulo_final := replace(v_titulo_final, '{nome_empreendimento}', v_nome_empreendimento);
            v_mensagem_final := replace(v_mensagem_final, '{nome_empreendimento}', v_nome_empreendimento);
            v_titulo_final := replace(v_titulo_final, '{nome_corretor}', v_nome_corretor);
            v_mensagem_final := replace(v_mensagem_final, '{nome_corretor}', v_nome_corretor);
            v_titulo_final := replace(v_titulo_final, '{unidade}', v_unidade);
            v_mensagem_final := replace(v_mensagem_final, '{unidade}', v_unidade);

            DECLARE key text; val text; BEGIN
                FOR key, val IN SELECT * FROM jsonb_each_text(v_json_dados) LOOP
                    v_titulo_final := replace(v_titulo_final, '{' || key || '}', COALESCE(val, ''));
                    v_mensagem_final := replace(v_mensagem_final, '{' || key || '}', COALESCE(val, ''));
                END LOOP;
            END;

            FOR r_variavel IN SELECT * FROM public.variaveis_virtuais WHERE tabela_gatilho = TG_TABLE_NAME LOOP
                IF (v_titulo_final LIKE '%{' || r_variavel.nome_variavel || '}%') OR (v_mensagem_final LIKE '%{' || r_variavel.nome_variavel || '}%') THEN
                    v_valor_novo := v_json_dados->>r_variavel.coluna_origem;
                    IF v_valor_novo IS NOT NULL AND v_valor_novo <> '' THEN
                        v_query_dinamica := format('SELECT %I::text FROM public.%I WHERE %I = %L LIMIT 1', r_variavel.coluna_retorno, r_variavel.tabela_destino, r_variavel.coluna_chave_destino, v_valor_novo);
                        BEGIN EXECUTE v_query_dinamica INTO v_valor_resolvido; EXCEPTION WHEN OTHERS THEN v_valor_resolvido := NULL; END;
                        v_titulo_final := replace(v_titulo_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                        v_mensagem_final := replace(v_mensagem_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                    END IF;
                END IF;
            END LOOP;

            -- ==============================================================
            -- D. ENVIO DAS NOTIFICAÇÕES
            -- ==============================================================
            IF r_regra.enviar_para_dono = true AND v_dono_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.usuarios WHERE id = v_dono_id) THEN
                INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                VALUES (v_dono_id, NEW.organizacao_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', r_regra.enviar_push, r_regra.icone, now());
            ELSE
                IF r_regra.funcoes_ids IS NOT NULL AND array_length(r_regra.funcoes_ids, 1) > 0 THEN
                    FOR r_user IN SELECT id FROM public.usuarios WHERE funcao_id::text = ANY(r_regra.funcoes_ids::text[]) AND organizacao_id = NEW.organizacao_id LOOP
                        INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                        VALUES (r_user.id, NEW.organizacao_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', r_regra.enviar_push, r_regra.icone, now())
                        ON CONFLICT DO NOTHING;
                    END LOOP;
                END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao processar regra %: %', r_regra.id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
END;

 $function$
