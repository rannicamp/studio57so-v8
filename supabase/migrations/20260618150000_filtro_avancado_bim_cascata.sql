-- 1. Remove a versão antiga com assinatura diferente (overload)
DROP FUNCTION IF EXISTS public.get_bim_field_values(bigint, text, text);
DROP FUNCTION IF EXISTS public.get_bim_field_values(bigint, bigint, text, text, jsonb);

-- 2. Cria a nova RPC de get_bim_field_values com cascata inteligente de filtros
CREATE OR REPLACE FUNCTION public.get_bim_field_values(
  p_organizacao_id bigint,
  p_projeto_bim_id bigint,
  p_campo text,
  p_search text DEFAULT ''::text,
  p_filtros_ativos jsonb DEFAULT '{}'::jsonb
)
 RETURNS TABLE(valor text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_query text;
  v_where text;
  -- Lista de colunas que existem fisicamente na tabela elementos_bim
  v_standard_cols text[] := ARRAY['familia', 'tipo', 'categoria', 'nivel', 'status_execucao', 'sistema'];
  v_filter_key text;
  v_filter_val text;
BEGIN
  -- Inicializa a cláusula WHERE base filtrando por organização e projeto ativo
  v_where := format(' WHERE organizacao_id = %L AND projeto_bim_id = %L ', p_organizacao_id, p_projeto_bim_id);

  -- Processa os filtros acumulados anteriores enviados do frontend
  FOR v_filter_key, v_filter_val IN 
    SELECT key, value::text 
    FROM jsonb_each_text(p_filtros_ativos)
  LOOP
    IF v_filter_val IS NOT NULL AND v_filter_val <> '' THEN
      -- Se a chave do filtro ativo for um campo padrão da tabela
      IF v_filter_key = ANY(v_standard_cols) THEN
        v_where := v_where || format(' AND %I::text = %L ', v_filter_key, v_filter_val);
      ELSE
        -- Se for uma propriedade do JSONB
        v_where := v_where || format(' AND (propriedades->>%L)::text = %L ', v_filter_key, v_filter_val);
      END IF;
    END IF;
  END LOOP;

  -- Verifica se o campo solicitado para autocomplete é coluna padrão
  IF p_campo = ANY(v_standard_cols) THEN
    v_query := format(
      'SELECT DISTINCT %I::text 
       FROM public.elementos_bim 
       %s 
       AND %I::text ILIKE $1 
       AND %I IS NOT NULL 
       ORDER BY 1 
       LIMIT 50', 
      p_campo, v_where, p_campo, p_campo
    );
  ELSE
    -- Assume que o campo para autocomplete é uma chave dentro do JSONB
    v_query := format(
      'SELECT DISTINCT (propriedades->>%L)::text 
       FROM public.elementos_bim 
       %s 
       AND (propriedades->>%L)::text ILIKE $1 
       AND (propriedades->>%L) IS NOT NULL 
       ORDER BY 1 
       LIMIT 50', 
      p_campo, v_where, p_campo, p_campo
    );
  END IF;

  RETURN QUERY EXECUTE v_query USING '%' || p_search || '%';
END;
$function$;

-- 3. Cria a nova RPC get_bim_project_properties para listar chaves de propriedades customizadas
CREATE OR REPLACE FUNCTION public.get_bim_project_properties(
  p_organizacao_id bigint,
  p_projeto_bim_id bigint
)
 RETURNS TABLE(nome_propriedade text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT keys.key::text
  FROM public.elementos_bim e,
       LATERAL jsonb_object_keys(e.propriedades) AS keys(key)
  WHERE e.organizacao_id = p_organizacao_id
    AND e.projeto_bim_id = p_projeto_bim_id
    AND e.propriedades IS NOT NULL
  ORDER BY 1;
END;
$function$;
