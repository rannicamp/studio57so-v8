
DECLARE
    start_date timestamp;
    total_visitas int;
    mobile_count int;
    desktop_count int;
    top_origens json;
    top_paginas json;
BEGIN
    -- Define data de corte
    start_date := NOW() - (dias_atras || ' days')::interval;

    -- 1. Totais
    SELECT COUNT(*) INTO total_visitas 
    FROM monitor_visitas WHERE data_acesso >= start_date;

    -- 2. Dispositivos
    SELECT 
        COUNT(*) FILTER (WHERE dispositivo = 'Celular'),
        COUNT(*) FILTER (WHERE dispositivo = 'Computador')
    INTO mobile_count, desktop_count
    FROM monitor_visitas 
    WHERE data_acesso >= start_date;

    -- 3. Top Origens
    SELECT json_agg(t) INTO top_origens FROM (
        SELECT 
            COALESCE(NULLIF(origem, ''), 'Direto') as nome, 
            COUNT(*) as qtd
        FROM monitor_visitas
        WHERE data_acesso >= start_date
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 10
    ) t;

    -- 4. Top Páginas
    SELECT json_agg(t) INTO top_paginas FROM (
        SELECT pagina as nome, COUNT(*) as qtd
        FROM monitor_visitas
        WHERE data_acesso >= start_date
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 10
    ) t;

    -- Retorno
    RETURN json_build_object(
        'totalVisitas', COALESCE(total_visitas, 0),
        'porDispositivo', json_build_object(
            'mobile', COALESCE(mobile_count, 0),
            'desktop', COALESCE(desktop_count, 0)
        ),
        'topOrigens', COALESCE(top_origens, '[]'::json),
        'topPaginas', COALESCE(top_paginas, '[]'::json)
    );
END;
