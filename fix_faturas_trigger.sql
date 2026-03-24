-- SCRIPT DE CORREÇÃO DO SISTEMA DE FATURAS E PARCELAMENTO
-- Rode este script no painel SQL Editor do Supabase

CREATE OR REPLACE FUNCTION public.fn_vincular_lancamento_fatura()
RETURNS trigger AS $$
DECLARE
    v_conta_id bigint;
    v_tipo_conta text;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_mes_referencia text;
    v_data_vencimento date;
    v_fatura_id bigint;
    v_data_base date;
BEGIN
    -- PROTEÇÃO PRINCIPAL (ANCORAGEM)
    -- Se for um UPDATE onde as datas e contas cruciais não mudaram, não recalcula a fatura!
    -- Isso evita que ao clicar em "Processar/Conciliar", os parcelamentos retroativos fujam da fatura correta.
    IF TG_OP = 'UPDATE' THEN
        IF NEW.data_transacao = OLD.data_transacao 
           AND NEW.data_vencimento = OLD.data_vencimento 
           AND NEW.conta_id IS NOT DISTINCT FROM OLD.conta_id 
           AND NEW.tipo = OLD.tipo THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Determinar a conta, usando conta_id (a tabela de lançamentos possui conta_id e não origem_id)
    IF NEW.tipo IN ('Despesa', 'Receita') THEN
        v_conta_id := NEW.conta_id;

        IF v_conta_id IS NOT NULL THEN
            -- Buscar informações da conta
            SELECT tipo, dia_fechamento_fatura, dia_pagamento_fatura 
            INTO v_tipo_conta, v_dia_fechamento, v_dia_pagamento
            FROM public.contas_financeiras 
            WHERE id = v_conta_id;

            IF v_tipo_conta = 'Cartão de Crédito' THEN
                
                -- Se não houver dia fechamento ou pagamento configurado, ignorar
                IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN
                    RETURN NEW;
                END IF;

                -- CONFIANÇA NO PARCELAMENTO / FRONTEND:
                -- Se a data de vencimento foi preenchida pelo sistema COM base no dia do cartão,
                -- devemos respeitar! Isso arruma o bug dos 12 parcelamentos caindo no mesmo mês.
                IF NEW.data_vencimento IS NOT NULL AND EXTRACT(DAY FROM NEW.data_vencimento) = v_dia_pagamento THEN
                    v_data_vencimento := NEW.data_vencimento;
                    
                    -- Define o mes_referencia baseado naprópria data_vencimento (ancorada)
                    IF v_dia_pagamento <= v_dia_fechamento THEN
                        v_mes_referencia := to_char(v_data_vencimento - INTERVAL '1 month', 'YYYY-MM');
                    ELSE
                        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');
                    END IF;
                ELSE
                    -- Fallback: Recalcula tudo a partir da data de transação (compra) caso os dados do frontend sejam insuficientes.
                    v_data_base := NEW.data_transacao;

                    IF EXTRACT(DAY FROM v_data_base) >= v_dia_fechamento THEN
                        v_data_base := v_data_base + INTERVAL '1 month';
                    END IF;

                    v_mes_referencia := to_char(v_data_base, 'YYYY-MM');

                    IF v_dia_pagamento <= v_dia_fechamento THEN
                       v_data_vencimento := (to_char(v_data_base + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    ELSE
                       v_data_vencimento := (v_mes_referencia || '-' || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    END IF;
                    
                    NEW.data_vencimento := v_data_vencimento;
                END IF;

                -- BUSCAR OU CRIAR A FATURA no banco
                SELECT id INTO v_fatura_id 
                FROM public.faturas_cartao 
                WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

                IF v_fatura_id IS NULL THEN
                    -- Se não existe, cria a fatura nova do cartão
                    INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
                    VALUES (v_conta_id, v_mes_referencia, v_data_vencimento, NEW.organizacao_id)
                    RETURNING id INTO v_fatura_id;
                END IF;

                -- Amarrar o lançamento à fatura correta
                NEW.fatura_id := v_fatura_id;
            ELSE
                -- Se não é cartão de crédito, garantir que fatura_id seja nulo
                NEW.fatura_id := NULL;
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
