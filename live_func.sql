CREATE OR REPLACE FUNCTION public.get_quantitativos_orcamentacao_bim(p_organizacao_id bigint, p_empreendimento_id bigint)
 RETURNS TABLE(key text, mapeamento_id bigint, nome text, unidade text, preco_unitario numeric, classificacao text, quantidade numeric, qtd_elementos bigint, external_ids_ativos text[], external_ids_inativos text[], fator_conversao text, material_id bigint, sinapi_id bigint, etapa_id bigint, subetapa_id bigint, etapa_nome text, subetapa_nome text, custo_total numeric, tem_alertas boolean, origem text, is_avulso boolean, pai_mapeamento_id bigint)
 LANGUAGE plpgsql
AS $function$
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
            m.tipo_bim,
            m.elemento_id AS map_elemento_id,
            m.tipo_vinculo,
            m.escopo,
            m.unidade_override,
            m.fator_conversao,
            m.material_id,
            m.sinapi_id,
            m.vinculo_pai_id,
            CASE m.escopo 
                WHEN 'elemento' THEN 1 
                WHEN 'tipo' THEN 2 
                WHEN 'familia' THEN 3 
                WHEN 'categoria' THEN 4 
                WHEN 'projeto' THEN 5 
                ELSE 99 
            END as prioridade
        FROM public.bim_mapeamentos_propriedades m
        WHERE m.organizacao_id = p_organizacao_id
          AND m.tipo_vinculo IN ('material', 'elemento', 'avulso')
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
        JOIN mapeamentos m ON m.tipo_vinculo = 'material' AND (e.propriedades ? m.propriedade_nome) AND m.vinculo_pai_id IS NULL
        WHERE (e.propriedades ->> m.propriedade_nome) ~ '^[0-9]'
          AND (
                (m.escopo = 'projeto')
                OR (m.escopo = 'categoria' AND e.categoria = m.categoria_bim)
                OR (m.escopo = 'familia' AND e.categoria = m.categoria_bim AND e.familia = m.familia_bim)
                OR (m.escopo = 'tipo' AND e.categoria = m.categoria_bim AND e.familia = m.familia_bim AND COALESCE(e.tipo, '') = COALESCE(m.tipo_bim, ''))
                OR (m.escopo = 'elemento' AND e.external_id = m.map_elemento_id)
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
        JOIN mapeamentos m ON m.tipo_vinculo = 'elemento' AND m.vinculo_pai_id IS NULL
          AND (
                (m.escopo = 'projeto')
                OR (m.escopo = 'categoria' AND e.categoria = m.categoria_bim)
                OR (m.escopo = 'familia' AND e.categoria = m.categoria_bim AND e.familia = m.familia_bim)
                OR (m.escopo = 'tipo' AND e.categoria = m.categoria_bim AND e.familia = m.familia_bim AND COALESCE(e.tipo, '') = COALESCE(m.tipo_bim, ''))
                OR (m.escopo = 'elemento' AND e.external_id = m.map_elemento_id)
          )
    ),
    vinculos_nativos AS (
        SELECT * FROM vinculos_material WHERE prop_valor > 0
        UNION ALL
        SELECT * FROM vinculos_elemento WHERE prop_valor > 0
    ),
    vinculos_nativos_filtrados AS (
        SELECT DISTINCT ON (v.elemento_id, COALESCE(NULLIF(v.matching_key, '@ELEMENTO@'), '!GLOBAL'))
            v.*,
            false AS is_avulso,
            NULL::bigint AS pai_mapeamento_id
        FROM vinculos_nativos v
        ORDER BY v.elemento_id, COALESCE(NULLIF(v.matching_key, '@ELEMENTO@'), '!GLOBAL'), v.prioridade ASC
    ),
    vinculos_filhos AS (
        SELECT
            vnf.elemento_id,
            vnf.external_id,
            vnf.categoria,
            vnf.familia,
            vnf.is_active,
            vnf.etapa_id,
            vnf.subetapa_id,
            mf.propriedade_nome AS prop_nome,
            vnf.prop_valor AS prop_valor, 
            vnf.matching_key,
            mf.mapeamento_id,
            mf.propriedade_nome,
            mf.propriedade_quantidade,
            mf.categoria_bim,
            mf.familia_bim,
            mf.tipo_bim,
            mf.map_elemento_id,
            mf.tipo_vinculo,
            mf.escopo,
            mf.unidade_override,
            mf.fator_conversao,
            mf.material_id,
            mf.sinapi_id,
            mf.vinculo_pai_id,
            mf.prioridade,
            false AS is_avulso,
            mf.vinculo_pai_id AS pai_mapeamento_id
        FROM vinculos_nativos_filtrados vnf
        JOIN mapeamentos mf ON mf.vinculo_pai_id = vnf.mapeamento_id
    ),
    vinculos_avulsos AS (
        SELECT
            NULL::uuid AS elemento_id,
            NULL::text AS external_id,
            NULL::text AS categoria,
            NULL::text AS familia,
            true AS is_active,
            NULL::bigint AS etapa_id,
            NULL::bigint AS subetapa_id,
            'Avulso' AS prop_nome,
            0.0::numeric AS prop_valor, 
            '!AVULSO' AS matching_key,
            m.mapeamento_id,
            m.propriedade_nome,
            m.propriedade_quantidade,
            m.categoria_bim,
            m.familia_bim,
            m.tipo_bim,
            m.map_elemento_id,
            m.tipo_vinculo,
            m.escopo,
            m.unidade_override,
            m.fator_conversao,
            m.material_id,
            m.sinapi_id,
            m.vinculo_pai_id,
            m.prioridade,
            true AS is_avulso,
            NULL::bigint AS pai_mapeamento_id
        FROM mapeamentos m 
        WHERE m.tipo_vinculo = 'avulso' AND m.vinculo_pai_id IS NULL
    ),
    todos_vinculos AS (
        SELECT * FROM vinculos_nativos_filtrados
        UNION ALL
        SELECT * FROM vinculos_filhos
        UNION ALL
        SELECT * FROM vinculos_avulsos
    ),
    agregado AS (
        SELECT 
            (CASE WHEN m.material_id IS NOT NULL THEN 'mat_' || m.material_id ELSE 'sinapi_' || m.sinapi_id END) || 
            '_et' || COALESCE(m.etapa_id::text, '0') || 
            '_sub' || COALESCE(m.subetapa_id::text, '0') || 
            '_pai' || COALESCE(m.pai_mapeamento_id::text, '0') ||
            '_av' || m.is_avulso::text AS key_id,
            MAX(m.mapeamento_id) AS mapeamento_id,
            m.pai_mapeamento_id,
            m.material_id,
            m.sinapi_id,
            m.etapa_id,
            m.subetapa_id,
            MAX(m.unidade_override) AS unidade_override,
            MAX(m.fator_conversao) AS fator_conversao,
            MAX(m.prop_nome) AS sample_prop_nome,
            SUM(m.prop_valor) AS total_quantidade,
            COUNT(DISTINCT m.elemento_id) AS total_elementos,
            array_agg(DISTINCT m.external_id) FILTER (WHERE m.is_active = true AND m.external_id IS NOT NULL) AS ativos,
            array_agg(DISTINCT m.external_id) FILTER (WHERE m.is_active = false AND m.external_id IS NOT NULL) AS inativos,
            bool_or(m.is_avulso) AS is_avulso
        FROM todos_vinculos m
        GROUP BY m.material_id, m.sinapi_id, m.etapa_id, m.subetapa_id, m.pai_mapeamento_id, m.is_avulso
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
        CASE WHEN mat.id IS NOT NULL THEN 'proprio' ELSE 'sinapi' END AS origem,
        a.is_avulso,
        a.pai_mapeamento_id
    FROM agregado a
    LEFT JOIN public.materiais mat ON a.material_id = mat.id
    LEFT JOIN public.sinapi sin ON a.sinapi_id = sin.id
    LEFT JOIN public.etapa_obra eo ON a.etapa_id = eo.id
    LEFT JOIN public.subetapas so ON a.subetapa_id = so.id
    ORDER BY a.etapa_id NULLS LAST, custo_total DESC;
END;
$function$
