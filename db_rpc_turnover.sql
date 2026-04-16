-- Rode este script diretamente no SQL Editor do seu Supabase Dashboard.
-- E em seguida rode 'node scripts/exportar-db.cjs' no terminal para atualizar o functions.json local!

CREATE OR REPLACE FUNCTION get_rh_tendencia_turnover(p_ano text, p_organizacao_id integer)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_resultado json;
BEGIN
    WITH meses AS (
        SELECT generate_series(
            (p_ano || '-01-01')::date, 
            (p_ano || '-12-01')::date, 
            '1 month'::interval
        )::date as primeiro_dia
    ),
    dados_mensais AS (
        SELECT 
            to_char(m.primeiro_dia, 'MM/YYYY') as mes_label,
            to_char(m.primeiro_dia, 'YYYY-MM') as mes_iso,
            -- Efetivo Ativo Mensal (ignora sócios: jornada_id IS NOT NULL)
            (SELECT COUNT(id) FROM funcionarios f 
             WHERE f.organizacao_id = p_organizacao_id 
             AND f.jornada_id IS NOT NULL
             AND (CASE WHEN f.admission_date IS NULL OR TRIM(f.admission_date::text) = '' THEN NULL ELSE f.admission_date::date END) <= (m.primeiro_dia + interval '1 month - 1 day')::date
             AND (CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END >= m.primeiro_dia OR f.demission_date IS NULL OR TRIM(f.demission_date::text) = '')
            ) as efetivo_total,
            -- Admissões
            (SELECT COUNT(id) FROM funcionarios f 
             WHERE f.organizacao_id = p_organizacao_id 
             AND f.jornada_id IS NOT NULL
             AND (CASE WHEN f.admission_date IS NULL OR TRIM(f.admission_date::text) = '' THEN NULL ELSE f.admission_date::date END) >= m.primeiro_dia 
             AND (CASE WHEN f.admission_date IS NULL OR TRIM(f.admission_date::text) = '' THEN NULL ELSE f.admission_date::date END) <= (m.primeiro_dia + interval '1 month - 1 day')::date
            ) as admissoes,
            -- Demissões
            (SELECT COUNT(id) FROM funcionarios f 
             WHERE f.organizacao_id = p_organizacao_id 
             AND f.jornada_id IS NOT NULL
             AND (CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) >= m.primeiro_dia 
             AND (CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) <= (m.primeiro_dia + interval '1 month - 1 day')::date
            ) as demissoes
        FROM meses m
    )
    SELECT json_agg(
        json_build_object(
            'mes', 
            CASE SUBSTRING(d.mes_iso FROM 6 FOR 2)
               WHEN '01' THEN 'Jan' WHEN '02' THEN 'Fev' WHEN '03' THEN 'Mar'
               WHEN '04' THEN 'Abr' WHEN '05' THEN 'Mai' WHEN '06' THEN 'Jun'
               WHEN '07' THEN 'Jul' WHEN '08' THEN 'Ago' WHEN '09' THEN 'Set'
               WHEN '10' THEN 'Out' WHEN '11' THEN 'Nov' WHEN '12' THEN 'Dez'
            END,
            'mes_iso', d.mes_iso,
            'efetivo', d.efetivo_total,
            'admissoes', d.admissoes,
            'demissoes', d.demissoes,
            'turnover_percentual', 
                CASE 
                    WHEN d.efetivo_total > 0 THEN 
                        ROUND( (((d.admissoes + d.demissoes) / 2.0) / d.efetivo_total * 100.0)::numeric, 2)
                    ELSE 0.0 
                END
        )
        ORDER BY d.mes_iso
    ) INTO v_resultado
    FROM dados_mensais d;

    RETURN COALESCE(v_resultado, '[]'::json);
END;
$$;
