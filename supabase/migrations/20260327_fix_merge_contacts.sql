CREATE OR REPLACE FUNCTION public.merge_contacts_and_relink_all_references(p_primary_contact_id bigint, p_secondary_contact_ids bigint[], p_final_data jsonb, p_final_telefones jsonb, p_final_emails jsonb, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    secondary_id bigint;
BEGIN
    -- 1. ATUALIZAR DADOS DO VENCEDOR (Com os dados escolhidos no Modal)
    UPDATE contatos
    SET 
        nome = COALESCE((p_final_data->>'nome'), nome),
        razao_social = COALESCE((p_final_data->>'razao_social'), razao_social),
        cpf = COALESCE((p_final_data->>'cpf'), cpf),
        cnpj = COALESCE((p_final_data->>'cnpj'), cnpj),
        rg = COALESCE((p_final_data->>'rg'), rg),
        tipo_contato = COALESCE((p_final_data->>'tipo_contato')::public.tipo_contato_enum, tipo_contato),
        estado_civil = COALESCE((p_final_data->>'estado_civil'), estado_civil),
        cargo = COALESCE((p_final_data->>'cargo'), cargo),
        address_street = COALESCE((p_final_data->>'address_street'), address_street),
        address_number = COALESCE((p_final_data->>'address_number'), address_number),
        address_complement = COALESCE((p_final_data->>'address_complement'), address_complement),
        neighborhood = COALESCE((p_final_data->>'neighborhood'), neighborhood),
        city = COALESCE((p_final_data->>'city'), city),
        state = COALESCE((p_final_data->>'state'), state),
        cep = COALESCE((p_final_data->>'cep'), cep)
    WHERE id = p_primary_contact_id;

    -- 2. REFAZER TELEFONES (Remove os atuais e insere a lista final limpa do Modal)
    DELETE FROM telefones WHERE contato_id = p_primary_contact_id;
    
    IF jsonb_array_length(p_final_telefones) > 0 THEN
        INSERT INTO telefones (contato_id, telefone, tipo, country_code, organizacao_id)
        SELECT 
            p_primary_contact_id, 
            t->>'telefone', 
            COALESCE(t->>'tipo', 'Celular'), 
            COALESCE(t->>'country_code', '+55'), 
            p_organizacao_id
        FROM jsonb_array_elements(p_final_telefones) as t;
    END IF;

    -- 3. REFAZER EMAILS
    DELETE FROM emails WHERE contato_id = p_primary_contact_id;
    
    IF jsonb_array_length(p_final_emails) > 0 THEN
        INSERT INTO emails (contato_id, email, tipo, organizacao_id)
        SELECT 
            p_primary_contact_id, 
            e->>'email', 
            COALESCE(e->>'tipo', 'Pessoal'), 
            p_organizacao_id
        FROM jsonb_array_elements(p_final_emails) as e;
    END IF;

    -- 4. PROCESSAR OS CONTATOS SECUNDÁRIOS (Relinkar referências com BLINDAGEM)
    FOREACH secondary_id IN ARRAY p_secondary_contact_ids LOOP
        
        -- A. BLINDAGEM: LISTAS DE WHATSAPP (Evita erro unique_contato_na_lista)
        -- Copia só o que o vencedor NÃO tem.
        INSERT INTO whatsapp_list_members (lista_id, contato_id)
        SELECT lista_id, p_primary_contact_id
        FROM whatsapp_list_members
        WHERE contato_id = secondary_id
        AND NOT EXISTS (
            SELECT 1 FROM whatsapp_list_members existing
            WHERE existing.contato_id = p_primary_contact_id
            AND existing.lista_id = whatsapp_list_members.lista_id
        );
        -- Apaga do secundário para liberar
        DELETE FROM whatsapp_list_members WHERE contato_id = secondary_id;

        -- B. BLINDAGEM: FUNIL DE VENDAS
        -- Se o vencedor já tem card, deleta o do secundário. Se não, move.
        IF EXISTS (SELECT 1 FROM contatos_no_funil WHERE contato_id = p_primary_contact_id) THEN
            DELETE FROM contatos_no_funil WHERE contato_id = secondary_id;
        ELSE
            UPDATE contatos_no_funil SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        END IF;

        -- C. MOVER O RESTO (Conversas, Mensagens, Notas, Financeiro, Contratos, etc)
        -- Usando o TRY CATCH atômico (EXCEPTION WHEN OTHERS) para proteger a transação principal
        
        -- Comunicação e Hub
        UPDATE whatsapp_conversations SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE whatsapp_messages SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        BEGIN UPDATE crm_notas SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE whatsapp_attachments SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE emails SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE telefones SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE telefones_backup_faxina SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Financeiro
        BEGIN UPDATE lancamentos SET favorecido_contato_id = p_primary_contact_id WHERE favorecido_contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- Vendas
        BEGIN UPDATE contratos SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE simulacoes SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- RH e Operacional
        BEGIN UPDATE funcionarios SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE activities SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;

        -- D. TCHAU SECUNDÁRIO 👋
        DELETE FROM contatos WHERE id = secondary_id;

    END LOOP;
END;
$function$
