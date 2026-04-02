import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as postgres from "https://deno.land/x/postgres@v0.14.2/mod.ts"

serve(async (req) => {
  try {
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL")!
    const pool = new postgres.Pool(databaseUrl, 1, true)
    const connection = await pool.connect()

    try {
      // Emergency Drop of the broken trigger
      await connection.queryObject\`DROP TRIGGER IF EXISTS tgr_notification_sys_chat_messages ON public.sys_chat_messages;\`;
      
      const sqlBody = \`
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
    
BEGIN
    v_json_dados := to_jsonb(NEW);

    IF (TG_TABLE_NAME = 'whatsapp_messages') THEN
        IF (v_json_dados ? 'contato_id') THEN
            IF ((v_json_dados->>'contato_id') IS NOT NULL AND (v_json_dados->>'contato_id') <> 'null') THEN
                SELECT nome INTO v_nome_contato FROM public.contatos WHERE id = (v_json_dados->>'contato_id')::bigint;
            END IF;
        END IF;

        IF (v_nome_contato IS NULL OR v_nome_contato = '') AND v_json_dados ? 'sender_id' THEN
            v_phone_clean := regexp_replace(v_json_dados->>'sender_id', '\D', '', 'g');
            SELECT c.nome INTO v_nome_contato
            FROM public.contatos c
            JOIN public.telefones t ON c.id = t.contato_id
            WHERE t.telefone LIKE '%' || right(v_phone_clean, 8) LIMIT 1;
        END IF;
        
        v_nome_contato := COALESCE(v_nome_contato, v_json_dados->>'nome_remetente', v_json_dados->>'sender_id', 'Lead');
    END IF;

    IF (TG_TABLE_NAME = 'produtos_empreendimento') THEN
        v_unidade := COALESCE(v_json_dados->>'unidade', 'N/A');
        IF (v_json_dados ? 'empreendimento_id' AND (v_json_dados->>'empreendimento_id') IS NOT NULL) THEN
            SELECT nome INTO v_nome_empreendimento FROM public.empreendimentos WHERE id = (v_json_dados->>'empreendimento_id')::bigint;
        END IF;
    END IF;

    IF (TG_TABLE_NAME = 'sys_chat_messages') THEN
        SELECT nome INTO v_nome_contato FROM public.usuarios WHERE id = (v_json_dados->>'sender_id')::uuid;
        
        -- TABELA CORRIGIDA
        SELECT user_id INTO v_dono_id
        FROM public.sys_chat_participants 
        WHERE conversation_id = (v_json_dados->>'conversation_id')::text
          AND user_id != (v_json_dados->>'sender_id')::uuid
        LIMIT 1;
        
        IF v_dono_id IS NOT NULL THEN
            v_json_dados := jsonb_set(v_json_dados, '{user_id}', to_jsonb(v_dono_id::text));
        END IF;
    END IF;

    v_nome_empreendimento := COALESCE(v_nome_empreendimento, '');
    v_nome_contato := COALESCE(v_nome_contato, '');

    DECLARE
        v_org_id INTEGER;
    BEGIN
        IF v_json_dados ? 'organizacao_id' THEN
            v_org_id := (v_json_dados->>'organizacao_id')::integer;
        ELSE
            v_org_id := 1;
            IF v_dono_id IS NOT NULL THEN
               SELECT organizacao_id INTO v_org_id FROM public.usuarios WHERE id = v_dono_id;
            END IF;
        END IF;

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

                IF v_atendeu_todas = false THEN CONTINUE; END IF;

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

                IF r_regra.funcoes_ids IS NOT NULL AND array_length(r_regra.funcoes_ids, 1) > 0 THEN
                    FOR r_user IN SELECT id FROM public.usuarios WHERE funcao_id::text = ANY(r_regra.funcoes_ids::text[]) AND organizacao_id = v_org_id LOOP
                        INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                        VALUES (r_user.id, v_org_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', r_regra.enviar_push, r_regra.icone, now())
                        ON CONFLICT DO NOTHING;
                        
                        v_usuarios_notificados := array_append(v_usuarios_notificados, r_user.id);
                    END LOOP;
                END IF;

                IF r_regra.enviar_para_dono = true THEN
                    v_dono_id := NULL;
                    IF v_json_dados ? 'criado_por_usuario_id' THEN v_dono_id := (v_json_dados->>'criado_por_usuario_id')::uuid;
                    ELSIF v_json_dados ? 'user_id' THEN v_dono_id := (v_json_dados->>'user_id')::uuid;
                    ELSIF v_json_dados ? 'corretor_id' THEN v_dono_id := (v_json_dados->>'corretor_id')::uuid;
                    END IF;

                    IF v_dono_id IS NOT NULL 
                       AND EXISTS(SELECT 1 FROM public.usuarios WHERE id = v_dono_id) 
                       AND NOT (v_dono_id = ANY(v_usuarios_notificados)) THEN
                       
                        INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                        VALUES (v_dono_id, v_org_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', r_regra.enviar_push, r_regra.icone, now());
                    END IF;
                END IF;

            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Erro ao processar regra %: %', r_regra.id, SQLERRM;
            END;
        END LOOP;
    END;

    RETURN NEW;
END;
$function$;
      \`;

      // Apply the fix!
      await connection.queryObject(sqlBody);
      
      // Re-create the trigger!
      await connection.queryObject\`
      CREATE TRIGGER tgr_notification_sys_chat_messages
      AFTER INSERT ON public.sys_chat_messages
      FOR EACH ROW EXECUTE FUNCTION public.processar_regras_notificacao();
      \`;

      return new Response(JSON.stringify({ status: "Success" }), { headers: { "Content-Type": "application/json" } })
    } finally {
      connection.release()
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { "Content-Type": "application/json" }, status: 500 })
  }
})
