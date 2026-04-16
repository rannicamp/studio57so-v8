-- db_rpc_abonos.sql
-- RPC para calcular o Volume de Abonos Mensais (12 meses) de um determinado ano
-- Agrupando por Tipo de Abono

CREATE OR REPLACE FUNCTION get_rh_tendencia_abonos(p_ano text, p_organizacao_id integer)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_mes_atual integer;
    v_mes_string text;
    v_inicio_mes date;
    v_fim_mes date;
    v_resultado jsonb := '[]'::jsonb;
    v_detalhes jsonb;
    v_total integer;
BEGIN
    FOR v_mes_atual IN 1..12 LOOP
        v_mes_string := LPAD(v_mes_atual::text, 2, '0');
        v_inicio_mes := (p_ano || '-' || v_mes_string || '-01')::date;
        v_fim_mes := (v_inicio_mes + interval '1 month' - interval '1 day')::date;

        -- Abrevia ano (ex: 2026 vira 26 para caber no label)
        v_mes_string := v_mes_string || '/' || SUBSTRING(p_ano, 3, 2);

        -- Faz o agrupamento dos abonos daquele mês
        SELECT 
            COALESCE(jsonb_agg(
                jsonb_build_object(
                    'tipo', COALESCE(t.descricao, 'Outros'),
                    'qtd', ag.qtd
                )
            ), '[]'::jsonb),
            COALESCE(SUM(ag.qtd), 0)
        INTO v_detalhes, v_total
        FROM (
            SELECT a.tipo_abono_id, COUNT(*) as qtd
            FROM public.abonos a
            INNER JOIN public.funcionarios f ON f.id = a.funcionario_id
            WHERE f.organizacao_id = p_organizacao_id
              AND f.status = 'Ativo'
              AND a.data_abono >= v_inicio_mes
              AND a.data_abono <= v_fim_mes
            GROUP BY a.tipo_abono_id
        ) ag
        LEFT JOIN public.abono_tipos t ON t.id = ag.tipo_abono_id;

        -- Mescla no resultado
        v_resultado := v_resultado || jsonb_build_object(
            'mes', v_mes_string,
            'total_abonos', v_total,
            'detalhes', v_detalhes
        );
    END LOOP;

    RETURN v_resultado::json;
END;
$$;
