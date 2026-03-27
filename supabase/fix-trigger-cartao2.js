const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const db = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await db.connect();
    console.log('✅ Conectado ao banco para o FIX DO TRIGGER (v3)!');

    console.log('\n⏳ 1. Recriando trigger fn_vincular_lancamento_fatura com a NOVA REGRA (Mês Vencimento)...');
    await db.query(`
CREATE OR REPLACE FUNCTION public.fn_vincular_lancamento_fatura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    IF TG_OP = 'UPDATE' THEN
        -- Se nenhuma coluna crucial mudar, a gente ABORTA a verificação para economizar DB
        -- EXCEÇÃO: se o frontend MUDAR o fatura_id explicitamente (ex: re-alocar), não podemos abortar.
        -- Então adicionamos: 'AND NEW.fatura_id IS NOT DISTINCT FROM OLD.fatura_id'
        IF NEW.data_transacao = OLD.data_transacao 
           AND NEW.data_vencimento = OLD.data_vencimento 
           AND NEW.conta_id IS NOT DISTINCT FROM OLD.conta_id 
           AND NEW.fatura_id IS NOT DISTINCT FROM OLD.fatura_id
           AND NEW.tipo = OLD.tipo THEN
            RETURN NEW;
        END IF;
    END IF;

    IF NEW.tipo IN ('Despesa', 'Receita') THEN
        v_conta_id := NEW.conta_id;

        IF v_conta_id IS NOT NULL THEN
            SELECT tipo, dia_fechamento_fatura, dia_pagamento_fatura 
            INTO v_tipo_conta, v_dia_fechamento, v_dia_pagamento
            FROM public.contas_financeiras 
            WHERE id = v_conta_id;

            IF v_tipo_conta = 'Cartão de Crédito' THEN
                IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN
                    RETURN NEW;
                END IF;

                -- REGRA DE OURO DEFINITIVA: 
                -- Mês Referência é **SEMPRE** O MÊS DO VENCIMENTO! NUNCA HÁ SUBTRAÇÃO/SOMA DE MÊS AQUI.

                IF NEW.data_vencimento IS NOT NULL THEN
                    -- O Vencimento veio preenchido (do frontend ou modal). Respeita ele.
                    v_data_vencimento := NEW.data_vencimento;
                ELSE
                    -- Fallback: Se não tem vencimento, calcula a partir do dia de fechamento vs transação
                    v_data_base := NEW.data_transacao;

                    IF EXTRACT(DAY FROM v_data_base) >= v_dia_fechamento THEN
                        v_data_base := v_data_base + INTERVAL '1 month';
                    END IF;

                    IF v_dia_pagamento <= v_dia_fechamento THEN
                       v_data_vencimento := (to_char(v_data_base + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    ELSE
                       -- Mesma coisa do mês base
                       v_data_vencimento := (to_char(v_data_base, 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    END IF;
                    
                    NEW.data_vencimento := v_data_vencimento;
                END IF;

                -- CALCULA O MES REFERENCIA EXATAMENTE IGUAL AO DATA_VENCIMENTO
                v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');

                -- BUSCAR OU CRIAR A FATURA no banco
                SELECT id INTO v_fatura_id 
                FROM public.faturas_cartao 
                WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

                IF v_fatura_id IS NULL THEN
                    INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
                    VALUES (v_conta_id, v_mes_referencia, v_data_vencimento, NEW.organizacao_id)
                    RETURNING id INTO v_fatura_id;
                END IF;

                -- Amarrar o lançamento à fatura correta
                NEW.fatura_id := v_fatura_id;
            ELSE
                NEW.fatura_id := NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
    `);
    console.log('✅ Trigger ATUALIZADA com SUCESSO!');

    console.log('\n⏳ 2. Re-processando todo o histórico do banco de dados para encaixar cada lançamento na fatura certa...');
    
    // Agora o DB PLPGSQL limpa as faturas e realoca
    await db.query(`
DO $$
DECLARE
    rec RECORD;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_mes_referencia text;
    v_data_vencimento date;
    v_data_base date;
    v_fatura_id bigint;
    total integer := 0;
BEGIN
    FOR rec IN
        SELECT l.id, l.data_vencimento, l.data_transacao, l.organizacao_id, l.conta_id, c.dia_fechamento_fatura, c.dia_pagamento_fatura
        FROM public.lancamentos l
        JOIN public.contas_financeiras c ON c.id = l.conta_id
        WHERE c.tipo = 'Cartão de Crédito'
          AND c.dia_fechamento_fatura IS NOT NULL AND c.dia_pagamento_fatura IS NOT NULL
    LOOP
        v_dia_fechamento := rec.dia_fechamento_fatura;
        v_dia_pagamento := rec.dia_pagamento_fatura;
        
        IF rec.data_vencimento IS NOT NULL THEN
            v_data_vencimento := rec.data_vencimento;
        ELSE
            IF rec.data_transacao IS NULL THEN CONTINUE; END IF;
            v_data_base := rec.data_transacao;
            IF EXTRACT(DAY FROM v_data_base) >= v_dia_fechamento THEN
                v_data_base := v_data_base + INTERVAL '1 month';
            END IF;
            IF v_dia_pagamento <= v_dia_fechamento THEN
                v_data_vencimento := (to_char(v_data_base + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
            ELSE
                v_data_vencimento := (to_char(v_data_base, 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
            END IF;
        END IF;

        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');

        -- Buscar ou criar
        SELECT id INTO v_fatura_id FROM public.faturas_cartao
        WHERE conta_id = rec.conta_id AND mes_referencia = v_mes_referencia;

        IF v_fatura_id IS NULL THEN
            INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
            VALUES (rec.conta_id, v_mes_referencia, v_data_vencimento, rec.organizacao_id)
            RETURNING id INTO v_fatura_id;
        ELSE
            -- Garantir que a fatura tem a data de vencimento preenchida se tiver vazia
            UPDATE public.faturas_cartao 
            SET data_vencimento = v_data_vencimento
            WHERE id = v_fatura_id AND data_vencimento IS NULL;
        END IF;

        -- Forçar a atualização da Fatura ID e data de vencimento no lancamento!
        UPDATE public.lancamentos 
        SET fatura_id = v_fatura_id, data_vencimento = v_data_vencimento 
        WHERE id = rec.id AND (fatura_id IS DISTINCT FROM v_fatura_id OR data_vencimento IS DISTINCT FROM v_data_vencimento);
        
        total := total + 1;
    END LOOP;
    
    -- Limpar as faturas vazias (orfães) que restaram da trigger antiga (exceto vagas pagas)
    DELETE FROM public.faturas_cartao 
    WHERE id NOT IN (SELECT fatura_id FROM public.lancamentos WHERE fatura_id IS NOT NULL) 
    AND status != 'Pago';
    
    RAISE NOTICE 'Processados % lançamentos!', total;
END;
$$;
    `);
    console.log('✅ Histórico Realocado com SUCESSO!');

    // Mostra as faturas agrupadas pós-fix
    const res = await db.query(`
        SELECT cf.nome, fc.id as "ID Fatura", fc.mes_referencia as "Mês Ref", to_char(fc.data_vencimento, 'DD/MM/YYYY') as "Vencimento", COUNT(l.id) as "Lançamentos"
        FROM public.faturas_cartao fc
        JOIN public.contas_financeiras cf ON cf.id = fc.conta_id
        LEFT JOIN public.lancamentos l ON l.fatura_id = fc.id
        GROUP BY cf.nome, fc.id, fc.mes_referencia, fc.data_vencimento
        ORDER BY cf.nome, fc.mes_referencia DESC
        LIMIT 10;
    `);
    console.table(res.rows);

    await db.end();
}

main().catch(console.error);
