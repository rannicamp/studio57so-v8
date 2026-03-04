const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const db = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await db.connect();
    console.log('✅ Conectado ao banco!\n');

    console.log('⏳ 1. Adicionando colunas data_fechamento e data_vencimento na tabela faturas_cartao...');
    try {
        await db.query(`ALTER TABLE public.faturas_cartao ADD COLUMN IF NOT EXISTS data_fechamento date;`);
        await db.query(`ALTER TABLE public.faturas_cartao ADD COLUMN IF NOT EXISTS data_vencimento date;`);
        console.log('✅ Colunas adicionadas!');
    } catch (e) {
        console.error('Erro ao adicionar colunas:', e.message);
    }

    console.log('\n⏳ 2. Recriando trigger fn_vincular_lancamento_fatura...');
    await db.query(`
CREATE OR REPLACE FUNCTION public.fn_vincular_lancamento_fatura()
RETURNS trigger AS $$
DECLARE
    v_conta_id bigint;
    v_tipo_conta text;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_mes_referencia text;
    
    v_data_ref date;
    v_data_fechamento date;
    v_data_vencimento date;
    v_fatura_id bigint;
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
    -- MATEMÁTICA CORRIGIDA DO CARTÃO DE CRÉDITO:
    -- =====================================================================

    IF NEW.data_vencimento IS NOT NULL THEN
        -- Se vier do frontend (Ex: Modal Parcelado ou Ajuste Manual)
        v_data_vencimento := NEW.data_vencimento;
        
        -- Descobrir fechamento retroativamente a partir do vencimento
        IF v_dia_pagamento <= v_dia_fechamento THEN
            -- Se paga dia 7 e fecha dia 28, o fechamento é no MÊS ANTERIOR ao vencimento
            v_data_fechamento := (to_char(v_data_vencimento - INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_fechamento::text, 2, '0'))::date;
        ELSE
            -- Se paga dia 20 e fecha dia 10, o fechamento é NO MESMO MÊS do vencimento
            v_data_fechamento := (to_char(v_data_vencimento, 'YYYY-MM-') || LPAD(v_dia_fechamento::text, 2, '0'))::date;
        END IF;

        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');
        
    ELSE
        -- Se for cadastro de transação comum, onde só temos a data_transacao
        IF NEW.data_transacao IS NULL THEN RETURN NEW; END IF;
        
        v_data_ref := NEW.data_transacao;
        
        -- Mês base do fechamento começa sendo o mês da transação
        v_data_fechamento := (to_char(v_data_ref, 'YYYY-MM-') || LPAD(v_dia_fechamento::text, 2, '0'))::date;
        
        -- Se a transação passou do dia de fechamento, ela cai no fechamento do PRÓXIMO MÊS
        IF EXTRACT(DAY FROM v_data_ref) >= v_dia_fechamento THEN
            v_data_fechamento := v_data_fechamento + INTERVAL '1 month';
        END IF;

        -- Calcula o vencimento a partir da data de fechamento final
        IF v_dia_pagamento <= v_dia_fechamento THEN
            -- Se paga dia 7 e fechou dia 28, o vencimento é no PRÓXIMO MÊS do fechamento
            v_data_vencimento := (to_char(v_data_fechamento + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
        ELSE
            -- Se paga dia 20 e fechou dia 10, o vencimento é no MESMO MÊS do fechamento
            v_data_vencimento := (to_char(v_data_fechamento, 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
        END IF;

        -- Mes referencia passa a ser O MÊS DO VENCIMENTO!
        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');

        -- Assinala o vencimento real no lançamento (para constar na listagem)
        NEW.data_vencimento := v_data_vencimento;
    END IF;

    -- =====================================================================
    -- Buscar ou Criar Fatura (usando v_mes_referencia focado no vencimento)
    -- =====================================================================
    SELECT id INTO v_fatura_id FROM public.faturas_cartao
    WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

    IF v_fatura_id IS NULL THEN
        INSERT INTO public.faturas_cartao (
            conta_id, 
            mes_referencia, 
            data_fechamento, 
            data_vencimento, 
            organizacao_id
        )
        VALUES (
            v_conta_id, 
            v_mes_referencia, 
            v_data_fechamento, 
            v_data_vencimento, 
            NEW.organizacao_id
        )
        RETURNING id INTO v_fatura_id;
    ELSE
        -- Atualiza se a fatura já existir mas as datas reais estiverem vazias ou erradas
        UPDATE public.faturas_cartao 
        SET data_fechamento = v_data_fechamento, data_vencimento = v_data_vencimento
        WHERE id = v_fatura_id AND (data_fechamento IS NULL OR data_vencimento IS NULL);
    END IF;

    NEW.fatura_id := v_fatura_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('✅ Trigger recriada com sucesso!');

    console.log('\n⏳ 3. Re-vinculando faturas passadas e calculando datas retroativamente...');
    await db.query(`
DO $$
DECLARE
    rec RECORD;
    v_data_fechamento date;
    v_data_vencimento date;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_mes_referencia text;
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
        
        -- Usa o data_vencimento que o lançamento já tiver
        IF rec.data_vencimento IS NOT NULL THEN
            v_data_vencimento := rec.data_vencimento;
        ELSE
            IF rec.data_transacao IS NULL THEN CONTINUE; END IF;
            -- Recalcula se o lançamento não tinha vencimento
            v_data_fechamento := (to_char(rec.data_transacao, 'YYYY-MM-') || LPAD(v_dia_fechamento::text, 2, '0'))::date;
            IF EXTRACT(DAY FROM rec.data_transacao) >= v_dia_fechamento THEN
                v_data_fechamento := v_data_fechamento + INTERVAL '1 month';
            END IF;
            IF v_dia_pagamento <= v_dia_fechamento THEN
                v_data_vencimento := (to_char(v_data_fechamento + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
            ELSE
                v_data_vencimento := (to_char(v_data_fechamento, 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
            END IF;
        END IF;

        -- Calcula o fechamento baseado no vencimento
        IF v_dia_pagamento <= v_dia_fechamento THEN
            v_data_fechamento := (to_char(v_data_vencimento - INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_fechamento::text, 2, '0'))::date;
        ELSE
            v_data_fechamento := (to_char(v_data_vencimento, 'YYYY-MM-') || LPAD(v_dia_fechamento::text, 2, '0'))::date;
        END IF;

        -- Determina a mes_referencia usando O VENCIMENTO
        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');

        -- Buscar ou criar fatura real
        SELECT id INTO v_fatura_id FROM public.faturas_cartao
        WHERE conta_id = rec.conta_id AND mes_referencia = v_mes_referencia;

        IF v_fatura_id IS NULL THEN
            INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_fechamento, data_vencimento, organizacao_id)
            VALUES (rec.conta_id, v_mes_referencia, v_data_fechamento, v_data_vencimento, rec.organizacao_id)
            RETURNING id INTO v_fatura_id;
        ELSE
            UPDATE public.faturas_cartao 
            SET data_fechamento = v_data_fechamento, data_vencimento = v_data_vencimento
            WHERE id = v_fatura_id;
        END IF;

        -- Atualiza Lançamento
        UPDATE public.lancamentos 
        SET fatura_id = v_fatura_id, data_vencimento = v_data_vencimento 
        WHERE id = rec.id AND (fatura_id IS DISTINCT FROM v_fatura_id OR data_vencimento IS DISTINCT FROM v_data_vencimento);
        
        total := total + 1;
    END LOOP;
    
    -- Limpar faturas velhas zeradas orfãs (opcional)
    DELETE FROM public.faturas_cartao WHERE id NOT IN (SELECT fatura_id FROM public.lancamentos WHERE fatura_id IS NOT NULL) AND status != 'Pago';
    
    RAISE NOTICE 'Processados % lançamentos!', total;
END;
$$;
    `);
    console.log('✅ Re-processamento histórico concluído!');

    // Resultado!
    const res = await db.query(`
        SELECT cf.nome, fc.mes_referencia, to_char(fc.data_fechamento, 'DD/MM') as fechamento, to_char(fc.data_vencimento, 'DD/MM/YYYY') as vencimento, COUNT(l.id) as qtd_lancamentos
        FROM public.faturas_cartao fc
        JOIN public.contas_financeiras cf ON cf.id = fc.conta_id
        LEFT JOIN public.lancamentos l ON l.fatura_id = fc.id
        GROUP BY cf.nome, fc.mes_referencia, fc.data_fechamento, fc.data_vencimento
        ORDER BY cf.nome, fc.mes_referencia DESC
        LIMIT 10;
    `);
    console.table(res.rows);

    await db.end();
}

main().catch(console.error);
