-- 1. Atualiza a função get_user_allowed_notifications para suportar -1 em funcoes_ids (Todos os usuários)
CREATE OR REPLACE FUNCTION public.get_user_allowed_notifications(p_user_id uuid, p_organizacao_id bigint)
 RETURNS TABLE(
    id bigint,
    nome_regra text,
    tabela_alvo text,
    evento text,
    icone text,
    enviar_push boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_cargo_id bigint;
BEGIN
    -- 1. Encontra o cargo_id do usuário logado através do Vínculo de Funcionário
    SELECT f.cargo_id INTO v_cargo_id
    FROM public.usuarios u
    JOIN public.funcionarios f ON u.funcionario_id = f.id
    WHERE u.id = p_user_id
    AND u.is_active = true
    LIMIT 1;

    -- 2. Retorna a lista mestre (Templates) Cruzada com as Permissões (Settings)
    RETURN QUERY
    SELECT 
        t.id,
        t.nome_regra,
        t.tabela_alvo,
        t.evento,
        t.icone,
        s.enviar_push
    FROM public.sys_notification_templates t
    JOIN public.sys_org_notification_settings s 
        ON t.id = s.template_id
    WHERE s.organizacao_id = p_organizacao_id
      AND s.is_active = true
      -- A mágica do Array: -1 significa Todos os usuários (Geral)
      AND (
        -1 = ANY(s.funcoes_ids)
        OR (v_cargo_id IS NOT NULL AND v_cargo_id = ANY(s.funcoes_ids))
      );
END;
$function$;


-- 2. Atualiza a trigger processar_regras_notificacao com suporte a preferências de usuário (sys_user_notification_prefs),
-- com a convenção de -1 (Todos) e tratamento especial global para indices_governamentais.
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
    v_unidade text := '';
    v_dono_id uuid;
    
    v_phone_clean text;
    v_query_dinamica text;
    v_valor_resolvido text;
    v_valor_num_novo numeric;
    v_valor_num_gatilho numeric;

    v_usuarios_notificados uuid[];
    
    v_org_id bigint;
BEGIN
    v_json_dados := to_jsonb(NEW);

    -- 🛡️ BLOCO BLINDADO: Extração dinâmica de organização (evita erro "no field organizacao_id")
    v_org_id := (v_json_dados->>'organizacao_id')::bigint;

    IF v_org_id IS NULL AND TG_TABLE_NAME = 'sys_chat_messages' THEN
        SELECT organizacao_id INTO v_org_id 
        FROM public.sys_chat_conversations 
        WHERE id = (v_json_dados->>'conversation_id')::uuid;
    END IF;

    v_org_id := COALESCE(v_org_id, 1);

    IF (TG_TABLE_NAME = 'whatsapp_messages') THEN
        IF (NEW.contato_id IS NOT NULL) THEN
            SELECT nome INTO v_nome_contato FROM public.contatos WHERE id = NEW.contato_id;
        END IF;
        IF (v_nome_contato IS NULL OR v_nome_contato = '') AND NEW.sender_id IS NOT NULL THEN
            v_phone_clean := regexp_replace(NEW.sender_id, '\D', '', 'g');
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

    v_nome_empreendimento := COALESCE(v_nome_empreendimento, '');
    v_nome_contato := COALESCE(v_nome_contato, '');

    FOR r_regra IN 
        SELECT 
            t.id, t.regras_avancadas, t.coluna_monitorada, t.valor_gatilho, 
            t.titulo_template, t.mensagem_template, t.link_template, t.icone, t.enviar_para_dono,
            s.funcoes_ids, s.enviar_push
        FROM public.sys_notification_templates t
        JOIN public.sys_org_notification_settings s ON s.template_id = t.id
        WHERE t.tabela_alvo = TG_TABLE_NAME 
          AND t.evento = TG_OP 
          AND s.is_active = true 
          AND s.organizacao_id = v_org_id
    LOOP
        BEGIN 
            v_atendeu_todas := true;

            IF r_regra.regras_avancadas IS NOT NULL AND jsonb_array_length(r_regra.regras_avancadas) > 0 THEN
                FOR r_condicao IN SELECT * FROM jsonb_to_recordset(r_regra.regras_avancadas) AS x(campo text, operador text, valor text) LOOP
                    v_valor_novo := v_json_dados->>r_condicao.campo;
                    CASE r_condicao.operador
                        WHEN 'igual' THEN 
                            IF v_valor_novo IS DISTINCT FROM r_condicao.valor THEN v_atendeu_todas := false; END IF;
                        WHEN 'diferente' THEN 
                            IF v_valor_novo IS NOT DISTINCT FROM r_condicao.valor THEN v_atendeu_todas := false; END IF;
                        WHEN 'contem' THEN 
                            IF v_valor_novo NOT ILIKE '%' || r_condicao.valor || '%' THEN v_atendeu_todas := false; END IF;
                        WHEN 'nao_contem' THEN 
                            IF v_valor_novo ILIKE '%' || r_condicao.valor || '%' THEN v_atendeu_todas := false; END IF;
                        WHEN 'vazio' THEN 
                            IF v_valor_novo IS NOT NULL AND v_valor_novo <> '' THEN v_atendeu_todas := false; END IF;
                        WHEN 'nao_vazio' THEN 
                            IF v_valor_novo IS NULL OR v_valor_novo = '' THEN v_atendeu_todas := false; END IF;
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

            v_titulo_final := r_regra.titulo_template;
            v_mensagem_final := r_regra.mensagem_template;
            v_link_final := r_regra.link_template;

            v_titulo_final := replace(v_titulo_final, '{nome_contato}', v_nome_contato);
            v_mensagem_final := replace(v_mensagem_final, '{nome_contato}', v_nome_contato);
            v_link_final := replace(v_link_final, '{nome_contato}', v_nome_contato);
            
            v_titulo_final := replace(v_titulo_final, '{nome_empreendimento}', v_nome_empreendimento);
            v_mensagem_final := replace(v_mensagem_final, '{nome_empreendimento}', v_nome_empreendimento);
            v_link_final := replace(v_link_final, '{nome_empreendimento}', v_nome_empreendimento);
            
            v_titulo_final := replace(v_titulo_final, '{unidade}', v_unidade);
            v_mensagem_final := replace(v_mensagem_final, '{unidade}', v_unidade);
            v_link_final := replace(v_link_final, '{unidade}', v_unidade);

            DECLARE key text; val text; BEGIN
                FOR key, val IN SELECT * FROM jsonb_each_text(v_json_dados) LOOP
                    v_titulo_final := replace(v_titulo_final, '{' || key || '}', COALESCE(val, ''));
                    v_mensagem_final := replace(v_mensagem_final, '{' || key || '}', COALESCE(val, ''));
                    v_link_final := replace(v_link_final, '{' || key || '}', COALESCE(val, ''));
                END LOOP;
            END;

            FOR r_variavel IN SELECT * FROM public.variaveis_virtuais WHERE tabela_gatilho = TG_TABLE_NAME LOOP
                IF (v_titulo_final LIKE '%{' || r_variavel.nome_variavel || '}%') 
                OR (v_mensagem_final LIKE '%{' || r_variavel.nome_variavel || '}%')
                OR (v_link_final LIKE '%{' || r_variavel.nome_variavel || '}%') THEN
                    v_valor_novo := v_json_dados->>r_variavel.coluna_origem;
                    IF v_valor_novo IS NOT NULL AND v_valor_novo <> '' THEN
                        v_query_dinamica := format('SELECT %I::text FROM public.%I WHERE %I = %L LIMIT 1', r_variavel.coluna_retorno, r_variavel.tabela_destino, r_variavel.coluna_chave_destino, v_valor_novo);
                        BEGIN EXECUTE v_query_dinamica INTO v_valor_resolvido; EXCEPTION WHEN OTHERS THEN v_valor_resolvido := NULL; END;
                        
                        v_titulo_final := replace(v_titulo_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                        v_mensagem_final := replace(v_mensagem_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                        v_link_final := replace(v_link_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                    END IF;
                END IF;
            END LOOP;

            v_usuarios_notificados := ARRAY[]::uuid[];

            v_dono_id := NULL;
            IF r_regra.enviar_para_dono = true THEN
                IF TG_TABLE_NAME = 'whatsapp_messages' THEN
                    DECLARE
                        v_target_contato_id bigint;
                        v_corr_id bigint;
                    BEGIN
                        v_target_contato_id := (v_json_dados->>'contato_id')::bigint;
                        IF v_target_contato_id IS NOT NULL THEN
                            SELECT corretor_id INTO v_corr_id
                            FROM public.contatos_no_funil
                            WHERE contato_id = v_target_contato_id
                            ORDER BY updated_at DESC
                            LIMIT 1;
                            
                            IF v_corr_id IS NOT NULL THEN
                                SELECT id INTO v_dono_id FROM public.usuarios WHERE contato_id = v_corr_id LIMIT 1;
                            END IF;
                        END IF;
                    EXCEPTION WHEN OTHERS THEN
                        v_dono_id := NULL;
                    END;
                ELSE
                    IF v_json_dados ? 'criado_por_usuario_id' THEN v_dono_id := (v_json_dados->>'criado_por_usuario_id')::uuid;
                    ELSIF v_json_dados ? 'user_id' THEN v_dono_id := (v_json_dados->>'user_id')::uuid;
                    ELSIF v_json_dados ? 'corretor_id' THEN 
                        BEGIN
                            SELECT id INTO v_dono_id FROM public.usuarios WHERE contato_id = (v_json_dados->>'corretor_id')::bigint LIMIT 1;
                        EXCEPTION WHEN OTHERS THEN
                            v_dono_id := NULL;
                        END;
                    END IF;
                END IF;

                IF v_dono_id IS NOT NULL 
                   AND EXISTS(SELECT 1 FROM public.usuarios WHERE id = v_dono_id AND is_active = true) 
                   AND NOT (v_dono_id = ANY(v_usuarios_notificados)) THEN
                   
                    -- Checa preferências individuais do dono
                    DECLARE
                        v_canal_sistema boolean := true;
                        v_canal_push boolean := true;
                    BEGIN
                        SELECT canal_sistema, canal_push INTO v_canal_sistema, v_canal_push
                        FROM public.sys_user_notification_prefs
                        WHERE usuario_id = v_dono_id AND template_id = r_regra.id;
                        
                        v_canal_sistema := COALESCE(v_canal_sistema, true);
                        v_canal_push := COALESCE(v_canal_push, true);
                        
                        IF v_canal_sistema = true THEN
                            INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                            VALUES (v_dono_id, v_org_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', (r_regra.enviar_push AND v_canal_push), r_regra.icone, now());
                            
                            v_usuarios_notificados := array_append(v_usuarios_notificados, v_dono_id);
                        END IF;
                    END;
                END IF;
            END IF;

            IF (v_dono_id IS NULL OR r_regra.enviar_para_dono = false) THEN
                IF r_regra.funcoes_ids IS NOT NULL AND array_length(r_regra.funcoes_ids, 1) > 0 THEN
                    
                    -- Se contiver -1, significa TODOS os usuários
                    IF -1 = ANY(r_regra.funcoes_ids) THEN
                        -- Exceção especial para indices_governamentais: Notifica todas as franquias/organizações
                        IF TG_TABLE_NAME = 'indices_governamentais' THEN
                            FOR r_user IN SELECT id, organizacao_id FROM public.usuarios WHERE is_active = true LOOP
                                IF NOT (r_user.id = ANY(v_usuarios_notificados)) THEN
                                    DECLARE
                                        v_canal_sistema boolean := true;
                                        v_canal_push boolean := true;
                                    BEGIN
                                        SELECT canal_sistema, canal_push INTO v_canal_sistema, v_canal_push
                                        FROM public.sys_user_notification_prefs
                                        WHERE usuario_id = r_user.id AND template_id = r_regra.id;
                                        
                                        v_canal_sistema := COALESCE(v_canal_sistema, true);
                                        v_canal_push := COALESCE(v_canal_push, true);
                                        
                                        IF v_canal_sistema = true THEN
                                            INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                                            VALUES (r_user.id, r_user.organizacao_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', (r_regra.enviar_push AND v_canal_push), r_regra.icone, now())
                                            ON CONFLICT DO NOTHING;
                                            
                                            v_usuarios_notificados := array_append(v_usuarios_notificados, r_user.id);
                                        END IF;
                                    END;
                                END IF;
                            END LOOP;
                        ELSE
                            -- Regras gerais normais: Notifica todos os usuários desta organização (v_org_id)
                            FOR r_user IN SELECT id FROM public.usuarios WHERE organizacao_id = v_org_id AND is_active = true LOOP
                                IF NOT (r_user.id = ANY(v_usuarios_notificados)) THEN
                                    DECLARE
                                        v_canal_sistema boolean := true;
                                        v_canal_push boolean := true;
                                    BEGIN
                                        SELECT canal_sistema, canal_push INTO v_canal_sistema, v_canal_push
                                        FROM public.sys_user_notification_prefs
                                        WHERE usuario_id = r_user.id AND template_id = r_regra.id;
                                        
                                        v_canal_sistema := COALESCE(v_canal_sistema, true);
                                        v_canal_push := COALESCE(v_canal_push, true);
                                        
                                        IF v_canal_sistema = true THEN
                                            INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                                            VALUES (r_user.id, v_org_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', (r_regra.enviar_push AND v_canal_push), r_regra.icone, now())
                                            ON CONFLICT DO NOTHING;
                                            
                                            v_usuarios_notificados := array_append(v_usuarios_notificados, r_user.id);
                                        END IF;
                                    END;
                                END IF;
                            END LOOP;
                        END IF;
                    ELSE
                        -- Envio normal por funcao_id do usuário logado
                        FOR r_user IN SELECT id FROM public.usuarios WHERE funcao_id::text = ANY(r_regra.funcoes_ids::text[]) AND organizacao_id = v_org_id AND is_active = true LOOP
                            IF NOT (r_user.id = ANY(v_usuarios_notificados)) THEN
                                DECLARE
                                    v_canal_sistema boolean := true;
                                    v_canal_push boolean := true;
                                BEGIN
                                    SELECT canal_sistema, canal_push INTO v_canal_sistema, v_canal_push
                                    FROM public.sys_user_notification_prefs
                                    WHERE usuario_id = r_user.id AND template_id = r_regra.id;
                                    
                                    v_canal_sistema := COALESCE(v_canal_sistema, true);
                                    v_canal_push := COALESCE(v_canal_push, true);
                                    
                                    IF v_canal_sistema = true THEN
                                        INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                                        VALUES (r_user.id, v_org_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', (r_regra.enviar_push AND v_canal_push), r_regra.icone, now())
                                        ON CONFLICT DO NOTHING;
                                        
                                        v_usuarios_notificados := array_append(v_usuarios_notificados, r_user.id);
                                    END IF;
                                END;
                            END IF;
                        END LOOP;
                    END IF;
                    
                END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao processar regra %: %', r_regra.id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
END;
$function$;


-- 3. Cria a Trigger na tabela public.indices_governamentais
DROP TRIGGER IF EXISTS trg_auto_notificacao_indices_governamentais ON public.indices_governamentais;
CREATE TRIGGER trg_auto_notificacao_indices_governamentais
AFTER INSERT OR UPDATE ON public.indices_governamentais
FOR EACH ROW EXECUTE FUNCTION public.processar_regras_notificacao();


-- 4. Insere o template global de notificação para a tabela indices_governamentais (organizacao_id = 1)
-- Garantindo que se já existir, atualiza ou não duplica
DO $$
DECLARE
    v_template_id bigint;
    r_org record;
BEGIN
    SELECT id INTO v_template_id FROM public.sys_notification_templates 
    WHERE tabela_alvo = 'indices_governamentais' AND evento = 'INSERT';

    IF v_template_id IS NULL THEN
        INSERT INTO public.sys_notification_templates 
        (nome_regra, tabela_alvo, evento, coluna_monitorada, valor_gatilho, titulo_template, mensagem_template, link_template, icone, enviar_para_dono, organizacao_id, regras_avancadas)
        VALUES 
        (
            'Atualização de Índices Governamentais', 
            'indices_governamentais', 
            'INSERT', 
            NULL, 
            NULL, 
            '📊 Índice Atualizado: {nome_indice}', 
            'O índice {nome_indice} correspondente a {mes_ano} foi publicado/atualizado com o valor de {valor_mensal}%.', 
            '/painel/configuracoes/indices', 
            'fa-line-chart', 
            false, 
            1, 
            '[]'::jsonb
        )
        RETURNING id INTO v_template_id;
    END IF;

    -- 5. Associa este template nas configurações de cada organização existente com funcoes_ids = ARRAY[-1] (Geral)
    -- Por padrão, a notificação vem ATIVADA (is_active = true) e sem enviar push (enviar_push = false)
    FOR r_org IN SELECT id FROM public.organizacoes LOOP
        IF EXISTS (SELECT 1 FROM public.sys_org_notification_settings WHERE template_id = v_template_id AND organizacao_id = r_org.id) THEN
            UPDATE public.sys_org_notification_settings
            SET funcoes_ids = ARRAY[-1]::bigint[], is_active = true
            WHERE template_id = v_template_id AND organizacao_id = r_org.id;
        ELSE
            INSERT INTO public.sys_org_notification_settings (template_id, organizacao_id, is_active, funcoes_ids, enviar_push)
            VALUES (v_template_id, r_org.id, true, ARRAY[-1]::bigint[], false);
        END IF;
    END LOOP;
    
END $$;
