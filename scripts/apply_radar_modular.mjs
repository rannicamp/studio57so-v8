import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SQL = `
ALTER TABLE public.monitor_visitas 
ADD COLUMN IF NOT EXISTS tempo_permanencia_segundos integer DEFAULT 0;
`;

// Aplicar via RPC exec ou REST API direta
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const functions = [
`CREATE OR REPLACE FUNCTION public.radar_kpis(dias_atras integer, marketing boolean) RETURNS json AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER`,

`CREATE OR REPLACE FUNCTION public.radar_origens(dias_atras integer, marketing boolean) RETURNS json AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER`,

`CREATE OR REPLACE FUNCTION public.radar_paginas(dias_atras integer, marketing boolean) RETURNS json AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER`,

`CREATE OR REPLACE FUNCTION public.radar_ecossistemas(dias_atras integer, marketing boolean) RETURNS json AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER`,

`CREATE OR REPLACE FUNCTION public.radar_campanhas(dias_atras integer, marketing boolean) RETURNS json AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER`,

`CREATE OR REPLACE FUNCTION public.radar_funil(dias_atras integer, marketing boolean) RETURNS json AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER`,

`CREATE OR REPLACE FUNCTION public.get_radar_stats(dias_atras integer DEFAULT 30, somente_marketing boolean DEFAULT true)
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
$function$`
];

async function executeSql(sql) {
  const response = await fetch(`${url}/rest/v1/rpc/exec_raw_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ sql })
  });
  return response;
}

// Usa Management API do Supabase para rodar SQL
async function runSqlViaManagementApi(sql) {
  const projectRef = 'vhuvnutzklhskkwbpxdz';
  const managementKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Endpoint alternativo: usar o pg endpoint direto do Supabase
  const res = await fetch(`${url}/pg`, {
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json',
      'apikey': managementKey,
      'Authorization': `Bearer ${managementKey}`
    },
    body: JSON.stringify({ query: sql })
  });
  const txt = await res.text();
  return { status: res.status, body: txt };
}

// Testa primeiro com uma query simples via RPC existente
async function main() {
  console.log('🚀 Aplicando funções modulares do Radar...\n');
  console.log('URL:', url?.substring(0, 40));
  
  // Tenta via query direta usando fetch para o endpoint SQL do Supabase
  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    const nome = fn.includes('radar_kpis') ? 'radar_kpis' :
                 fn.includes('radar_origens') ? 'radar_origens' :
                 fn.includes('radar_paginas') ? 'radar_paginas' :
                 fn.includes('radar_ecossistemas') ? 'radar_ecossistemas' :
                 fn.includes('radar_campanhas') ? 'radar_campanhas' :
                 fn.includes('radar_funil') ? 'radar_funil' : 'get_radar_stats';
    
    try {
      // Tenta endpoint /pg do Supabase
      const res = await fetch(`${url}/pg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ query: fn })
      });
      const body = await res.text();
      
      if (res.status === 200 || res.status === 204) {
        console.log(`✅ ${nome} aplicada com sucesso`);
      } else {
        console.log(`⚠️  ${nome}: status ${res.status} - ${body.substring(0,100)}`);
      }
    } catch (e) {
      console.log(`❌ ${nome}: ${e.message}`);
    }
  }
  
  // Tenta testar se o RPC funciona
  console.log('\n🧪 Testando RPC get_radar_stats...');
  const { data, error } = await supabase.rpc('get_radar_stats', { dias_atras: 30, somente_marketing: false });
  if (error) {
    console.log('❌ RPC ainda com erro:', error.message);
    console.log('\n⚠️  AÇÃO MANUAL NECESSÁRIA:');
    console.log('Cole o conteúdo de scripts/atualizacao_radar_tempo.sql no SQL Editor do Supabase e execute.');
  } else {
    console.log('✅ RPC funcionando! Total visitas:', data?.totalVisitas);
    console.log('   Origens:', data?.topOrigens?.length, 'entradas');
    console.log('   Funil:', data?.funil?.length, 'produtos');
  }
}

main().catch(console.error);
