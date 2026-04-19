CREATE OR REPLACE FUNCTION public.get_dre_operacional(
    p_organizacao_id BIGINT,
    p_filtros JSONB
)
RETURNS TABLE (
    categoria_id BIGINT,
    ano_mes TEXT,
    total NUMERIC
) AS $$
DECLARE
    v_where TEXT;
    v_query TEXT;
    v_use_competencia BOOLEAN;
BEGIN
    v_where := financeiro_montar_where(p_organizacao_id, p_filtros);

    v_where := v_where || ' AND l.status IN (''Pago'', ''Conciliado'')';

    v_use_competencia := COALESCE((p_filtros->>'useCompetencia')::boolean, false);

    IF v_use_competencia THEN
        v_query := '
            SELECT 
                l.categoria_id,
                to_char(GREATEST(l.data_transacao, ''2000-01-01''::date), ''YYYY-MM'') AS ano_mes,
                SUM(l.valor) AS total
            FROM public.lancamentos l
            JOIN public.contas_financeiras cb ON l.conta_id = cb.id
            ' || v_where || '
            GROUP BY l.categoria_id, to_char(GREATEST(l.data_transacao, ''2000-01-01''::date), ''YYYY-MM'')
        ';
    ELSE
        -- Usar CAIXA
        v_query := '
            SELECT 
                l.categoria_id,
                to_char(COALESCE(l.data_pagamento, l.data_vencimento, l.data_transacao), ''YYYY-MM'') AS ano_mes,
                SUM(l.valor) AS total
            FROM public.lancamentos l
            JOIN public.contas_financeiras cb ON l.conta_id = cb.id
            ' || v_where || '
            GROUP BY l.categoria_id, to_char(COALESCE(l.data_pagamento, l.data_vencimento, l.data_transacao), ''YYYY-MM'')
        ';
    END IF;

    RETURN QUERY EXECUTE v_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
