CREATE OR REPLACE FUNCTION public.financeiro_montar_where(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

declare
  v_where text;
  v_use_competencia boolean;
  v_search_term text; -- 🔧 NOVO: variável local para o searchTerm
begin
  v_use_competencia := coalesce((p_filtros->>'useCompetencia')::boolean, false);
  -- 🔧 NOVO: extrai o searchTerm UMA VEZ, antes de montar o WHERE dinâmico
  v_search_term := trim(p_filtros->>'searchTerm');

  v_where := ' where l.organizacao_id = ' || p_organizacao_id;

  -- 1. Busca Textual (CORRIGIDO: usa v_search_term com valor real, não referência ao jsonb)
  if v_search_term is not null and v_search_term <> '' then
    v_where := v_where || ' and (';
    v_where := v_where || ' l.descricao ilike ''%' || replace(v_search_term, '''', '''''') || '%''';
    v_where := v_where || ' or cast(l.valor as text) ilike ''%' || replace(v_search_term, '''', '''''') || '%''';
    v_where := v_where || ' or l.conta_id in (select id from contas_financeiras where nome ilike ''%' || replace(v_search_term, '''', '''''') || '%'')';
    v_where := v_where || ' or l.favorecido_contato_id in (select id from contatos where nome ilike ''%' || replace(v_search_term, '''', '''''') || '%'' or razao_social ilike ''%' || replace(v_search_term, '''', '''''') || '%'')';
    v_where := v_where || ' or l.empresa_id in (select id from cadastro_empresa where nome_fantasia ilike ''%' || replace(v_search_term, '''', '''''') || '%'' or razao_social ilike ''%' || replace(v_search_term, '''', '''''') || '%'')';
    v_where := v_where || ')';
  end if;

  -- 2. Datas (Lei da Fernanda)
  if (p_filtros->>'startDate') is not null and (p_filtros->>'startDate') <> '' then
    if v_use_competencia then
        v_where := v_where || ' and l.data_transacao >= ''' || (p_filtros->>'startDate') || '''';
    else
        v_where := v_where || ' and (CASE WHEN l.data_pagamento IS NOT NULL THEN l.data_pagamento WHEN l.data_vencimento IS NOT NULL THEN l.data_vencimento ELSE l.data_transacao END) >= ''' || (p_filtros->>'startDate') || '''';
    end if;
  end if;

  if (p_filtros->>'endDate') is not null and (p_filtros->>'endDate') <> '' then
    if v_use_competencia then
        v_where := v_where || ' and l.data_transacao <= ''' || (p_filtros->>'endDate') || '''';
    else
        v_where := v_where || ' and (CASE WHEN l.data_pagamento IS NOT NULL THEN l.data_pagamento WHEN l.data_vencimento IS NOT NULL THEN l.data_vencimento ELSE l.data_transacao END) <= ''' || (p_filtros->>'endDate') || '''';
    end if;
  end if;

  -- 3. Status
  if (p_filtros->'status') is not null and jsonb_array_length(p_filtros->'status') > 0 then
      declare
        v_or_conditions text[] := array[]::text[];
      begin
        if p_filtros->'status' @> '["Pago"]' then
          v_or_conditions := array_append(v_or_conditions, 'l.status in (''Pago'', ''Conciliado'')');
        end if;
        if p_filtros->'status' @> '["Pendente"]' then
          v_or_conditions := array_append(v_or_conditions, '(l.status = ''Pendente'' and coalesce(l.data_vencimento, l.data_transacao) >= current_date)');
        end if;
        if p_filtros->'status' @> '["Atrasada"]' then
          v_or_conditions := array_append(v_or_conditions, '(l.status = ''Pendente'' and coalesce(l.data_vencimento, l.data_transacao) < current_date)');
        end if;

        if array_length(v_or_conditions, 1) > 0 then
           v_where := v_where || ' and (' || array_to_string(v_or_conditions, ' OR ') || ')';
        end if;
      end;
  end if;

  -- 4. Categorias (Chamada Segura da Função Recursiva)
  if (p_filtros->'categoriaIds') is not null and jsonb_array_length(p_filtros->'categoriaIds') > 0 then
      if p_filtros->'categoriaIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.categoria_id in (select id from get_recursive_categories(''' || (p_filtros->'categoriaIds') || ''')) or l.categoria_id is null)';
      else
        v_where := v_where || ' and l.categoria_id in (select id from get_recursive_categories(''' || (p_filtros->'categoriaIds') || '''))';
      end if;
  end if;

  -- 5. Contas (Lógica Segura sem referência externa)
  if (p_filtros->'contaIds') is not null and jsonb_array_length(p_filtros->'contaIds') > 0 then
      if p_filtros->'contaIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.conta_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'contaIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.conta_id is null)';
      else
        v_where := v_where || ' and l.conta_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'contaIds') || ''') elem)';
      end if;
  end if;

  -- 6. Empreendimentos
  if (p_filtros->'empreendimentoIds') is not null and jsonb_array_length(p_filtros->'empreendimentoIds') > 0 then
      if p_filtros->'empreendimentoIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.empreendimento_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'empreendimentoIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.empreendimento_id is null)';
      else
        v_where := v_where || ' and l.empreendimento_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'empreendimentoIds') || ''') elem)';
      end if;
  end if;

  -- 7. Empresas
  if (p_filtros->'empresaIds') is not null and jsonb_array_length(p_filtros->'empresaIds') > 0 then
      if p_filtros->'empresaIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.empresa_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'empresaIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.empresa_id is null)';
      else
        v_where := v_where || ' and l.empresa_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'empresaIds') || ''') elem)';
      end if;
  end if;
  
  -- 8. Etapas
  if (p_filtros->'etapaIds') is not null and jsonb_array_length(p_filtros->'etapaIds') > 0 then
      if p_filtros->'etapaIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.etapa_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'etapaIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.etapa_id is null)';
      else
        v_where := v_where || ' and l.etapa_id in (select (elem)::bigint from jsonb_array_elements_text(''' || (p_filtros->'etapaIds') || ''') elem)';
      end if;
  end if;

  -- 9. Tipo (Receita/Despesa) - Tratamento Seguro
  if (p_filtros->'tipo') is not null and jsonb_array_length(p_filtros->'tipo') > 0 then
    v_where := v_where || ' and l.tipo in (select elem::text from jsonb_array_elements_text(''' || (p_filtros->'tipo') || ''') elem)';
  end if;

  -- 10. Favorecido
  if (p_filtros->>'favorecidoId') is not null then
    if (p_filtros->>'favorecidoId') = 'IS_NULL' then
       v_where := v_where || ' and l.favorecido_contato_id is null';
    else
       v_where := v_where || ' and l.favorecido_contato_id = ' || (p_filtros->>'favorecidoId');
    end if;
  end if;

  -- 11. Ignorar Especiais (A LÓGICA DE EXCLUSÃO IMPORTANTE)
  if (p_filtros->>'ignoreTransfers')::boolean is true then
    v_where := v_where || ' and l.transferencia_id is null and (l.categoria_id not in (select id from public.categorias_financeiras where nome ilike ''%Transfer%ncia%'') or l.categoria_id is null)';
  end if;

  if (p_filtros->>'ignoreChargebacks')::boolean is true then
    v_where := v_where || ' and (l.categoria_id not in (select id from public.categorias_financeiras where nome ilike ''%Estorno%'') or l.categoria_id is null)';
  end if;

  return v_where;
end;

$function$
