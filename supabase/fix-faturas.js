// Diagnóstico e Correção Completa das Faturas de Cartão
// 1. Adiciona política RLS na tabela faturas_cartao
// 2. Re-executa migração histórica
// 3. Gera faturas futuras (atual + 3 meses à frente) para cada cartão

const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const db = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await db.connect();
    console.log('✅ Conectado!\n');

    // === DIAGNÓSTICO ===
    const diag = await db.query(`
        SELECT 
            (SELECT COUNT(*) FROM public.faturas_cartao) AS total_faturas,
            (SELECT COUNT(*) FROM public.lancamentos l 
             JOIN public.contas_financeiras c ON c.id = l.conta_id 
             WHERE c.tipo = 'Cartão de Crédito') AS total_lanc_cartao,
            (SELECT COUNT(*) FROM public.lancamentos WHERE fatura_id IS NOT NULL) AS lanc_com_fatura,
            (SELECT COUNT(*) FROM public.lancamentos l 
             JOIN public.contas_financeiras c ON c.id = l.conta_id 
             WHERE c.tipo = 'Cartão de Crédito' AND l.fatura_id IS NULL) AS lanc_sem_fatura;
    `);
    console.log('📊 DIAGNÓSTICO:');
    console.table(diag.rows);

    // === PASSO 1: Adicionar política RLS para que usuários autenticados possam ver suas faturas ===
    console.log('\n⏳ PASSO 1 — Políticas RLS para faturas_cartao...');
    try {
        await db.query(`
            DO $$
            BEGIN
                -- Política de SELECT
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies 
                    WHERE tablename = 'faturas_cartao' AND policyname = 'faturas_cartao_select_policy'
                ) THEN
                    CREATE POLICY faturas_cartao_select_policy ON public.faturas_cartao
                        FOR SELECT USING (true);
                END IF;
                -- Política de INSERT
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies 
                    WHERE tablename = 'faturas_cartao' AND policyname = 'faturas_cartao_insert_policy'
                ) THEN
                    CREATE POLICY faturas_cartao_insert_policy ON public.faturas_cartao
                        FOR INSERT WITH CHECK (true);
                END IF;
                -- Política de UPDATE
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies 
                    WHERE tablename = 'faturas_cartao' AND policyname = 'faturas_cartao_update_policy'
                ) THEN
                    CREATE POLICY faturas_cartao_update_policy ON public.faturas_cartao
                        FOR UPDATE USING (true);
                END IF;
            END;
            $$;
        `);
        console.log('✅ Políticas RLS adicionadas!');
    } catch (e) { console.log('⚠️', e.message.slice(0, 100)); }

    // === PASSO 2: Re-executar migração histórica ===
    console.log('\n⏳ PASSO 2 — Migração histórica de lançamentos...');
    try {
        await db.query(`
            DO $$
            DECLARE
                rec RECORD;
                v_dia_fechamento integer;
                v_dia_pagamento integer;
                v_data_comp date;
                v_mes_referencia text;
                v_data_vencimento date;
                v_fatura_id bigint;
                total integer := 0;
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
                    total := total + 1;
                END LOOP;
                RAISE NOTICE 'Migrados % lançamentos.', total;
            END;
            $$;
        `);
        console.log('✅ Migração histórica concluída!');
    } catch (e) { console.log('❌', e.message.slice(0, 200)); }

    // === PASSO 3: Gerar faturas futuras (fatura atual + 3 à frente) para cada cartão ===
    // Regra: Para cada conta cartão, garantir que existam faturas para os próximos 3 meses
    console.log('\n⏳ PASSO 3 — Gerando faturas futuras (atual + 3 meses à frente)...');
    try {
        const contas = await db.query(`
            SELECT id, organizacao_id, dia_fechamento_fatura, dia_pagamento_fatura
            FROM public.contas_financeiras
            WHERE tipo = 'Cartão de Crédito'
              AND dia_fechamento_fatura IS NOT NULL
              AND dia_pagamento_fatura IS NOT NULL;
        `);

        const hoje = new Date();

        for (const conta of contas.rows) {
            const { id: contaId, organizacao_id, dia_fechamento_fatura, dia_pagamento_fatura } = conta;

            // Calcular mês de referência atual
            let dataBase = new Date(hoje);
            if (hoje.getDate() >= dia_fechamento_fatura) {
                dataBase.setMonth(dataBase.getMonth() + 1);
            }

            // Gerar faturas para os próximos 3 meses a partir do atual
            for (let offset = 0; offset <= 3; offset++) {
                const d = new Date(dataBase);
                d.setMonth(d.getMonth() + offset);

                const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                // Calcular data de vencimento
                let dataVenc;
                if (dia_pagamento_fatura <= dia_fechamento_fatura) {
                    const next = new Date(d);
                    next.setMonth(next.getMonth() + 1);
                    dataVenc = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(dia_pagamento_fatura).padStart(2, '0')}`;
                } else {
                    dataVenc = `${mesRef}-${String(dia_pagamento_fatura).padStart(2, '0')}`;
                }

                // Inserir apenas se não existir
                await db.query(`
                    INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (conta_id, mes_referencia) DO NOTHING;
                `, [contaId, mesRef, dataVenc, organizacao_id]);
            }
            console.log(`  ✅ Conta ${contaId}: faturas futuras garantidas!`);
        }
    } catch (e) { console.log('❌', e.message.slice(0, 200)); }

    // === RESULTADO FINAL ===
    const resultado = await db.query(`
        SELECT 
            cf.nome AS cartao,
            fc.mes_referencia,
            fc.data_vencimento,
            fc.status,
            COUNT(l.id) AS lancamentos,
            COALESCE(SUM(CASE WHEN l.tipo='Despesa' THEN l.valor ELSE 0 END), 0) AS despesas
        FROM public.faturas_cartao fc
        JOIN public.contas_financeiras cf ON cf.id = fc.conta_id
        LEFT JOIN public.lancamentos l ON l.fatura_id = fc.id
        GROUP BY cf.nome, fc.id, fc.mes_referencia, fc.data_vencimento, fc.status
        ORDER BY cf.nome, fc.mes_referencia DESC LIMIT 30;
    `);
    console.log('\n📊 FATURAS NO BANCO:');
    console.table(resultado.rows);

    await db.end();
    console.log('\n🔌 Concluído!');
}

main().catch(err => console.error('❌ FATAL:', err.message));
