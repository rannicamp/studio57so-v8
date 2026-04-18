const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createRPC() {
    const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@';
    const encodedPassword = encodeURIComponent(password);

    // Conectando no banco via porta 5432 ou 6543
    const DEV_URL_DIRECT = `postgresql://postgres:${encodedPassword}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;

    console.log("Conectando ao banco de dados porta 6543...");

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
    v_query text;
BEGIN
    v_query := '
        SELECT 
            l.categoria_id,
            to_char(COALESCE(l.data_pagamento, l.data_vencimento), ''YYYY-MM'') as ano_mes,
            SUM(l.valor) as total
        FROM lancamentos l
        LEFT JOIN categorias_financeiras c ON l.categoria_id = c.id
        WHERE l.organizacao_id = ' || p_organizacao_id || '
        AND (l.status IN (''Pago'', ''Conciliado'') OR l.conciliado = true)
        AND l.categoria_id IS NOT NULL 
    ';

    -- Datas
    IF p_filtros->>'startDate' IS NOT NULL AND p_filtros->>'startDate' <> '' THEN
        v_query := v_query || ' AND COALESCE(l.data_pagamento, l.data_vencimento) >= ''' || (p_filtros->>'startDate') || '''';
    END IF;
    IF p_filtros->>'endDate' IS NOT NULL AND p_filtros->>'endDate' <> '' THEN
        v_query := v_query || ' AND COALESCE(l.data_pagamento, l.data_vencimento) <= ''' || (p_filtros->>'endDate') || '''';
    END IF;

    -- Empreendimentos
    IF (p_filtros->'empreendimentoIds') IS NOT NULL AND jsonb_array_length(p_filtros->'empreendimentoIds') > 0 THEN
        v_query := v_query || ' AND l.empreendimento_id IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'empreendimentoIds') || ''')::bigint)';
    ELSE
        -- DRE de Obra exige que ao menos pertença a alguma obra quando vista no contexto global
        v_query := v_query || ' AND l.empreendimento_id IS NOT NULL';
    END IF;

    -- Ignorar Transferências internas (mas não Estornos vinculados à obra)
    v_query := v_query || ' AND (c.nome IS NULL OR NOT (
        UNACCENT(c.nome) ILIKE UNACCENT(''Transferência%'')
    ))';

    -- Agrupamento
    v_query := v_query || ' GROUP BY l.categoria_id, to_char(COALESCE(l.data_pagamento, l.data_vencimento), ''YYYY-MM'')';

    RETURN QUERY EXECUTE v_query;
END;
$$;
        `;

        console.log("Executando CREATE OR REPLACE FUNCTION dre_matriz_agrupada_obras...");
        await client.query(rpcQuery);
        console.log("✅ Função RPC criada com sucesso!");

    } catch (e) {
        console.error("Erro ao alterar o banco:", e);
    } finally {
        await client.end();
    }
}

createRPC();
