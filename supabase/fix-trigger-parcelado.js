// Corrigir a trigger para respeitar data_vencimento já fornecido pelo frontend
// O problema: trigger recalcula data_vencimento a partir de data_transacao,
// mas no parcelado o frontend já envia data_vencimento correta por parcela.
// A trigger desfazia esse trabalho!

const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const db = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await db.connect();
    console.log('✅ Conectado!\n');

    // === PASSO 1: Recriar a trigger com a lógica corrigida ===
    console.log('⏳ Recriando trigger com lógica corrigida...');
    await db.query(`
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
    v_data_ref date;
BEGIN
    v_conta_id := NEW.conta_id;
    IF v_conta_id IS NULL THEN RETURN NEW; END IF;

    SELECT tipo, dia_fechamento_fatura, dia_pagamento_fatura
    INTO v_tipo_conta, v_dia_fechamento, v_dia_pagamento
    FROM public.contas_financeiras WHERE id = v_conta_id;

    IF v_tipo_conta IS DISTINCT FROM 'Cartão de Crédito' THEN
        NEW.fatura_id := NULL;
        RETURN NEW;
    END IF;

    IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN
        RETURN NEW;
    END IF;

    -- =====================================================================
    -- LÓGICA CORRIGIDA:
    -- Se o frontend já enviou data_vencimento (caso de compras parceladas),
    -- usamos ela diretamente para saber a qual fatura pertence.
    -- Só calculamos se data_vencimento estiver NULL (compra simples).
    -- =====================================================================

    IF NEW.data_vencimento IS NOT NULL THEN
        -- Usar o data_vencimento já fornecido para determinar a fatura
        -- mes_referencia = YYYY-MM do próprio vencimento
        v_data_vencimento := NEW.data_vencimento;
        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');
    ELSE
        -- Calcular data_vencimento a partir de data_transacao (compra simples)
        IF NEW.data_transacao IS NULL THEN RETURN NEW; END IF;
        
        v_data_ref := NEW.data_transacao;
        IF EXTRACT(DAY FROM v_data_ref) >= v_dia_fechamento THEN
            v_data_ref := v_data_ref + INTERVAL '1 month';
        END IF;
        v_mes_referencia := to_char(v_data_ref, 'YYYY-MM');

        IF v_dia_pagamento <= v_dia_fechamento THEN
            v_data_vencimento := (to_char(v_data_ref + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
        ELSE
            v_data_vencimento := (v_mes_referencia || '-' || LPAD(v_dia_pagamento::text, 2, '0'))::date;
        END IF;

        -- Só agora atribuímos data_vencimento (pois era NULL)
        NEW.data_vencimento := v_data_vencimento;
    END IF;

    -- Buscar ou criar a fatura do mês correspondente
    SELECT id INTO v_fatura_id FROM public.faturas_cartao
    WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

    IF v_fatura_id IS NULL THEN
        INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
        VALUES (v_conta_id, v_mes_referencia, v_data_vencimento, NEW.organizacao_id)
        RETURNING id INTO v_fatura_id;
    END IF;

    NEW.fatura_id := v_fatura_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('✅ Trigger recriada com lógica corrigida!\n');

    // === PASSO 2: Re-vincular lançamentos parcelados existentes ===
    // Agora usa data_vencimento de cada parcela (não data_transacao)
    console.log('⏳ Re-vinculando lançamentos parcelados ao mes_referencia correto...');
    await db.query(`
DO $$
DECLARE
    rec RECORD;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_mes_referencia text;
    v_data_vencimento date;
    v_fatura_id bigint;
    total integer := 0;
BEGIN
    FOR rec IN
        SELECT l.id, l.data_vencimento, l.data_transacao, l.organizacao_id, l.conta_id, l.fatura_id
        FROM public.lancamentos l
        JOIN public.contas_financeiras c ON c.id = l.conta_id
        WHERE c.tipo = 'Cartão de Crédito'
          AND l.data_vencimento IS NOT NULL
          AND l.data_transacao IS NOT NULL
    LOOP
        -- Usar data_vencimento da parcela para determinar a fatura (lógica corrigida)
        v_data_vencimento := rec.data_vencimento;
        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');

        SELECT dia_fechamento_fatura, dia_pagamento_fatura
        INTO v_dia_fechamento, v_dia_pagamento
        FROM public.contas_financeiras WHERE id = rec.conta_id;

        IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN CONTINUE; END IF;

        -- Buscar ou criar fatura
        SELECT id INTO v_fatura_id FROM public.faturas_cartao
        WHERE conta_id = rec.conta_id AND mes_referencia = v_mes_referencia;

        IF v_fatura_id IS NULL THEN
            INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
            VALUES (rec.conta_id, v_mes_referencia, v_data_vencimento, rec.organizacao_id)
            RETURNING id INTO v_fatura_id;
        END IF;

        -- Atualizar só se a fatura mudou (evita updates desnecessários)
        IF rec.fatura_id IS DISTINCT FROM v_fatura_id THEN
            UPDATE public.lancamentos SET fatura_id = v_fatura_id WHERE id = rec.id;
            total := total + 1;
        END IF;
    END LOOP;
    RAISE NOTICE 'Re-vinculados % lançamentos ao mes_referencia correto.', total;
END;
$$;
    `);
    console.log('✅ Re-vinculação histórica concluída!\n');

    // === RESULTADO FINAL ===
    const resultado = await db.query(`
        SELECT 
            cf.nome AS cartao,
            fc.mes_referencia,
            fc.data_vencimento,
            COUNT(l.id) AS lancamentos,
            COALESCE(SUM(CASE WHEN l.tipo='Despesa' THEN l.valor ELSE 0 END), 0) AS despesas
        FROM public.faturas_cartao fc
        JOIN public.contas_financeiras cf ON cf.id = fc.conta_id
        LEFT JOIN public.lancamentos l ON l.fatura_id = fc.id
        GROUP BY cf.nome, fc.id, fc.mes_referencia, fc.data_vencimento
        ORDER BY cf.nome, fc.mes_referencia DESC LIMIT 20;
    `);
    console.log('📊 FATURAS APÓS CORREÇÃO:');
    console.table(resultado.rows);

    await db.end();
    console.log('🔌 Concluído!');
}

main().catch(err => console.error('❌ FATAL:', err.message));
