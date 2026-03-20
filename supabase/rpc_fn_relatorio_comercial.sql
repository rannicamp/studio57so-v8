-- Script de Função Comercial com Imputação da Origem Zerada e Rank Cronológico
CREATE OR REPLACE FUNCTION public.fn_relatorio_comercial(
    p_data_inicio text,
    p_data_fim text,
    p_organizacao_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_retorno jsonb;
    v_start_date timestamptz;
    v_end_date timestamptz;
    v_diff_days integer;
    v_min_date timestamptz;
BEGIN
    v_start_date := p_data_inicio::timestamptz;
    v_end_date   := (p_data_fim || ' 23:59:59')::timestamptz;

    -- Descobre a nascente da Organização na Tabela 
    SELECT MIN(created_at) INTO v_min_date 
    FROM contatos 
    WHERE organizacao_id::integer = p_organizacao_id 
      AND tipo_contato = 'Lead';

    -- Trimming de Cauda! 
    IF v_min_date IS NOT NULL AND v_start_date < v_min_date THEN
        v_start_date := date_trunc('day', v_min_date);
    END IF;

    -- Trava Final Reversa  
    IF v_end_date < v_start_date THEN
        v_end_date := v_start_date;
    END IF;

    v_diff_days := (v_end_date::date - v_start_date::date);

    WITH contatos_periodo AS (
        SELECT id, origem, created_at
        FROM contatos
        WHERE organizacao_id::integer = p_organizacao_id
          AND tipo_contato = 'Lead'
          AND created_at >= v_start_date
          AND created_at <= v_end_date
    ),
    serie_tempo AS (
        SELECT generate_series(
            CASE WHEN v_diff_days > 35 THEN date_trunc('month', v_start_date::date) ELSE v_start_date::date END,
            CASE WHEN v_diff_days > 35 THEN date_trunc('month', v_end_date::date) ELSE v_end_date::date END,
            CASE WHEN v_diff_days > 35 THEN '1 month'::interval ELSE '1 day'::interval END
        )::date as data_ref
    ),
    leads_agrupados AS (
        SELECT 
            TO_CHAR(s.data_ref, 'YYYY-MM-DD') AS "data",
            COUNT(c.id) AS qtd
        FROM serie_tempo s
        LEFT JOIN contatos_periodo c ON 
            (CASE WHEN v_diff_days > 35 THEN date_trunc('month', c.created_at::date)::date ELSE c.created_at::date END) = s.data_ref
        GROUP BY s.data_ref
        ORDER BY s.data_ref
    ),
    conversas_whatsapp AS (
        SELECT 
            c.id AS contato_id,
            c.origem,
            c.created_at AS contato_criado_em,
            MIN(m.sent_at) FILTER (WHERE m.direction = 'outbound') as msg_primeiro_outbound,
            MIN(m.sent_at) FILTER (WHERE m.direction = 'inbound') as msg_primeiro_inbound
        FROM contatos_periodo c
        LEFT JOIN whatsapp_messages m ON m.contato_id::text = c.id::text
        GROUP BY c.id, c.origem, c.created_at
    ),
    metricas_tempo as (
        SELECT 
           AVG(EXTRACT(EPOCH FROM (msg_primeiro_outbound - contato_criado_em))/60) FILTER (WHERE msg_primeiro_outbound > contato_criado_em) as tempo_nossa_resposta,
           AVG(EXTRACT(EPOCH FROM (msg_primeiro_inbound - msg_primeiro_outbound))/60) FILTER (WHERE msg_primeiro_inbound > msg_primeiro_outbound) as tempo_espera_lead,
           COUNT(msg_primeiro_outbound) as total_interagidos
        FROM conversas_whatsapp
    ),
    totais_leads_origem AS (
        SELECT 
            SUM(qtd) as total_leads,
            COALESCE(
                jsonb_object_agg(origem_ajustada, qtd), 
                '{}'::jsonb
            ) as leads_por_origem
        FROM (
            SELECT 
                COALESCE(NULLIF(TRIM(origem), ''), 'Orgânico/Direto') as origem_ajustada, 
                COUNT(*) as qtd
            FROM contatos_periodo
            GROUP BY 1
        ) sub
    ),
    -- Lógica Exata Aprovada Ranniere: Snapshot Literal Ordenado Cronologicamente e Forçando Início
    cards_do_periodo AS (
        SELECT cnf.id as contato_no_funil_id, 
               cnf.coluna_id as coluna_atual_id,
               col.funil_id
        FROM contatos_no_funil cnf
        INNER JOIN contatos_periodo cp ON cp.id::text = cnf.contato_id::text
        LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
        WHERE cnf.organizacao_id = p_organizacao_id
    ),
    pisadas_brutas AS (
        -- Movimentos registrados
        SELECT h.contato_no_funil_id, h.coluna_nova_id as coluna_id
        FROM historico_movimentacao_funil h
        INNER JOIN cards_do_periodo cp ON cp.contato_no_funil_id = h.contato_no_funil_id
        UNION
        -- Estado Atual (Cobre quem nunca se moveu)
        SELECT cp.contato_no_funil_id, cp.coluna_atual_id as coluna_id
        FROM cards_do_periodo cp
        UNION
        -- Auto-Inserção da Etapa 0 (Entrada). Todo lead preenche necessariamente o topo da funilização.
        SELECT cp.contato_no_funil_id, cf_base.id as coluna_id
        FROM cards_do_periodo cp
        INNER JOIN colunas_funil cf_base ON cf_base.funil_id = cp.funil_id
        WHERE cf_base.ordem = 0 OR UPPER(TRIM(cf_base.nome)) = 'ENTRADA'
    ),
    conversao_funil AS (
        SELECT 
            INITCAP(LOWER(TRIM(cf.nome))) as name,
            COUNT(DISTINCT pb.contato_no_funil_id) as value,
            AVG(cf.ordem) as ordem_base
        FROM pisadas_brutas pb
        INNER JOIN colunas_funil cf ON cf.id = pb.coluna_id
        GROUP BY INITCAP(LOWER(TRIM(cf.nome)))
        -- Ordenação Obrigatória pela Posição Numérica NATIVA da Coluna no CRM!!
        ORDER BY AVG(cf.ordem) ASC, COUNT(DISTINCT pb.contato_no_funil_id) DESC
    )
    SELECT jsonb_build_object(
        'total_leads', COALESCE((SELECT total_leads FROM totais_leads_origem), 0),
        'leads_por_origem', COALESCE((SELECT leads_por_origem FROM totais_leads_origem), '{}'::jsonb),
        'total_conversas_ativas', COALESCE((SELECT total_interagidos FROM metricas_tempo), 0),
        'nosso_tempo_medio_resposta_minutos', COALESCE((SELECT tempo_nossa_resposta FROM metricas_tempo), 0),
        'tempo_medio_resposta_lead_minutos', COALESCE((SELECT tempo_espera_lead FROM metricas_tempo), 0),
        'leads_por_dia', COALESCE((SELECT jsonb_agg(jsonb_build_object('data', "data", 'qtd', qtd)) FROM leads_agrupados), '[]'::jsonb),
        'conversao_funil', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value, 'ordem', ordem_base)) FROM conversao_funil), '[]'::jsonb)
    ) INTO v_retorno;

    RETURN v_retorno;
END;
$$;
