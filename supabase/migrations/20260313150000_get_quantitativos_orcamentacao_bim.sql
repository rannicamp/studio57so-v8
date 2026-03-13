/* 
  Esta RPC vai substituir o processamento O(N*M) em Javascript no frontend.
  Vamos calcular a quantidade total de material vinculada considerando a prioridade de escopo,
  retornando os mesmos dados agregados.
*/

DROP FUNCTION IF EXISTS public.get_quantitativos_orcamentacao_bim(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_quantitativos_orcamentacao_bim(bigint, uuid);
DROP FUNCTION IF EXISTS public.get_quantitativos_orcamentacao_bim(bigint, bigint);

CREATE OR REPLACE FUNCTION public.get_quantitativos_orcamentacao_bim(
    p_organizacao_id bigint,
    p_empreendimento_id bigint
)
RETURNS TABLE (
    key text,
    mapeamento_id bigint,
    nome text,
    unidade text,
    preco_unitario numeric,
    classificacao text,
    quantidade numeric,
    qtd_elementos bigint,
    external_ids_ativos text[],
    external_ids_inativos text[],
    custo_total numeric,
    tem_alertas boolean,
    origem text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH elementos AS (
        -- 1. Pega todos os elementos dos modelos ativos desse empreendimento
        SELECT 
            e.id,
            e.external_id,
            e.categoria,
            e.familia,
            e.tipo,
            e.propriedades,
            e.is_active,
            p.id AS projeto_bim_id
        FROM public.elementos_bim e
        JOIN public.projetos_bim p ON e.projeto_bim_id = p.id
        WHERE p.empreendimento_id = p_empreendimento_id
          AND p.organizacao_id = p_organizacao_id
          AND p.is_lixeira = false
          AND e.categoria NOT IN ('Revit Level', 'Revit Grids', 'Revit Scope Boxes', 'Revit Reference Planes', '<Indesejado>')
    ),
    propriedades_extraidas AS (
        -- 2. Transforma o JSONB 'propriedades' em linhas pra ser filtrável e vinculável
        SELECT 
            e.id AS elemento_id,
            e.external_id,
            e.categoria,
            e.familia,
            e.is_active,
            k AS prop_nome,
            NULLIF(SUBSTRING(REPLACE(v, ',', '.') FROM '^([0-9]+(?:\.[0-9]+)?)'), '')::numeric AS prop_valor
        FROM elementos e,
             jsonb_each_text(e.propriedades) AS j(k,v)
        WHERE v ~ '^[0-9]'
    ),
    mapeamentos AS (
        -- 3. Puxa os mapeamentos da organizacao
        SELECT 
            m.id,
            m.propriedade_nome,
            m.categoria_bim,
            m.familia_bim,
            m.tipo_vinculo,
            m.escopo,
            m.unidade_override,
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
          AND m.tipo_vinculo = 'material'
    ),
    matchings AS (
        -- 4. Faz o match respeitando prioridade de escopo usando ROW_NUMBER
        SELECT 
            p.elemento_id,
            p.external_id,
            p.is_active,
            p.prop_nome,
            p.prop_valor,
            m.id AS mapeamento_id,
            m.material_id,
            m.sinapi_id,
            m.unidade_override,
            m.prioridade,
            ROW_NUMBER() OVER (
                PARTITION BY p.elemento_id, p.prop_nome 
                ORDER BY m.prioridade ASC
            ) as rn
        FROM propriedades_extraidas p
        JOIN mapeamentos m ON p.prop_nome = m.propriedade_nome
        WHERE (m.escopo = 'projeto')
           OR (m.escopo = 'categoria' AND m.categoria_bim = p.categoria)
           OR (m.escopo = 'familia' AND m.categoria_bim = p.categoria AND m.familia_bim = p.familia)
    ),
    melhor_matching AS (
        -- 5. Só fica com o mapeamento mais específico (prioridade 1) por elemento+propriedade
        SELECT * FROM matchings WHERE rn = 1
    ),
    agregado AS (
        -- 6. Agrega agrupando pelo material / sinapi
        SELECT 
            (CASE WHEN m.material_id IS NOT NULL THEN 'mat_' || m.material_id ELSE 'sinapi_' || m.sinapi_id END)::text AS key_id,
            MAX(m.mapeamento_id) AS mapeamento_id,
            m.material_id,
            m.sinapi_id,
            MAX(m.unidade_override) AS unidade_override,
            MAX(m.prop_nome) AS sample_prop_nome,
            SUM(m.prop_valor) AS total_quantidade,
            COUNT(DISTINCT m.elemento_id) AS total_elementos,
            array_agg(m.external_id) FILTER (WHERE m.is_active = true) AS ativos,
            array_agg(m.external_id) FILTER (WHERE m.is_active = false) AS inativos
        FROM melhor_matching m
        GROUP BY 1, m.material_id, m.sinapi_id
    )
    -- 7. Join pra pegar dados do catalogo
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
        (a.total_quantidade * COALESCE(mat.preco_unitario, sin.preco_unitario, 0)) AS custo_total,
        (array_length(a.inativos, 1) > 0) AS tem_alertas,
        CASE WHEN mat.id IS NOT NULL THEN 'proprio' ELSE 'sinapi' END AS origem
    FROM agregado a
    LEFT JOIN public.materiais mat ON a.material_id = mat.id
    LEFT JOIN public.sinapi sin ON a.sinapi_id = sin.id
    ORDER BY custo_total DESC;
END;
$$;
