const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function replaceDREWithCentralBrain() {
    const DEV_URL_DIRECT = `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@')}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
    const client = new Client({
        connectionString: DEV_URL_DIRECT,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const rpcQuery = `
CREATE OR REPLACE FUNCTION public.dre_matriz_agrupada_obras(
    p_organizacao_id bigint,
    p_filtros jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(categoria_id bigint, ano_mes text, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_where text;
    v_query text;
    v_use_comp boolean;
BEGIN
    v_use_comp := coalesce((p_filtros->>'useCompetencia')::boolean, false);

    -- 1. Obter a Cláusula WHERE Blindada do Cérebro Central
    v_where := financeiro_montar_where(p_organizacao_id, p_filtros);

    -- 2. Garantir as exclusões necessárias do DRE (ignorar transferências e IS NOT NULL da categoria)
    v_where := v_where || ' AND l.categoria_id IS NOT NULL';
    
    v_query := '
        WITH BaseData AS (
            SELECT 
                l.categoria_id,
                CASE 
                    WHEN ' || (CASE WHEN v_use_comp THEN 'true' ELSE 'false' END) || ' = true THEN 
                        to_char(l.data_transacao, ''YYYY-MM'')
                    ELSE 
                        to_char(COALESCE(l.data_pagamento, l.data_vencimento, l.data_transacao), ''YYYY-MM'')
                END as ano_mes,
                SUM(CASE WHEN l.tipo = ''Despesa'' THEN ABS(l.valor) WHEN l.tipo = ''Receita'' THEN ABS(l.valor) * -1 ELSE 0 END) as total
            FROM lancamentos l
            ' || v_where || '
            GROUP BY 1, 2
        )
        SELECT categoria_id, ano_mes, total FROM BaseData;
    ';

    RETURN QUERY EXECUTE v_query;
END;
$$;
        `;

        console.log("Substituindo a RPC do DRE Obras pela lógica unificada do motor financeiro...");
        await client.query(rpcQuery);
        console.log("✅ Nova versão do dre_matriz_agrupada_obras ativada no banco!");

        // Teste Rápido
        const t = await client.query(`SELECT * FROM dre_matriz_agrupada_obras(2, '{"startDate": "2025-09-01", "endDate": "2026-04-30"}'::jsonb) WHERE categoria_id = 194;`);
        console.log("TESTE RÁPIDO DRE 194:", t.rows);

    } catch (e) {
        console.error("Erro Fatal:", e);
    } finally {
        await client.end();
    }
}

replaceDREWithCentralBrain();
