const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const dropQuery = `
    DROP FUNCTION IF EXISTS fn_relatorio_comercial(integer, date, date);
  `;

  const query = `
CREATE OR REPLACE FUNCTION fn_relatorio_comercial(p_data_inicio text, p_data_fim text, p_organizacao_id integer)
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

    SELECT MIN(created_at) INTO v_min_date 
    FROM contatos 
    WHERE organizacao_id::integer = p_organizacao_id 
      AND tipo_contato = 'Lead';

    IF v_min_date IS NOT NULL AND v_start_date < v_min_date THEN
        v_start_date := date_trunc('day', v_min_date);
    END IF;

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
    leads_por_hora AS (
        SELECT 
            EXTRACT(DOW FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS dia_semana,
            EXTRACT(HOUR FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS hora,
            COUNT(id) AS qtd
        FROM contatos_periodo
        GROUP BY 
            EXTRACT(DOW FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int,
            EXTRACT(HOUR FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int
        ORDER BY dia_semana, hora
    ),
    conversas_whatsapp AS (
        SELECT 
            c.id AS contato_id,
            c.origem,
            (SELECT corretor_id FROM contatos_no_funil WHERE contato_id::text = c.id::text LIMIT 1) as corretor_id,
            c.created_at AS contato_criado_em,
            (SELECT id FROM whatsapp_conversations wc WHERE wc.contato_id = c.id LIMIT 1) as conversation_record_id
        FROM contatos_periodo c
    ),
    conversas_com_kpis AS (
        SELECT 
            *,
            CASE WHEN conversation_record_id IS NOT NULL 
                 THEN get_conversation_response_kpis(conversation_record_id) 
                 ELSE NULL END as kpis
        FROM conversas_whatsapp
    ),
    metricas_tempo as (
        SELECT 
           COALESCE(AVG((kpis->>'broker_avg_minutes')::numeric) FILTER (WHERE (kpis->>'broker_count')::int > 0), 0) as tempo_nossa_resposta,
           COALESCE(AVG((kpis->>'lead_avg_minutes')::numeric) FILTER (WHERE (kpis->>'lead_count')::int > 0), 0) as tempo_espera_lead,
           COUNT(conversation_record_id) as total_interagidos
        FROM conversas_com_kpis
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
    cards_do_periodo AS (
        SELECT cnf.id as contato_no_funil_id, 
               cnf.coluna_id as coluna_atual_id,
               cnf.contato_id,
               col.funil_id,
               col.nome as coluna_nome,
               cnf.corretor_id
        FROM contatos_no_funil cnf
        INNER JOIN contatos_periodo cp ON cp.id::text = cnf.contato_id::text
        LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
        WHERE cnf.organizacao_id = p_organizacao_id
    ),
    pisadas_brutas AS (
        SELECT h.contato_no_funil_id, h.coluna_nova_id as coluna_id
        FROM historico_movimentacao_funil h
        INNER JOIN cards_do_periodo cp ON cp.contato_no_funil_id = h.contato_no_funil_id
        UNION
        SELECT cp.contato_no_funil_id, cp.coluna_atual_id as coluna_id
        FROM cards_do_periodo cp
        UNION
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
        ORDER BY AVG(cf.ordem) ASC, COUNT(DISTINCT pb.contato_no_funil_id) DESC
    ),
    metricas_corretores AS (
        SELECT 
            COALESCE(u.nome, u.razao_social, 'Sem Corretor / Robô') as corretor_nome,
            COUNT(DISTINCT cw.contato_id) as total_atendimentos,
            COALESCE(AVG((cw.kpis->>'broker_avg_minutes')::numeric) FILTER (WHERE (cw.kpis->>'broker_count')::int > 0), 0) as tempo_medio_resposta_minutos,
            COALESCE(AVG((cw.kpis->>'lead_avg_minutes')::numeric) FILTER (WHERE (cw.kpis->>'lead_count')::int > 0), 0) as tempo_medio_resposta_lead_minutos,
            COALESCE(jsonb_object_agg(
               COALESCE(INITCAP(LOWER(TRIM(dist.coluna_nome))), 'Desconhecido'),
               dist.qtd
            ) FILTER (WHERE dist.coluna_nome IS NOT NULL), '{}'::jsonb) as funil_distribuicao
        FROM conversas_com_kpis cw
        LEFT JOIN (
            SELECT corretor_id, coluna_nome, COUNT(*) as qtd
            FROM cards_do_periodo
            GROUP BY corretor_id, coluna_nome
        ) dist ON dist.corretor_id::text = cw.corretor_id::text
        LEFT JOIN contatos u ON u.id::text = cw.corretor_id::text
        GROUP BY COALESCE(u.nome, u.razao_social, 'Sem Corretor / Robô')
        ORDER BY total_atendimentos DESC
    )
    SELECT jsonb_build_object(
        'total_leads', COALESCE((SELECT total_leads FROM totais_leads_origem), 0),
        'leads_por_origem', COALESCE((SELECT leads_por_origem FROM totais_leads_origem), '{}'::jsonb),
        'total_conversas_ativas', COALESCE((SELECT total_interagidos FROM metricas_tempo), 0),
        'nosso_tempo_medio_resposta_minutos', COALESCE((SELECT tempo_nossa_resposta FROM metricas_tempo), 0),
        'tempo_medio_resposta_lead_minutos', COALESCE((SELECT tempo_espera_lead FROM metricas_tempo), 0),
        'leads_por_dia', COALESCE((SELECT jsonb_agg(jsonb_build_object('data', "data", 'qtd', qtd)) FROM leads_agrupados), '[]'::jsonb),
        'leads_por_hora', COALESCE((SELECT jsonb_agg(jsonb_build_object('dia_semana', dia_semana, 'hora', hora, 'qtd', qtd)) FROM leads_por_hora), '[]'::jsonb),
        'conversao_funil', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value, 'ordem', ordem_base)) FROM conversao_funil), '[]'::jsonb),
        'desempenho_corretores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'corretor_nome', corretor_nome,
            'total_atendimentos', total_atendimentos,
            'tempo_medio_resposta_minutos', tempo_medio_resposta_minutos,
            'tempo_medio_resposta_lead_minutos', tempo_medio_resposta_lead_minutos,
            'funil_distribuicao', funil_distribuicao
        )) FROM metricas_corretores), '[]'::jsonb)
    ) INTO v_retorno;

    RETURN v_retorno;
END;
$$;
  `;

  const reloadQuery = `NOTIFY pgrst, 'reload schema';`;

  try {
      await client.query(dropQuery);
      console.log('Dropou funcao incorreta');
      await client.query(query);
      console.log('Criou funcao correta');
      await client.query(reloadQuery);
      console.log('Schema cache reloaded!');
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();
