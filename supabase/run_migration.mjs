// Script para RECRIAR a trigger com os nomes de coluna corretos e executar a migração histórica
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres.vhuvnutzklhskkwbpxdz:Srbr19010720%40@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✅ Conectado!\n');

// Verificar estado atual
const estado = await client.query(`
    SELECT 
        (SELECT COUNT(*) FROM public.faturas_cartao) AS total_faturas,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='fatura_id') AS tem_fatura_id,
        (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table='lancamentos' AND trigger_name='trg_vincular_fatura_lancamento') AS tem_trigger
`);
console.log('📊 Estado atual do banco:');
console.table(estado.rows);

// --------------------------------------------------------
// RECRIAR a trigger function com nome de coluna CORRETO
// Na tabela lancamentos: conta_id (não conta_origem_id/conta_destino_id)
// --------------------------------------------------------
console.log('\n⏳ Recriando a função trigger com conta_id correto...');
await client.query(`
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
    v_data_comp date;
BEGIN
    -- A tabela lancamentos usa "conta_id" para TODOS os tipos (Despesa, Receita, Transferência)
    v_conta_id := NEW.conta_id;

    IF v_conta_id IS NULL THEN RETURN NEW; END IF;

    -- Verificar se é Cartão de Crédito
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

    v_data_comp := NEW.data_transacao;

    IF v_data_comp IS NULL THEN RETURN NEW; END IF;

    -- Se comprou ANTES do fechamento -> fatura do mês corrente
    -- Se comprou NO DIA ou DEPOIS do fechamento -> fatura do mês seguinte
    IF EXTRACT(DAY FROM v_data_comp) >= v_dia_fechamento THEN
        v_data_comp := v_data_comp + INTERVAL '1 month';
    END IF;
    v_mes_referencia := to_char(v_data_comp, 'YYYY-MM');

    -- Calcular data de vencimento exata
    IF v_dia_pagamento <= v_dia_fechamento THEN
        v_data_vencimento := (to_char(v_data_comp + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
    ELSE
        v_data_vencimento := (v_mes_referencia || '-' || LPAD(v_dia_pagamento::text, 2, '0'))::date;
    END IF;

    -- Sobrescrever data_vencimento com o valor calculado pela trigger
    NEW.data_vencimento := v_data_vencimento;

    -- Buscar ou criar a fatura correspondente
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
console.log('✅ Função trigger recriada com conta_id correto!');

// Recriar a trigger
console.log('\n⏳ Recriando trigger na tabela lancamentos...');
await client.query(`DROP TRIGGER IF EXISTS trg_vincular_fatura_lancamento ON public.lancamentos;`);
await client.query(`
CREATE TRIGGER trg_vincular_fatura_lancamento
BEFORE INSERT OR UPDATE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_vincular_lancamento_fatura();
`);
console.log('✅ Trigger recriada!');

// Migração histórica
console.log('\n⏳ Executando migração histórica...');
const migResult = await client.query(`
DO $$
DECLARE
    rec RECORD;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_data_comp date;
    v_mes_referencia text;
    v_data_vencimento date;
    v_fatura_id bigint;
    total_migrados integer := 0;
BEGIN
    FOR rec IN
        SELECT l.id, l.data_transacao, l.organizacao_id, l.conta_id
        FROM public.lancamentos l
        JOIN public.contas_financeiras c ON c.id = l.conta_id
        WHERE c.tipo = 'Cartão de Crédito'
          AND l.fatura_id IS NULL
          AND l.data_transacao IS NOT NULL
    LOOP
        SELECT dia_fechamento_fatura, dia_pagamento_fatura
        INTO v_dia_fechamento, v_dia_pagamento
        FROM public.contas_financeiras WHERE id = rec.conta_id;

        IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN CONTINUE; END IF;

        v_data_comp := rec.data_transacao;
        IF EXTRACT(DAY FROM v_data_comp) >= v_dia_fechamento THEN
            v_data_comp := v_data_comp + INTERVAL '1 month';
        END IF;
        v_mes_referencia := to_char(v_data_comp, 'YYYY-MM');

        IF v_dia_pagamento <= v_dia_fechamento THEN
            v_data_vencimento := (to_char(v_data_comp + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
        ELSE
            v_data_vencimento := (v_mes_referencia || '-' || LPAD(v_dia_pagamento::text, 2, '0'))::date;
        END IF;

        SELECT id INTO v_fatura_id FROM public.faturas_cartao
        WHERE conta_id = rec.conta_id AND mes_referencia = v_mes_referencia;

        IF v_fatura_id IS NULL THEN
            INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
            VALUES (rec.conta_id, v_mes_referencia, v_data_vencimento, rec.organizacao_id)
            RETURNING id INTO v_fatura_id;
        END IF;

        UPDATE public.lancamentos SET fatura_id = v_fatura_id WHERE id = rec.id;
        total_migrados := total_migrados + 1;
    END LOOP;
    RAISE NOTICE 'Migrados % lançamentos históricos.', total_migrados;
END;
$$;
`);
console.log('✅ Migração histórica concluída!');

// Resultado final
const resultado = await client.query(`
    SELECT 
        cf.nome AS cartao,
        fc.mes_referencia,
        fc.data_vencimento,
        fc.status,
        COUNT(l.id) AS total_lancamentos,
        SUM(CASE WHEN l.tipo='Despesa' THEN l.valor ELSE 0 END) AS total_despesas
    FROM public.faturas_cartao fc
    JOIN public.contas_financeiras cf ON cf.id = fc.conta_id
    LEFT JOIN public.lancamentos l ON l.fatura_id = fc.id
    GROUP BY cf.nome, fc.id, fc.mes_referencia, fc.data_vencimento, fc.status
    ORDER BY fc.mes_referencia DESC LIMIT 15;
`);
console.log('\n📊 FATURAS CRIADAS NO BANCO (últimas 15):');
console.table(resultado.rows);

// Quantos lançamentos ainda sem fatura
const sem_fatura = await client.query(`
    SELECT COUNT(*) AS sem_fatura
    FROM public.lancamentos l
    JOIN public.contas_financeiras c ON c.id = l.conta_id
    WHERE c.tipo = 'Cartão de Crédito' AND l.fatura_id IS NULL;
`);
console.log(`\n⚠️  Lançamentos de cartão AINDA sem fatura: ${sem_fatura.rows[0].sem_fatura}`);

await client.end();
console.log('\n🔌 Concluído!');
