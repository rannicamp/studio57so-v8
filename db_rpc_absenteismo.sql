-- db_rpc_absenteismo.sql
-- RPC para calcular o Absenteísmo Mensal (12 meses) de um determinado ano
-- Fórmula: (Faltas reais / Dias úteis exigidos do empregado) * 100

CREATE OR REPLACE FUNCTION get_rh_tendencia_absenteismo(p_ano text, p_organizacao_id integer)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_mes_atual integer;
    v_mes_string text;
    v_inicio_mes date;
    v_fim_mes date;
    v_dias_uteis_exigidos numeric;
    v_total_faltas numeric;
    v_absenteismo numeric;
    v_resultado jsonb := '[]'::jsonb;
    v_timezone text := 'America/Sao_Paulo';
    -- Ajuste para travar contagem no "ontem" caso o mês seja o atual (não podemos cobrar faltas de hoje ou do futuro)
    v_ontem date := (NOW() AT TIME ZONE v_timezone)::date - 1;
BEGIN
    FOR v_mes_atual IN 1..12 LOOP
        v_mes_string := LPAD(v_mes_atual::text, 2, '0');
        v_inicio_mes := (p_ano || '-' || v_mes_string || '-01')::date;
        v_fim_mes := (v_inicio_mes + interval '1 month' - interval '1 day')::date;

        -- Abrevia ano (ex: 2026 vira 26 para caber no label do gráfico)
        v_mes_string := v_mes_string || '/' || SUBSTRING(p_ano, 3, 2);

        -- Se o mês inteiro for no futuro (início_mes > ontem), pula para não sujar o %
        IF v_inicio_mes > v_ontem THEN
            v_resultado := v_resultado || jsonb_build_object(
                'mes', v_mes_string,
                'absenteismo_percentual', 0,
                'total_faltas', 0,
                'dias_exigidos', 0
            );
            CONTINUE;
        END IF;

        -- 1. DIAS ÚTEIS EXIGIDOS NO MÊS
        SELECT COUNT(*)
        INTO v_dias_uteis_exigidos
        FROM generate_series(v_inicio_mes, LEAST(v_fim_mes, v_ontem), '1 day'::interval) AS cm(data_dia)
        CROSS JOIN public.funcionarios f
        INNER JOIN public.jornada_detalhes jd ON f.jornada_id = jd.jornada_id 
             AND jd.dia_semana = EXTRACT(DOW FROM cm.data_dia)::integer
             AND jd.horario_entrada IS NOT NULL
        LEFT JOIN public.feriados fer ON fer.data_feriado = cm.data_dia AND fer.organizacao_id = p_organizacao_id
        WHERE f.organizacao_id = p_organizacao_id
          AND f.status = 'Ativo'
          -- Empregado durante esse dia
          AND (CASE WHEN f.admission_date IS NULL OR TRIM(f.admission_date::text) = '' THEN NULL ELSE f.admission_date::date END) <= cm.data_dia
          AND ((CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) IS NULL 
               OR (CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) >= cm.data_dia)
          -- Sem feriado
          AND fer.id IS NULL;

        -- 2. FALTAS REAIS NAQUELE MÊS
        SELECT COUNT(*)
        INTO v_total_faltas
        FROM generate_series(v_inicio_mes, LEAST(v_fim_mes, v_ontem), '1 day'::interval) AS cm(data_dia)
        CROSS JOIN public.funcionarios f
        INNER JOIN public.jornada_detalhes jd ON f.jornada_id = jd.jornada_id 
             AND jd.dia_semana = EXTRACT(DOW FROM cm.data_dia)::integer
             AND jd.horario_entrada IS NOT NULL
        LEFT JOIN public.feriados fer ON fer.data_feriado = cm.data_dia AND fer.organizacao_id = p_organizacao_id
        LEFT JOIN public.abonos a ON a.funcionario_id = f.id AND a.data_abono = cm.data_dia
        LEFT JOIN public.pontos p ON p.funcionario_id = f.id AND (p.data_hora AT TIME ZONE v_timezone)::date = cm.data_dia
        WHERE f.organizacao_id = p_organizacao_id
          AND f.status = 'Ativo'
          -- Empregado durante esse dia
          AND (CASE WHEN f.admission_date IS NULL OR TRIM(f.admission_date::text) = '' THEN NULL ELSE f.admission_date::date END) <= cm.data_dia
          AND ((CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) IS NULL 
               OR (CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) >= cm.data_dia)
          -- CONDIÇÃO DE FALTA NA VEIA:
          AND fer.id IS NULL 
          AND a.id IS NULL   
          AND p.id IS NULL;

        -- 3. CÁLCULO GERAL DO PERCENTUAL
        IF COALESCE(v_dias_uteis_exigidos, 0) > 0 THEN
            v_absenteismo := ROUND(((v_total_faltas / v_dias_uteis_exigidos) * 100::numeric), 1);
        ELSE
            v_absenteismo := 0;
        END IF;

        v_resultado := v_resultado || jsonb_build_object(
            'mes', v_mes_string,
            'absenteismo_percentual', v_absenteismo,
            'total_faltas', v_total_faltas,
            'dias_exigidos', v_dias_uteis_exigidos
        );
    END LOOP;

    RETURN v_resultado::json;
END;
$$;
