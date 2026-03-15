-- 1. Adicionando colunas de controle de etapas no Elemento BIM
ALTER TABLE public.elementos_bim ADD COLUMN IF NOT EXISTS etapa_id bigint;
ALTER TABLE public.elementos_bim ADD COLUMN IF NOT EXISTS subetapa_id bigint;

-- 2. Função de Trigger: Ao vincular ou desvincular Elemento BIM de uma Atividade
CREATE OR REPLACE FUNCTION public.fn_sync_elemento_bim_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_etapa_id bigint;
    v_subetapa_id bigint;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- Remove o vinculo se desassociar a atividade (Pode ser ajustado se permitir M:N, mas via de regra remove)
        UPDATE public.elementos_bim 
        SET etapa_id = NULL, subetapa_id = NULL 
        WHERE projeto_bim_id = OLD.projeto_bim_id AND external_id = OLD.external_id;
        RETURN OLD;
    END IF;

    -- Pega a etapa e subetapa da atividade sendo vinculada
    SELECT etapa_id, subetapa_id INTO v_etapa_id, v_subetapa_id
    FROM public.activities
    WHERE id = NEW.atividade_id;

    -- Atualiza o elemento 3D correspondente
    UPDATE public.elementos_bim 
    SET etapa_id = v_etapa_id, subetapa_id = v_subetapa_id 
    WHERE projeto_bim_id = NEW.projeto_bim_id AND external_id = NEW.external_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_elemento_bim_etapa_insupd ON public.atividades_elementos;
CREATE TRIGGER trg_sync_elemento_bim_etapa_insupd
    AFTER INSERT OR UPDATE OR DELETE ON public.atividades_elementos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_elemento_bim_etapa();

-- 3. Função de Trigger: Ao atualizar a Etapa/Subetapa na própria Atividade no Cronograma
CREATE OR REPLACE FUNCTION public.fn_sync_elemento_bim_etapa_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se a etapa_id ou subetapa_id mudar no Cronograma, joga a mudança para os Elementos BIM vinculados
    IF (NEW.etapa_id IS DISTINCT FROM OLD.etapa_id OR NEW.subetapa_id IS DISTINCT FROM OLD.subetapa_id) THEN
        UPDATE public.elementos_bim e
        SET etapa_id = NEW.etapa_id, subetapa_id = NEW.subetapa_id
        FROM public.atividades_elementos ae
        WHERE ae.atividade_id = NEW.id
          AND e.projeto_bim_id = ae.projeto_bim_id 
          AND e.external_id = ae.external_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_elemento_bim_etapa_activity ON public.activities;
CREATE TRIGGER trg_sync_elemento_bim_etapa_activity
    AFTER UPDATE OF etapa_id, subetapa_id ON public.activities
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_elemento_bim_etapa_from_activity();


-- 4. Nova versão da Função de RPC para Agrupar Quantitativos por Etapa!
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
    fator_conversao text,
    material_id bigint,
    sinapi_id bigint,
    etapa_id bigint,
    subetapa_id bigint,
    etapa_nome text,
    subetapa_nome text,
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
$$;
