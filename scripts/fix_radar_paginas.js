require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fix() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const client = new Client({ connectionString: `postgres://postgres:${password}@db.${projectId}.supabase.co:6543/postgres` });
  await client.connect();
  console.log('Conectado!');

  // Corrige radar_paginas com 2 CTEs separadas (sem window function + GROUP BY juntos)
  await client.query(`
    CREATE OR REPLACE FUNCTION public.radar_paginas(dias_atras integer, marketing boolean) RETURNS json AS $$
    DECLARE
      data_corte TIMESTAMP := NOW() - (dias_atras || ' days')::INTERVAL;
      resultado json;
    BEGIN
      WITH SessoesMkt AS (
        SELECT 
          session_id, 
          MAX(CASE WHEN origem ILIKE '%Anúncio%' OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL THEN 1 ELSE 0 END) AS has_mkt
        FROM public.monitor_visitas 
        WHERE data_acesso >= data_corte 
        GROUP BY session_id
      ),
      HitPaginas AS (
        SELECT 
          m.pagina, 
          m.session_id, 
          SUM(COALESCE(m.tempo_permanencia_segundos, 0)) as tempo_na_pagina
        FROM public.monitor_visitas m
        WHERE m.data_acesso >= data_corte 
          AND m.pagina IS NOT NULL 
          AND m.pagina NOT IN ('/', '/favicon.ico')
        GROUP BY m.pagina, m.session_id
      )
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO resultado
      FROM (
        SELECT 
          hp.pagina AS nome, 
          COUNT(DISTINCT hp.session_id) as qtd, 
          COALESCE(AVG(hp.tempo_na_pagina), 0) as retencao_media_sec
        FROM HitPaginas hp
        JOIN SessoesMkt sm ON sm.session_id = hp.session_id
        WHERE (marketing = false OR sm.has_mkt = 1)
        GROUP BY hp.pagina 
        ORDER BY qtd DESC 
        LIMIT 5
      ) t;
      RETURN resultado;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER
  `);
  console.log('radar_paginas corrigida!');

  // Testa RPC final
  const res = await client.query('SELECT public.get_radar_stats(30, false) as r');
  const d = res.rows[0].r;
  console.log('\n=== RESULTADO FINAL ===');
  console.log('Total Sessoes:', d?.totalVisitas);
  console.log('Mobile:', d?.porDispositivo?.mobile, '| Desktop:', d?.porDispositivo?.desktop);
  console.log('Top Origens:', JSON.stringify(d?.topOrigens?.slice(0,3)));
  console.log('Ecossistemas:', JSON.stringify(d?.ecossistemas));
  console.log('Funil:', JSON.stringify(d?.funil));
  console.log('Top Paginas:', JSON.stringify(d?.topPaginas?.slice(0,2)));

  await client.end();
  console.log('\nConexao encerrada.');
}

fix().catch(e => console.error('ERRO:', e.message, e.detail || ''));
