
BEGIN
    RETURN QUERY
    WITH elementos AS (
        SELECT 
            e.id,
            e.external_id,
            e.categoria,
            e.familia,
            e.tipo,
            e.propriedades,
            e.is_active,
            e.etapa_id,
            e.subetapa_id,
            p.id AS projeto_bim_id
        FROM public.elementos_bim e
        JOIN public.projetos_bim p ON e.projeto_bim_id = p.id
        WHERE p.empreendimento_id = p_empreendimento_id
          AND p.organizacao_id = p_organizacao_id
          AND p.is_lixeira = false
          AND e.categoria NOT IN ('Revit Level', 'Revit Grids', 'Revit Scope Boxes', 'Revit Reference Planes', '<Indesejado>')
    ),
    mapeamentos AS (
        SELECT 
            m.id AS mapeamento_id,
            m.propriedade_nome,
            m.propriedade_quantidade,
            m.categoria_bim,
            m.familia_bim,
            m.tipo_vinculo,
            m.escopo,
            m.unidade_override,
            m.fator_conversao,
            m.material_id,
            m.sinapi_id,
            CASE m.escopo 
                WHEN 'familia' THEN 1 
                WHEN 'categoria' THEN 2 
                WHEN 'projeto' THEN 3 
                ELSE 99 
            END as prioridade
        FROM public.bim_mapeamentos_propriedades m
        WHERE m.organizacao_id = p_organizacao_id
          AND m.tipo_vinculo IN ('material', 'elemento')
    ),
    vinculos_material AS (
        SELECT 
            e.id AS elemento_id,
            e.external_id,
            e.categoria,
            e.familia,
            e.is_active,
            e.etapa_id,
            e.subetapa_id,
            m.propriedade_nome AS prop_nome,
            NULLIF(SUBSTRING(REPLACE(e.propriedades ->> m.propriedade_nome, ',', '.') FROM '^([0-9]+(?:\.[0-9]+)?)'), '')::numeric AS prop_valor,
            m.propriedade_nome AS matching_key,
            m.*
        FROM elementos e
        JOIN mapeamentos m ON m.tipo_vinculo = 'material' AND (e.propriedades ? m.propriedade_nome)
        WHERE (e.propriedades ->> m.propriedade_nome) ~ '^[0-9]'
          AND (
                (m.escopo = 'projeto')
                OR (m.escopo = 'categoria' AND e.categoria = m.categoria_bim)
                OR (m.escopo = 'familia' AND e.categoria = m.categoria_bim AND e.familia = m.familia_bim)
          )
    ),
    vinculos_elemento AS (
        SELECT 
            e.id AS elemento_id,
            e.external_id,
            e.categoria,
            e.familia,
            e.is_active,
            e.etapa_id,
            e.subetapa_id,
            COALESCE(m.propriedade_quantidade, 'Unidade') AS prop_nome,
            CASE 
                WHEN m.propriedade_quantidade IS NOT NULL AND (e.propriedades ? m.propriedade_quantidade) THEN
                    NULLIF(SUBSTRING(REPLACE(e.propriedades ->> m.propriedade_quantidade, ',', '.') FROM '^([0-9]+(?:\.[0-9]+)?)'), '')::numeric
                ELSE 1.0
            END AS prop_valor,
            '@ELEMENTO@' AS matching_key,
            m.*
        FROM elementos e
        JOIN mapeamentos m ON m.tipo_vinculo = 'elemento'
          AND (
                (m.escopo = 'projeto')
                OR (m.escopo = 'categoria' AND e.categoria = m.categoria_bim)
                OR (m.escopo = 'familia' AND e.categoria = m.categoria_bim AND e.familia = m.familia_bim)
          )
    ),
    vinculos AS (
        SELECT * FROM vinculos_material WHERE prop_valor > 0
        UNION ALL
        SELECT * FROM vinculos_elemento WHERE prop_valor > 0
    ),
    vinculos_filtrados AS (
        SELECT DISTINCT ON (v.elemento_id, v.matching_key)
            *
        FROM vinculos v
        ORDER BY v.elemento_id, v.matching_key, v.prioridade ASC
    ),
    agregado AS (
        -- Group by Material AND Etapa AND Subetapa
        SELECT 
            (CASE WHEN m.material_id IS NOT NULL THEN 'mat_' || m.material_id ELSE 'sinapi_' || m.sinapi_id END) || 
            '_et' || COALESCE(m.etapa_id::text, '0') || 
            '_sub' || COALESCE(m.subetapa_id::text, '0') AS key_id,
            MAX(m.mapeamento_id) AS mapeamento_id,
            m.material_id,
            m.sinapi_id,
            m.etapa_id,
            m.subetapa_id,
            MAX(m.unidade_override) AS unidade_override,
            MAX(m.fator_conversao) AS fator_conversao,
            MAX(m.prop_nome) AS sample_prop_nome,
            SUM(m.prop_valor) AS total_quantidade,
            COUNT(DISTINCT m.elemento_id) AS total_elementos,
            array_agg(m.external_id) FILTER (WHERE m.is_active = true) AS ativos,
            array_agg(m.external_id) FILTER (WHERE m.is_active = false) AS inativos
        FROM vinculos_filtrados m
        GROUP BY m.material_id, m.sinapi_id, m.etapa_id, m.subetapa_id
    )
    SELECT 
        a.key_id::text AS key,
        a.mapeamento_id,
        COALESCE(mat.nome, sin.nome) AS nome,
        COALESCE(
            a.unidade_override, 
            mat.unidade_medida, 
            sin.unidade_medida, 
            CASE 
                WHEN a.sample_prop_nome ILIKE '%volume%' THEN 'm³'
                WHEN a.sample_prop_nome ILIKE '%área%' OR a.sample_prop_nome ILIKE '%area%' THEN 'm²'
                WHEN a.sample_prop_nome ILIKE '%comprimento%' OR a.sample_prop_nome ILIKE '%length%' THEN 'm'
                WHEN a.sample_prop_nome ILIKE '%diâmetro%' OR a.sample_prop_nome ILIKE '%diametro%' THEN 'mm'
                ELSE 'un'
            END
        ) AS unidade,
        COALESCE(mat.preco_unitario, sin.preco_unitario, 0) AS preco_unitario,
        mat.classificacao AS classificacao,
        a.total_quantidade AS quantidade,
        a.total_elementos AS qtd_elementos,
        COALESCE(a.ativos, ARRAY[]::text[]) AS external_ids_ativos,
        COALESCE(a.inativos, ARRAY[]::text[]) AS external_ids_inativos,
        a.fator_conversao,
        a.material_id,
        a.sinapi_id,
        a.etapa_id,
        a.subetapa_id,
        eo.nome_etapa AS etapa_nome,
        so.nome_subetapa AS subetapa_nome,
        (a.total_quantidade * COALESCE(mat.preco_unitario, sin.preco_unitario, 0)) AS custo_total,
        (array_length(a.inativos, 1) > 0) AS tem_alertas,
        CASE WHEN mat.id IS NOT NULL THEN 'proprio' ELSE 'sinapi' END AS origem
    FROM agregado a
    LEFT JOIN public.materiais mat ON a.material_id = mat.id
    LEFT JOIN public.sinapi sin ON a.sinapi_id = sin.id
    LEFT JOIN public.etapa_obra eo ON a.etapa_id = eo.id
    LEFT JOIN public.subetapas so ON a.subetapa_id = so.id
    ORDER BY a.etapa_id NULLS LAST, custo_total DESC;
END;
