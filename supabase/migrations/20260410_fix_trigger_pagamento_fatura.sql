-- =======================================================================================
-- AUDITORIA COMPLETA E REVISÃO: TRIGGER DE FATURAS DE CARTÃO DE CRÉDITO (STUDIO 57)
-- =======================================================================================
-- Problemas Resolvidos na Auditoria:
-- 1. Colunas Fantasmas: O código antigo tentava puxar "conta_origem_id" que não existe em lancamentos.
-- 2. Bug do "Limbo de Datas": Editar a data do lançamento NÃO mudava a fatura porque 
--    a trigger ignorava qualquer update se a fatura atual (herdada da versão antiga) já fosse NOT NULL.
-- 3. Vazamento de Dados: Ao auto-criar faturas, o campo "data_fechamento" da Fatura ficava NULO.
-- 4. Matemática do Ciclo: Cálculos amarrados exclusivamente na Data de Vencimento (Mês de Referência do Studio57).
-- =======================================================================================

CREATE OR REPLACE FUNCTION public.fn_vincular_lancamento_fatura()
RETURNS trigger AS $$
DECLARE
    v_conta_id bigint;
    v_tipo_conta text;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    
    v_mes_fechamento date;
    v_data_fechamento_exata date;
    v_data_vencimento date;
    v_mes_referencia text;
    v_fatura_id bigint;
BEGIN
    -- [1] MECANISMO DE DEFESA E INJEÇÃO MANUAL (Prevenção do Bug do Limbo de Datas)
    IF TG_OP = 'INSERT' THEN
        -- Se o lançamento estiver nascendo já com uma fatura injetada (Ex: Pela IA de Extratos em Lote)
        IF NEW.fatura_id IS NOT NULL THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Se o usuário ou sistema mudar explicitamente a fatura no Update, nós respeitamos a mudança.
        -- Se for apenas uma alteração comum (ex: corrigindo o Valor ou a Data), nós RECALCULAMOS.
        IF NEW.fatura_id IS DISTINCT FROM OLD.fatura_id THEN
            RETURN NEW;
        END IF;
    END IF;

    -- [2] VINCULAÇÃO EXCLUSIVA DE CONTA (Proteção contra Colunas Fantasmas)
    IF NEW.tipo IN ('Despesa', 'Receita') THEN
        v_conta_id := NEW.conta_id;

        IF v_conta_id IS NOT NULL THEN
            -- Consultar dicionário da conta no banco
            SELECT tipo, dia_fechamento_fatura, dia_pagamento_fatura 
            INTO v_tipo_conta, v_dia_fechamento, v_dia_pagamento
            FROM public.contas_financeiras 
            WHERE id = v_conta_id;

            IF v_tipo_conta = 'Cartão de Crédito' THEN
                
                -- Se não existe regra de dias, então falha graciosamente.
                IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN
                    RETURN NEW;
                END IF;

                -- [3] O CÁLCULO GERAL (COMPRAS E PAGAMENTOS)
                -- Se efetuou no próprio dia do Fechamento ou antes -> Mês corrente = Mês base de fechamento.
                -- Ex: Comprou 28 num cartão que fecha 28 -> Fatura de Fechamento em Fevereiro. 
                -- Ex: Comprou 29 num cartão que fecha 28 -> Fatura de Fechamento em Março.
                IF EXTRACT(DAY FROM NEW.data_transacao) <= v_dia_fechamento THEN
                    v_mes_fechamento := date_trunc('month', NEW.data_transacao);
                ELSE
                    v_mes_fechamento := date_trunc('month', NEW.data_transacao) + INTERVAL '1 month';
                END IF;

                -- Data Exata de Fechamento Preenchida para Auto-Criação de Fatura
                v_data_fechamento_exata := (to_char(v_mes_fechamento, 'YYYY-MM-') || LPAD(v_dia_fechamento::text, 2, '0'))::date;

                -- [4] VENCIMENTO DA FATURA
                -- Se o dia do pagamento for menor que o de fechamento, a fatura vence no Mês Seguinte ao fechamento!
                IF v_dia_pagamento <= v_dia_fechamento THEN
                    v_data_vencimento := (to_char(v_mes_fechamento + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                ELSE
                    -- Se o pagamento for maior ou igual ao número do dia do fechamento, costuma ser dentro do mesmo mês base.
                    v_data_vencimento := (to_char(v_mes_fechamento, 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                END IF;

                -- NO STUDIO 57, O MÊS REFERÊNCIA DE UMA FATURA ACOMPANHA IGUALMENTE O MÊS/ANO DE SEU VENCIMENTO.
                v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');

                -- Forçar o lançamento a vencer junto com a Fatura que o contém
                NEW.data_vencimento := v_data_vencimento;

                -- [5] AUTO-CRIADOR DE FATURAS (The Fatura Fetcher)
                SELECT id INTO v_fatura_id 
                FROM public.faturas_cartao 
                WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

                IF v_fatura_id IS NULL THEN
                    INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, data_fechamento, organizacao_id)
                    VALUES (v_conta_id, v_mes_referencia, v_data_vencimento, v_data_fechamento_exata, NEW.organizacao_id)
                    RETURNING id INTO v_fatura_id;
                END IF;

                -- Conectar o lançamento (O Override Final)
                NEW.fatura_id := v_fatura_id;
            ELSE
                -- Se mudou o lançamento de Cartão para uma Conta Tradicional (ex: Caixa Fixo), ele limpa a Fatura!
                NEW.fatura_id := NULL;
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
