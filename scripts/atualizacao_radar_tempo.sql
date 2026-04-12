-- =========================================================================
-- ARQUITETURA MODULAR DO RADAR STUDIO (BASEADO EM SESSÕES)
-- Cada Card do Dashboard agora tem sua própria função SQL!
-- =========================================================================

-- 1. Garante que as colunas existem
ALTER TABLE public.monitor_visitas 
ADD COLUMN IF NOT EXISTS tempo_permanencia_segundos integer DEFAULT 0;


-- =========================================================================
-- FUNÇÃO 1: KPIs Principais (Visitas Rápidas, Devices, Retenção Geral)
-- =========================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- FUNÇÃO 2: Top Origens (Origem da Sessão, não Pageviews!)
-- =========================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- FUNÇÃO 3: Páginas Mais Visitadas (Visitantes Únicos por Página)
-- =========================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- FUNÇÃO 4: Ecossistemas (Trafego Agrupado por Plataforma)
-- =========================================================================
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
        WHEN origem_principal ILIKE '%anúncio%' THEN 'Outros Anúncios'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- FUNÇÃO 5: Campanhas e Anúncios Específicos
-- =========================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- FUNÇÃO 6: Funil Frio (Produto LP -> Obrigado)
-- =========================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- ORQUESTRADOR: get_radar_stats (O que o Frontend chama)
-- Mapeia e centraliza as chamadas pra não quebrar a tela atual
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_radar_stats(dias_atras integer DEFAULT 30, somente_marketing boolean DEFAULT true)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  kpis json;
BEGIN
  -- Reúne todos os mini-módulos independentes num objeto só
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
$function$;
