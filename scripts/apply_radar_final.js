require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  if (!password) { 
    console.error('ERRO FATAL: Senha não encontrada na .env.local (SUPABASE_DB_PASSWORD ou DB_PASSWORD).'); 
    return; 
  }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
    console.log('🔌 Conectando ao Supabase via porta 6543...');
    await client.connect();
    console.log('✅ Conectado!\n');

    // PASSO 0: Garante a coluna
    await client.query(`ALTER TABLE public.monitor_visitas ADD COLUMN IF NOT EXISTS tempo_permanencia_segundos integer DEFAULT 0`);
    console.log('✅ Coluna tempo_permanencia_segundos garantida');

    // PASSO 1: radar_kpis
    await client.query(`
      CREATE OR REPLACE FUNCTION public.radar_kpis(dias_atras integer, marketing boolean) RETURNS json AS $$
      DECLARE
        data_corte TIMESTAMP := NOW() - (dias_atras || ' days')::INTERVAL;
        resultado json;
      BEGIN
        WITH Sessoes AS (
          SELECT 
            m.session_id,
            (array_agg(m.dispositivo ORDER BY m.data_acesso ASC) FILTER (WHERE m.dispositivo IS NOT NULL))[1] AS disp,
            SUM(COALESCE(m.tempo_permanencia_segundos, 0)) AS tempo_sessao,
            MAX(CASE WHEN m.origem ILIKE '%Anúncio%' OR m.utm_medium IS NOT NULL OR m.utm_campaign IS NOT NULL THEN 1 ELSE 0 END) AS has_mkt
          FROM public.monitor_visitas m
          WHERE m.data_acesso >= data_corte
          GROUP BY m.session_id
        )
        SELECT json_build_object(
          'totalVisitas', count(*),
          'porDispositivo', json_build_object(
             'mobile', count(CASE WHEN LOWER(disp) LIKE '%celular%' THEN 1 END),
             'desktop', count(CASE WHEN LOWER(disp) NOT LIKE '%celular%' THEN 1 END),
             'media_retencao_segundos', COALESCE(AVG(tempo_sessao), 0)
          )
        ) INTO resultado
        FROM Sessoes
        WHERE (marketing = false OR has_mkt = 1);
        RETURN resultado;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER
    `);
    console.log('✅ radar_kpis criada');

    // PASSO 2: radar_origens
    await client.query(`
      CREATE OR REPLACE FUNCTION public.radar_origens(dias_atras integer, marketing boolean) RETURNS json AS $$
      DECLARE
        data_corte TIMESTAMP := NOW() - (dias_atras || ' days')::INTERVAL;
        resultado json;
      BEGIN
        WITH Sessoes AS (
          SELECT 
            m.session_id,
            (array_agg(m.origem ORDER BY m.data_acesso ASC) FILTER (WHERE m.origem IS NOT NULL AND m.origem != ''))[1] AS origem_principal,
            MAX(CASE WHEN m.origem ILIKE '%Anúncio%' OR m.utm_medium IS NOT NULL OR m.utm_campaign IS NOT NULL THEN 1 ELSE 0 END) AS has_mkt
          FROM public.monitor_visitas m
          WHERE m.data_acesso >= data_corte
          GROUP BY m.session_id
        )
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO resultado
        FROM (
          SELECT origem_principal AS nome, COUNT(*) as qtd
          FROM Sessoes
          WHERE origem_principal IS NOT NULL
            AND (marketing = false OR has_mkt = 1)
          GROUP BY origem_principal
          ORDER BY qtd DESC
          LIMIT 10
        ) t;
        RETURN resultado;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER
    `);
    console.log('✅ radar_origens criada');

    // PASSO 3: radar_paginas
    await client.query(`
      CREATE OR REPLACE FUNCTION public.radar_paginas(dias_atras integer, marketing boolean) RETURNS json AS $$
      DECLARE
        data_corte TIMESTAMP := NOW() - (dias_atras || ' days')::INTERVAL;
        resultado json;
      BEGIN
        WITH HitPaginas AS (
          SELECT 
            m.pagina,
            m.session_id,
            SUM(COALESCE(m.tempo_permanencia_segundos, 0)) as tempo_na_pagina,
            MAX(CASE WHEN m.origem ILIKE '%Anúncio%' OR m.utm_medium IS NOT NULL OR m.utm_campaign IS NOT NULL THEN 1 ELSE 0 END) OVER (PARTITION BY m.session_id) AS has_mkt
          FROM public.monitor_visitas m
          WHERE m.data_acesso >= data_corte
            AND m.pagina IS NOT NULL AND m.pagina NOT IN ('/', '/favicon.ico')
          GROUP BY m.pagina, m.session_id
        )
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO resultado
        FROM (
          SELECT 
            pagina AS nome,
            COUNT(DISTINCT session_id) as qtd,
            COALESCE(AVG(tempo_na_pagina), 0) as retencao_media_sec
          FROM HitPaginas
          WHERE (marketing = false OR has_mkt = 1)
          GROUP BY pagina
          ORDER BY qtd DESC
          LIMIT 5
        ) t;
        RETURN resultado;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER
    `);
    console.log('✅ radar_paginas criada');

    // PASSO 4: radar_ecossistemas
    await client.query(`
      CREATE OR REPLACE FUNCTION public.radar_ecossistemas(dias_atras integer, marketing boolean) RETURNS json AS $$
      DECLARE
        data_corte TIMESTAMP := NOW() - (dias_atras || ' days')::INTERVAL;
        resultado json;
      BEGIN
        WITH Sessoes AS (
          SELECT 
            m.session_id,
            (array_agg(m.origem ORDER BY m.data_acesso ASC) FILTER (WHERE m.origem IS NOT NULL AND m.origem != ''))[1] AS origem_principal,
            MAX(CASE WHEN m.origem ILIKE '%Anúncio%' OR m.utm_medium IS NOT NULL OR m.utm_campaign IS NOT NULL THEN 1 ELSE 0 END) AS has_mkt
          FROM public.monitor_visitas m
          WHERE m.data_acesso >= data_corte
          GROUP BY m.session_id
        )
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO resultado
        FROM (
          SELECT 
            CASE
              WHEN origem_principal ILIKE '%instagram%' OR origem_principal ILIKE '%(ig)%' THEN 'Instagram'
              WHEN origem_principal ILIKE '%facebook%' OR origem_principal ILIKE '%(fb)%' THEN 'Facebook'
              WHEN origem_principal ILIKE '%google%' THEN 'Google'
              WHEN origem_principal ILIKE '%anuncio%' THEN 'Outros Anúncios'
              ELSE 'Direto / Outros'
            END as ecossistema,
            COUNT(*) as qtd
          FROM Sessoes
          WHERE origem_principal IS NOT NULL 
            AND (marketing = false OR has_mkt = 1)
          GROUP BY ecossistema
          ORDER BY qtd DESC
        ) t;
        RETURN resultado;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER
    `);
    console.log('✅ radar_ecossistemas criada');

    // PASSO 5: radar_campanhas
    await client.query(`
      CREATE OR REPLACE FUNCTION public.radar_campanhas(dias_atras integer, marketing boolean) RETURNS json AS $$
      DECLARE
        data_corte TIMESTAMP := NOW() - (dias_atras || ' days')::INTERVAL;
        resultado json;
      BEGIN
        WITH Sessoes AS (
          SELECT 
            m.session_id,
            (array_agg(m.utm_campaign ORDER BY m.data_acesso ASC) FILTER (WHERE m.utm_campaign IS NOT NULL))[1] AS campanha_principal,
            (array_agg(m.utm_content ORDER BY m.data_acesso ASC) FILTER (WHERE m.utm_content IS NOT NULL))[1] AS anuncio_principal,
            MAX(CASE WHEN m.origem ILIKE '%Anúncio%' OR m.utm_medium IS NOT NULL OR m.utm_campaign IS NOT NULL THEN 1 ELSE 0 END) AS has_mkt
          FROM public.monitor_visitas m
          WHERE m.data_acesso >= data_corte
          GROUP BY m.session_id
        )
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO resultado
        FROM (
          SELECT 
            campanha_principal as nome_campanha,
            anuncio_principal as anuncio_id,
            COUNT(*) as qtd
          FROM Sessoes
          WHERE campanha_principal IS NOT NULL AND anuncio_principal IS NOT NULL
            AND (marketing = false OR has_mkt = 1)
          GROUP BY campanha_principal, anuncio_principal
          ORDER BY qtd DESC
          LIMIT 15
        ) t;
        RETURN resultado;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER
    `);
    console.log('✅ radar_campanhas criada');

    // PASSO 6: radar_funil
    await client.query(`
      CREATE OR REPLACE FUNCTION public.radar_funil(dias_atras integer, marketing boolean) RETURNS json AS $$
      DECLARE
        data_corte TIMESTAMP := NOW() - (dias_atras || ' days')::INTERVAL;
        resultado json;
      BEGIN
        WITH Sessoes AS (
          SELECT 
            m.session_id,
            SPLIT_PART(m.pagina, '/obrigado', 1) AS produto,
            MAX(CASE WHEN m.pagina NOT ILIKE '%obrigado%' THEN 1 ELSE 0 END) AS hit_landing,
            MAX(CASE WHEN m.pagina ILIKE '%obrigado%' THEN 1 ELSE 0 END) AS hit_obrigado,
            MAX(CASE WHEN m.origem ILIKE '%Anúncio%' OR m.utm_medium IS NOT NULL OR m.utm_campaign IS NOT NULL THEN 1 ELSE 0 END) AS is_marketing
          FROM public.monitor_visitas m
          WHERE m.data_acesso >= data_corte
            AND m.pagina IS NOT NULL AND m.pagina != '/'
          GROUP BY m.session_id, SPLIT_PART(m.pagina, '/obrigado', 1)
        )
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO resultado
        FROM (
          SELECT 
            produto,
            SUM(hit_landing) AS visitas_landing,
            SUM(hit_obrigado) AS visitas_obrigado,
            ROUND(
              COALESCE(
                (SUM(hit_obrigado)::numeric / NULLIF(SUM(hit_landing), 0)) * 100
              , 0), 1
            ) AS taxa_conversao
          FROM Sessoes
          WHERE produto IS NOT NULL
            AND (marketing = false OR is_marketing = 1)
          GROUP BY produto
          HAVING SUM(hit_landing) > 0
          ORDER BY visitas_landing DESC
        ) t;
        RETURN resultado;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER
    `);
    console.log('✅ radar_funil criada');

    // PASSO 7: get_radar_stats (orquestrador)
    await client.query(`
      CREATE OR REPLACE FUNCTION public.get_radar_stats(dias_atras integer DEFAULT 30, somente_marketing boolean DEFAULT true)
       RETURNS json
       LANGUAGE plpgsql
       SECURITY DEFINER
      AS $function$
      DECLARE
        kpis json;
      BEGIN
        kpis := public.radar_kpis(dias_atras, somente_marketing);
        RETURN json_build_object(
          'totalVisitas', (kpis->>'totalVisitas')::int,
          'porDispositivo', kpis->'porDispositivo',
          'topOrigens', public.radar_origens(dias_atras, somente_marketing),
          'topPaginas', public.radar_paginas(dias_atras, somente_marketing),
          'ecossistemas', public.radar_ecossistemas(dias_atras, somente_marketing),
          'topCampanhas', public.radar_campanhas(dias_atras, somente_marketing),
          'funil', public.radar_funil(dias_atras, somente_marketing)
        );
      END;
      $function$
    `);
    console.log('✅ get_radar_stats (orquestrador) criada\n');

    // TESTE FINAL
    console.log('🧪 Testando RPC get_radar_stats (marketing=false, 30 dias)...');
    const res = await client.query(`SELECT public.get_radar_stats(30, false) as resultado`);
    const data = res.rows[0].resultado;
    console.log('✅ SUCESSO! Dados retornados:');
    console.log('   📊 Total Visitas (sessões):', data?.totalVisitas);
    console.log('   📱 Mobile:', data?.porDispositivo?.mobile);
    console.log('   🖥️  Desktop:', data?.porDispositivo?.desktop);
    console.log('   🌐 Top Origens:', data?.topOrigens?.length, 'entradas');
    console.log('   🎯 Funil:', data?.funil?.length, 'produtos');
    console.log('   🍕 Ecossistemas:', data?.ecossistemas?.map(e => `${e.ecossistema}:${e.qtd}`).join(', '));

  } catch(e) {
    console.error('\n❌ FALHA NA INJEÇÃO SQL:', e.message);
    console.error('Detalhe:', e.detail || '');
  } finally {
    await client.end();
    console.log('\n🔌 Conexão encerrada.');
  }
}

runSQL();
