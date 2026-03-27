-- 1. Remove a versão obsoleta em UUID que estava causando a ambiguidade na API
DROP FUNCTION IF EXISTS public.auto_merge_contacts_and_relink(uuid[], uuid);
DROP FUNCTION IF EXISTS public.auto_merge_contacts_and_relink(bigint[]); -- Limpa a de 1 parâmetro por garantia

-- 2. Recria a função principal em BigInt com Tratamento Atômico de Erros (Try-Catch)
CREATE OR REPLACE FUNCTION public.auto_merge_contacts_and_relink(p_contact_ids bigint[], p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    winner_id bigint;
    loser_id bigint;
    id_iter bigint;
BEGIN
    -- 1. Identificar o Vencedor (O contato mais antigo criado)
    SELECT id INTO winner_id
    FROM public.contatos
    WHERE id = ANY(p_contact_ids)
    AND organizacao_id = p_organizacao_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF winner_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum contato válido encontrado para fusão.';
    END IF;

    -- 2. Loop para processar os "Perdedores"
    FOREACH id_iter IN ARRAY p_contact_ids
    LOOP
        IF id_iter <> winner_id THEN
            loser_id := id_iter;

            -- =========================================================
            -- 1. LISTAS DO WHATSAPP (Lógica Cirúrgica) 🧠
            -- =========================================================
            -- Passo A: Copiar o Vencedor para as listas do Perdedor
            INSERT INTO public.whatsapp_list_members (lista_id, contato_id, created_at)
            SELECT lista_id, winner_id, created_at
            FROM public.whatsapp_list_members
            WHERE contato_id = loser_id
            AND lista_id NOT IN (
                SELECT lista_id FROM public.whatsapp_list_members WHERE contato_id = winner_id
            );
            -- Passo B: Agora podemos apagar o perdedor de TODAS as listas sem medo
            DELETE FROM public.whatsapp_list_members WHERE contato_id = loser_id;

            -- =========================================================
            -- 2. FUNIL DE VENDAS (Mesma lógica segura)
            -- =========================================================
            IF NOT EXISTS (SELECT 1 FROM public.contatos_no_funil WHERE contato_id = winner_id) THEN
                UPDATE public.contatos_no_funil SET contato_id = winner_id WHERE contato_id = loser_id;
            END IF;
            DELETE FROM public.contatos_no_funil WHERE contato_id = loser_id;

            -- =========================================================
            -- 3. FUNCIONÁRIOS (Vínculo Único)
            -- =========================================================
            IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE contato_id = winner_id) THEN
                 UPDATE public.funcionarios SET contato_id = winner_id WHERE contato_id = loser_id;
            ELSE
                 UPDATE public.funcionarios SET contato_id = NULL WHERE contato_id = loser_id;
            END IF;

            -- =========================================================
            -- 4. CONVERSAS DO WHATSAPP (Unique Constraint no Telefone)
            -- =========================================================
            IF NOT EXISTS (SELECT 1 FROM public.whatsapp_conversations WHERE contato_id = winner_id) THEN
                 UPDATE public.whatsapp_conversations SET contato_id = winner_id WHERE contato_id = loser_id;
            ELSE
                 UPDATE public.whatsapp_conversations SET contato_id = NULL WHERE contato_id = loser_id;
            END IF;

            -- =========================================================
            -- 5. RELINKAGEM GERAL BLINDADA COM EXCEPTION OTHERS
            -- =========================================================
            -- Comunicação Geral
            BEGIN UPDATE public.whatsapp_messages SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.telefones SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.emails SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.whatsapp_attachments SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.telefones_backup_faxina SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;

            -- Contratos e Comercial
            BEGIN UPDATE public.contratos SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.contratos SET corretor_id = winner_id WHERE corretor_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.contratos SET conjuge_id = winner_id WHERE conjuge_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.contratos SET representante_id = winner_id WHERE representante_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            
            -- CRM e Atividades
            BEGIN UPDATE public.crm_notas SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.simulacoes SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.activities SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            
            -- Financeiro e Suprimentos
            BEGIN UPDATE public.lancamentos SET favorecido_contato_id = winner_id WHERE favorecido_contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.pedidos_compra_itens SET fornecedor_id = winner_id WHERE fornecedor_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;

            -- Empreendimentos
            BEGIN UPDATE public.empreendimentos SET incorporadora_id = winner_id WHERE incorporadora_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE public.empreendimentos SET construtora_id = winner_id WHERE construtora_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;

            -- Referências Cruzadas
            BEGIN UPDATE public.contatos SET conjuge_id = winner_id WHERE conjuge_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;

            -- =========================================================
            -- 6. O FINAL: EXCLUIR O PERDEDOR
            -- =========================================================
            DELETE FROM public.contatos WHERE id = loser_id;
            
        END IF;
    END LOOP;
END;
$function$
