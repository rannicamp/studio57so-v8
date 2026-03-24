-- ======================================================
-- MIGRAÇÃO COMPLETA: Studio 57 → Elo 57
-- Gerada em: 2026-03-24T19:41:00.679Z
-- ✅ OK: 1064 | ❌ Erros: 70
-- ======================================================

CREATE OR REPLACE FUNCTION public.delete_category_and_children(p_category_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    WITH RECURSIVE sub_categories AS (
        SELECT id FROM public.categorias_financeiras WHERE id = p_category_id
        UNION ALL
        SELECT c.id FROM public.categorias_financeiras c
        INNER JOIN sub_categories sc ON c.parent_id = sc.id
    )
    DELETE FROM public.categorias_financeiras
    WHERE id IN (SELECT id FROM sub_categories);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preencher_nome_mensagem()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Tenta buscar o nome na tabela de contatos usando o ID
    -- Se não achar contato (NULL), mantém o que vier ou fica NULL
    NEW.nome_remetente := (
        SELECT nome 
        FROM public.contatos 
        WHERE id = NEW.contato_id
    );
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.financeiro_montar_where(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
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
        v_where := v_where || ' and (l.conta_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'contaIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.conta_id is null)';
      else
        v_where := v_where || ' and l.conta_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'contaIds') || ''') elem)';
      end if;
  end if;

  -- 6. Empreendimentos
  if (p_filtros->'empreendimentoIds') is not null and jsonb_array_length(p_filtros->'empreendimentoIds') > 0 then
      if p_filtros->'empreendimentoIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.empreendimento_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'empreendimentoIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.empreendimento_id is null)';
      else
        v_where := v_where || ' and l.empreendimento_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'empreendimentoIds') || ''') elem)';
      end if;
  end if;

  -- 7. Empresas
  if (p_filtros->'empresaIds') is not null and jsonb_array_length(p_filtros->'empresaIds') > 0 then
      if p_filtros->'empresaIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.empresa_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'empresaIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.empresa_id is null)';
      else
        v_where := v_where || ' and l.empresa_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'empresaIds') || ''') elem)';
      end if;
  end if;
  
  -- 8. Etapas
  if (p_filtros->'etapaIds') is not null and jsonb_array_length(p_filtros->'etapaIds') > 0 then
      if p_filtros->'etapaIds' @> '["IS_NULL"]' then
        v_where := v_where || ' and (l.etapa_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'etapaIds') || ''') elem where (elem::text) <> ''"IS_NULL"'') or l.etapa_id is null)';
      else
        v_where := v_where || ' and l.etapa_id in (select (elem::text)::bigint from jsonb_array_elements(''' || (p_filtros->'etapaIds') || ''') elem)';
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
    v_where := v_where || ' and l.transferencia_id is null';
  end if;

  if (p_filtros->>'ignoreChargebacks')::boolean is true then
    v_where := v_where || ' and (l.categoria_id not in (189, 308) or l.categoria_id is null)';
  end if;

  return v_where;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.count_leads_per_campaign(campaign_ids text[], p_organizacao_id bigint)
 RETURNS TABLE(meta_campaign_id text, lead_count integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.meta_campaign_id,
        COUNT(c.id)::INT AS lead_count
    FROM
        contatos AS c
    WHERE
        c.meta_campaign_id = ANY(campaign_ids) AND
        c.organizacao_id = p_organizacao_id
    GROUP BY
        c.meta_campaign_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_status_produto_individual()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_status_contrato TEXT;
  v_novo_status_produto TEXT;
BEGIN
  -- Busca o status do contrato principal
  SELECT status_contrato INTO v_status_contrato FROM contratos WHERE id = COALESCE(NEW.contrato_id, OLD.contrato_id);

  -- Se um produto for ADICIONADO (INSERT) a um contrato...
  IF TG_OP = 'INSERT' THEN
    IF v_status_contrato = 'Assinado' THEN
      v_novo_status_produto := 'Vendido';
    ELSE
      v_novo_status_produto := 'Disponível';
    END IF;
    
    UPDATE produtos_empreendimento
    SET status = v_novo_status_produto
    WHERE id = NEW.produto_id;

  -- Se um produto for REMOVIDO (DELETE) de um contrato...
  ELSIF TG_OP = 'DELETE' THEN
    -- O produto sempre volta a ser 'Disponível' ao ser desvinculado.
    UPDATE produtos_empreendimento
    SET status = 'Disponível'
    WHERE id = OLD.produto_id;
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Atualiza 'updated_at' na tabela 'whatsapp_conversations'
    -- usando o 'contato_id' da nova mensagem
    UPDATE public.whatsapp_conversations
    SET updated_at = NEW.sent_at -- Ou NEW.created_at, dependendo de qual coluna reflete o timestamp da mensagem
    WHERE phone_number = (SELECT telefones[1]->>'telefone' FROM public.contatos WHERE id = NEW.contato_id);

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.encontrar_duplicatas_dinamico(p_criterios text[])
 RETURNS TABLE(id bigint, descricao text, valor numeric, data_transacao date, conta_id bigint, tipo text, favorecido_contato_id bigint, chave_duplicata text, contas_financeiras json, favorecido_contatos json)
 LANGUAGE plpgsql
AS $function$
DECLARE
    allowed_columns TEXT[] := ARRAY['data_transacao', 'descricao', 'valor', 'conta_id', 'tipo', 'favorecido_contato_id'];
    valid_criteria TEXT[];
    partition_clause TEXT;
    md5_clause TEXT;
    query TEXT;
BEGIN
    SELECT array_agg(c) INTO valid_criteria FROM unnest(p_criterios) c WHERE c = ANY(allowed_columns);

    IF array_length(valid_criteria, 1) IS NULL THEN
        RETURN;
    END IF;

    partition_clause := array_to_string(valid_criteria, ', ');
    md5_clause := 'md5(concat(' || (
        SELECT string_agg(format('COALESCE(%I::text, ''NULL'')', col), ', ')
        FROM unnest(valid_criteria) col
    ) || '))';

    query := format('
        WITH duplicatas AS (
            SELECT
                l.id,
                l.descricao,
                l.valor,
                l.data_transacao,
                l.conta_id,
                l.tipo,
                l.favorecido_contato_id,
                %s AS chave_duplicata,
                COUNT(*) OVER (PARTITION BY %s) as contagem
            FROM
                public.lancamentos l
            WHERE
                -- AQUI ESTÁ A MUDANÇA PRINCIPAL: Ignora lançamentos já verificados
                l.auditoria_verificado = FALSE
        )
        SELECT
            d.id,
            d.descricao,
            d.valor,
            d.data_transacao,
            d.conta_id,
            d.tipo,
            d.favorecido_contato_id,
            d.chave_duplicata,
            json_build_object(''id'', cf.id, ''nome'', cf.nome) as contas_financeiras,
            json_build_object(''id'', c.id, ''nome'', c.nome, ''razao_social'', c.razao_social) as favorecido_contatos
        FROM
            duplicatas d
        JOIN
            public.contas_financeiras cf ON d.conta_id = cf.id
        LEFT JOIN
            public.contatos c ON d.favorecido_contato_id = c.id
        WHERE
            d.contagem > 1
        ORDER BY
            d.chave_duplicata, d.id
    ', md5_clause, partition_clause);

    RETURN QUERY EXECUTE query;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_valor_base_produtos(p_empreendimento_id bigint, p_novo_valor_base numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE public.produtos_empreendimento
    SET
        valor_base = p_novo_valor_base,
        valor_venda_calculado = p_novo_valor_base * (1 + (COALESCE(fator_reajuste_percentual, 0) / 100))
    WHERE
        empreendimento_id = p_empreendimento_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.realizar_transferencia(p_descricao text, p_valor numeric, p_data_transacao date, p_conta_origem_id bigint, p_conta_destino_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Validação para garantir que as contas são diferentes
    IF p_conta_origem_id = p_conta_destino_id THEN
        RAISE EXCEPTION 'A conta de origem e destino não podem ser a mesma.';
    END IF;

    -- Lançamento de DESPESA na conta de origem
    INSERT INTO public.lancamentos (descricao, valor, data_transacao, tipo, status, conta_id, categoria_id)
    VALUES (
        'Transferência para ' || (SELECT nome FROM contas_financeiras WHERE id = p_conta_destino_id),
        p_valor,
        p_data_transacao,
        'Despesa', -- Marcado como Despesa para a conta de origem
        'Conciliado',
        p_conta_origem_id,
        NULL -- Categoria é nula para transferências
    );

    -- Lançamento de RECEITA na conta de destino
    INSERT INTO public.lancamentos (descricao, valor, data_transacao, tipo, status, conta_id, categoria_id)
    VALUES (
        'Transferência de ' || (SELECT nome FROM contas_financeiras WHERE id = p_conta_origem_id),
        p_valor,
        p_data_transacao,
        'Receita', -- Marcado como Receita para a conta de destino
        'Conciliado',
        p_conta_destino_id,
        NULL -- Categoria é nula para transferências
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mover_contato_e_atualizar_produto(p_contato_no_funil_id uuid, p_nova_coluna_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_produto_id BIGINT;
    v_nova_coluna_nome TEXT;
BEGIN
    -- 1. Atualiza a coluna do contato no funil
    UPDATE public.contatos_no_funil
    SET coluna_id = p_nova_coluna_id, updated_at = NOW()
    WHERE id = p_contato_no_funil_id
    RETURNING produto_id INTO v_produto_id;

    -- 2. Busca o nome da nova coluna
    SELECT nome INTO v_nova_coluna_nome
    FROM public.colunas_funil
    WHERE id = p_nova_coluna_id;

    -- 3. Se a nova coluna for 'Vendido' e houver um produto associado, atualiza o status do produto
    IF v_nova_coluna_nome = 'Vendido' AND v_produto_id IS NOT NULL THEN
        UPDATE public.produtos_empreendimento
        SET status = 'Vendido'
        WHERE id = v_produto_id;
    END IF;

    -- Retorna 'true' para indicar que a operação foi bem-sucedida
    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_valor_indice(p_filtro jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- Variáveis para extrair dados do JSON do filtro
    search_term text := p_filtro->>'searchTerm';
    empresa_ids_json jsonb := p_filtro->'empresaIds';
    conta_ids_json jsonb := p_filtro->'contaIds';
    categoria_ids_json jsonb := p_filtro->'categoriaIds';
    empreendimento_ids_json jsonb := p_filtro->'empreendimentoIds';
    etapa_ids_json jsonb := p_filtro->'etapaIds';
    status_json jsonb := p_filtro->'status';
    start_date text := p_filtro->>'startDate';
    end_date text := p_filtro->>'endDate';
    tipo_json jsonb := p_filtro->'tipo';

    -- Variáveis para converter JSON arrays para SQL arrays
    empresa_ids bigint[];
    conta_ids bigint[];
    categoria_ids bigint[];
    empreendimento_ids bigint[];
    etapa_ids bigint[];
    status_array text[];
    tipo_array text[];

    dynamic_query text;
    total_valor numeric;
BEGIN
    -- Converte os arrays JSON para arrays SQL, tratando valores nulos
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(empresa_ids_json)::bigint), '{}') INTO empresa_ids;
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(conta_ids_json)::bigint), '{}') INTO conta_ids;
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(categoria_ids_json)::bigint), '{}') INTO categoria_ids;
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(empreendimento_ids_json)::bigint), '{}') INTO empreendimento_ids;
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(etapa_ids_json)::bigint), '{}') INTO etapa_ids;
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(status_json)), '{}') INTO status_array;
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(tipo_json)), '{}') INTO tipo_array;

    -- Inicia a construção da query
    -- A soma agora considera que despesas são negativas e receitas positivas
    dynamic_query := 'SELECT COALESCE(SUM(CASE WHEN tipo = ''Receita'' THEN valor WHEN tipo = ''Despesa'' THEN -valor ELSE 0 END), 0) FROM public.lancamentos WHERE 1=1';

    -- Adiciona as condições do filtro à query
    IF search_term IS NOT NULL AND search_term != '' THEN
        dynamic_query := dynamic_query || ' AND descricao ILIKE ' || quote_literal('%' || search_term || '%');
    END IF;

    IF start_date IS NOT NULL AND start_date != '' THEN
        dynamic_query := dynamic_query || ' AND data_transacao >= ' || quote_literal(start_date);
    END IF;

    IF end_date IS NOT NULL AND end_date != '' THEN
        dynamic_query := dynamic_query || ' AND data_transacao <= ' || quote_literal(end_date);
    END IF;
    
    -- A verificação 'array_length > 0' previne erros com arrays vazios
    IF array_length(empresa_ids, 1) > 0 THEN
        dynamic_query := dynamic_query || ' AND empresa_id = ANY(' || quote_literal(empresa_ids) || ')';
    END IF;

    IF array_length(conta_ids, 1) > 0 THEN
        dynamic_query := dynamic_query || ' AND conta_id = ANY(' || quote_literal(conta_ids) || ')';
    END IF;

    IF array_length(categoria_ids, 1) > 0 THEN
        dynamic_query := dynamic_query || ' AND categoria_id = ANY(' || quote_literal(categoria_ids) || ')';
    END IF;

    IF array_length(empreendimento_ids, 1) > 0 THEN
        dynamic_query := dynamic_query || ' AND empreendimento_id = ANY(' || quote_literal(empreendimento_ids) || ')';
    END IF;
    
    IF array_length(tipo_array, 1) > 0 THEN
        dynamic_query := dynamic_query || ' AND tipo = ANY(' || quote_literal(tipo_array) || ')';
    END IF;

    EXECUTE dynamic_query INTO total_valor;

    RETURN ABS(total_valor); -- Retorna sempre o valor absoluto, pois a fórmula controlará o sinal
END;
$function$
;

CREATE OR REPLACE FUNCTION public.purgar_materiais_nao_utilizados()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    deleted_count integer;
BEGIN
    WITH unused_materials AS (
        SELECT id FROM public.materiais
        EXCEPT
        SELECT DISTINCT material_id FROM public.orcamento_itens WHERE material_id IS NOT NULL
    )
    DELETE FROM public.materiais
    WHERE id IN (SELECT id FROM unused_materials);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_funcionarios_com_pendencias_ponto()
 RETURNS TABLE(id bigint, full_name text)
 LANGUAGE plpgsql
AS $function$
declare
    data_inicio date;
    data_fim date;
begin
    -- Define o período como o mês atual, até o dia de ontem.
    data_inicio := date_trunc('month', current_date)::date;
    data_fim := (current_date - interval '1 day')::date;

    -- Se for o primeiro dia do mês, não há dias anteriores para verificar.
    if data_fim < data_inicio then
        return;
    end if;

    return query
    with dias_uteis as (
        -- Gera todos os dias do período a ser verificado
        select generate_series(data_inicio, data_fim, '1 day'::interval)::date as dia
    ),
    jornadas_dias as (
        -- Mapeia cada funcionário para seus dias de trabalho na semana
        select
            f.id as funcionario_id,
            jd.dia_semana
        from
            public.funcionarios f
            join public.jornadas j on f.jornada_id = j.id
            join public.jornada_detalhes jd on j.id = jd.jornada_id
        where
            f.status = 'Ativo'
            and (jd.horario_entrada is not null and jd.horario_saida is not null)
    ),
    dias_a_trabalhar as (
        -- Filtra os dias úteis para cada funcionário com base na sua jornada
        select
            jd.funcionario_id,
            du.dia
        from
            dias_uteis du
            join jornadas_dias jd on extract(isodow from du.dia) = jd.dia_semana
    ),
    pontos_do_dia as (
        -- Agrupa as marcações de ponto por funcionário e dia
        select
            p.funcionario_id,
            p.data_hora::date as dia,
            count(case when p.tipo_registro = 'Entrada' then 1 end) > 0 as tem_entrada,
            count(case when p.tipo_registro = 'Saida' then 1 end) > 0 as tem_saida,
            count(case when p.tipo_registro = 'Inicio_Intervalo' then 1 end) > 0 as tem_inicio_intervalo,
            count(case when p.tipo_registro = 'Fim_Intervalo' then 1 end) > 0 as tem_fim_intervalo
        from
            public.pontos p
        where
            p.data_hora::date between data_inicio and data_fim
        group by
            p.funcionario_id, p.data_hora::date
    ),
    abonos_do_dia as (
        select funcionario_id, data_abono from public.abonos where data_abono between data_inicio and data_fim
    )
    -- Seleciona os funcionários que têm dias a trabalhar sem as marcações completas e sem abono
    select distinct
        f.id,
        f.full_name
    from
        dias_a_trabalhar dat
        join public.funcionarios f on dat.funcionario_id = f.id
        left join pontos_do_dia pd on dat.funcionario_id = pd.funcionario_id and dat.dia = pd.dia
        left join abonos_do_dia ad on dat.funcionario_id = ad.funcionario_id and dat.dia = ad.data_abono
    where
        ad.data_abono is null -- Ignora dias com abono
        and (
            pd.dia is null -- Não bateu ponto no dia
            or pd.tem_entrada = false
            or pd.tem_saida = false
            or pd.tem_inicio_intervalo = false
            or pd.tem_fim_intervalo = false
        )
    order by
        f.full_name;

end;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_kpi(p_kpi_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    kpi_formula text;
    kpi_nome text;
    indice_record record;
    indice_valor numeric;
BEGIN
    -- Busca a fórmula do KPI
    SELECT formula, nome_kpi INTO kpi_formula, kpi_nome
    FROM public.kpis_financeiros
    WHERE id = p_kpi_id;

    IF kpi_formula IS NULL THEN
        RAISE EXCEPTION 'KPI com ID % não encontrado.', p_kpi_id;
    END IF;

    -- Loop para substituir cada [NOME_INDICE] pelo seu valor calculado
    FOR indice_record IN SELECT id, nome_indice FROM public.indices_financeiros
    LOOP
        -- Verifica se o índice atual está na fórmula
        IF position(('[' || indice_record.nome_indice || ']') IN kpi_formula) > 0 THEN
            -- Calcula o valor do índice chamando a outra função
            SELECT calcular_valor_indice(indice_record.id) INTO indice_valor;
            
            -- Substitui o placeholder pelo valor numérico
            kpi_formula := replace(kpi_formula, '[' || indice_record.nome_indice || ']', COALESCE(indice_valor, 0)::text);
        END IF;
    END LOOP;
    
    -- Validação final para garantir que não há mais placeholders
    IF kpi_formula ~ '\[[A-Z_]+\]' THEN
        RAISE EXCEPTION 'Fórmula para o KPI "%" ainda contém índices não resolvidos: %', kpi_nome, kpi_formula;
    END IF;

    -- Avalia a expressão matemática de forma segura com plv8
    BEGIN
        RETURN plv8.eval(kpi_formula);
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Erro ao avaliar a fórmula para o KPI "%": %. Fórmula resultante: %', kpi_nome, SQLERRM, kpi_formula;
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dias_ferias_gozados_ano(p_funcionario_id bigint, p_ano integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_dias integer;
BEGIN
    SELECT COUNT(a.id)
    INTO total_dias
    FROM public.abonos a
    JOIN public.abono_tipos at ON a.tipo_abono_id = at.id
    WHERE a.funcionario_id = p_funcionario_id
      AND at.descricao = 'Férias'
      AND EXTRACT(YEAR FROM a.data_abono) = p_ano;

    RETURN COALESCE(total_dias, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_contact_by_phone(p_phone_number text)
 RETURNS TABLE(found_contact_id bigint, found_empresa_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_sanitized_phone TEXT;
    v_contact_id BIGINT;
    v_empresa_id BIGINT;
BEGIN
    -- Remove todos os caracteres não numéricos do telefone recebido
    v_sanitized_phone := regexp_replace(p_phone_number, '\D', '', 'g');

    -- Tenta encontrar o contato pelo número de telefone já limpo na tabela 'telefones'
    SELECT t.contato_id, c.empresa_id INTO v_contact_id, v_empresa_id
    FROM public.telefones t
    JOIN public.contatos c ON t.contato_id = c.id
    WHERE t.telefone = v_sanitized_phone
    LIMIT 1;

    -- Se um contato for encontrado, retorna seus IDs
    IF v_contact_id IS NOT NULL THEN
        RETURN QUERY SELECT v_contact_id, v_empresa_id;
        RETURN;
    END IF;

    -- Se NENHUM contato for encontrado, cria um novo
    -- 1. Cria o registro na tabela 'contatos'
    INSERT INTO public.contatos (nome, tipo_contato, personalidade_juridica)
    VALUES ('Contato ' || v_sanitized_phone, 'Contato', 'Pessoa Física')
    RETURNING id INTO v_contact_id;

    -- 2. Cria o registro do telefone associado a este novo contato
    INSERT INTO public.telefones (contato_id, telefone)
    VALUES (v_contact_id, v_sanitized_phone);

    -- 3. Retorna o ID do contato recém-criado
    RETURN QUERY SELECT v_contact_id, NULL::BIGINT;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.reajustar_valor_base_produtos(p_empreendimento_id bigint, p_percentual_reajuste numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE public.produtos_empreendimento
    SET
        -- Aplica o reajuste ao valor_base existente
        valor_base = valor_base * (1 + (p_percentual_reajuste / 100)),
        -- Recalcula o valor de venda com base no NOVO valor_base
        valor_venda_calculado = (valor_base * (1 + (p_percentual_reajuste / 100))) * (1 + (COALESCE(fator_reajuste_percentual, 0) / 100))
    WHERE
        empreendimento_id = p_empreendimento_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_pedido(p_pedido_id bigint, p_conta_id bigint, p_data_pagamento date)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_valor_total NUMERIC;
    v_empreendimento_id BIGINT;
    v_descricao TEXT;
    v_categoria_id BIGINT;
BEGIN
    -- 1. Calcula o valor total do pedido a partir dos seus itens
    SELECT SUM(COALESCE(custo_total_real, 0))
    INTO v_valor_total
    FROM public.pedidos_compra_itens
    WHERE pedido_compra_id = p_pedido_id;

    -- Se não houver valor, interrompe a função
    IF v_valor_total IS NULL OR v_valor_total <= 0 THEN
        RETURN 'Erro: O pedido não possui itens com valor para registrar o pagamento.';
    END IF;

    -- 2. Busca o ID do empreendimento e cria a descrição
    SELECT empreendimento_id, 'Pagamento referente ao Pedido de Compra #' || p_pedido_id
    INTO v_empreendimento_id, v_descricao
    FROM public.pedidos_compra
    WHERE id = p_pedido_id;

    -- 3. Encontra ou cria a categoria "Material de Construção"
    SELECT id INTO v_categoria_id FROM public.categorias_financeiras WHERE nome = 'Material de Construção';
    IF v_categoria_id IS NULL THEN
        INSERT INTO public.categorias_financeiras (nome, tipo)
        VALUES ('Material de Construção', 'Despesa')
        RETURNING id INTO v_categoria_id;
    END IF;

    -- 4. Insere o novo lançamento de despesa
    INSERT INTO public.lancamentos (
        descricao,
        valor,
        data_transacao,
        tipo,
        status,
        conta_id,
        categoria_id,
        empreendimento_id,
        pedido_compra_id
    ) VALUES (
        v_descricao,
        v_valor_total,
        p_data_pagamento,
        'Despesa',
        'Conciliado', -- Pagamento já é considerado conciliado
        p_conta_id,
        v_categoria_id,
        v_empreendimento_id,
        p_pedido_id
    );

    RETURN 'Pagamento do pedido #' || p_pedido_id || ' registrado com sucesso no financeiro!';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_documento_empreendimento(query_embedding vector, match_threshold double precision, match_count integer, p_empreendimento_id bigint)
 RETURNS TABLE(id uuid, content text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ede.id,
    ede.content,
    1 - (ede.embedding <=> query_embedding) as similarity
  FROM
    empreendimento_documento_embeddings AS ede
  JOIN
    empreendimento_anexos AS ea ON ede.anexo_id = ea.id
  WHERE
    ea.empreendimento_id = p_empreendimento_id
    AND ea.usar_para_pesquisa = TRUE  -- AQUI ESTÁ A NOVA REGRA!
    AND 1 - (ede.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_duplicate_contatos()
 RETURNS TABLE(duplicate_type text, duplicate_key text, contato_details json)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH potential_duplicates AS (
        -- Duplicatas por CPF
        SELECT 'CPF' as type, cpf as key, id FROM contatos WHERE cpf IS NOT NULL AND cpf <> ''
        UNION ALL
        -- Duplicatas por CNPJ
        SELECT 'CNPJ' as type, cnpj as key, id FROM contatos WHERE cnpj IS NOT NULL AND cnpj <> ''
        UNION ALL
        -- Duplicatas por Nome
        SELECT 'Nome' as type, nome as key, id FROM contatos WHERE nome IS NOT NULL AND nome <> ''
    ),
    grouped_duplicates AS (
        SELECT key, type, array_agg(id) as ids
        FROM potential_duplicates
        GROUP BY key, type
        HAVING count(id) > 1
    )
    SELECT
        gd.type,
        gd.key,
        json_build_object(
            'id', c.id,
            'nome', c.nome,
            'tipo_contato', c.tipo_contato,
            'cpf', c.cpf,
            'cnpj', c.cnpj,
            'telefones', (SELECT json_agg(t.telefone) FROM telefones t WHERE t.contato_id = c.id),
            'emails', (SELECT json_agg(e.email) FROM emails e WHERE e.contato_id = c.id)
        )
    FROM grouped_duplicates gd
    JOIN contatos c ON c.id = ANY(gd.ids)
    ORDER BY gd.key, c.nome;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_status_pedido(p_pedido_id bigint, p_novo_status text, p_usuario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_status_anterior text;
BEGIN
    -- Busca o status atual (que será o anterior)
    SELECT status INTO v_status_anterior
    FROM public.pedidos_compra
    WHERE id = p_pedido_id;

    -- Se o status não mudou, não faz nada
    IF v_status_anterior IS NOT DISTINCT FROM p_novo_status THEN
        RETURN;
    END IF;

    -- Atualiza o status na tabela principal de pedidos
    UPDATE public.pedidos_compra
    SET status = p_novo_status
    WHERE id = p_pedido_id;

    -- Insere o registro na tabela de histórico
    INSERT INTO public.pedidos_compra_status_historico
        (pedido_compra_id, status_anterior, status_novo, alterado_por_usuario_id)
    VALUES
        (p_pedido_id, v_status_anterior, p_novo_status, p_usuario_id);

END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_valor_indice(p_indice_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    filtro jsonb;
    query_sql text;
    total_valor numeric;
BEGIN
    -- 1. Busca a configuração do filtro para o índice fornecido
    SELECT configuracao_filtro INTO filtro
    FROM public.indices_financeiros
    WHERE id = p_indice_id;

    -- Se não encontrar o filtro, retorna 0
    IF filtro IS NULL THEN
        RAISE NOTICE 'Índice com ID % não encontrado.', p_indice_id;
        RETURN 0;
    END IF;

    -- 2. Constrói a consulta SQL baseada nos filtros
    -- CORREÇÃO PRINCIPAL: Agora faz um SUM simples do valor, sem torná-lo negativo.
    query_sql := 'SELECT COALESCE(SUM(valor), 0) FROM public.lancamentos WHERE 1=1';

    -- Adiciona as condições (cláusulas WHERE) dinamicamente
    IF filtro->>'searchTerm' IS NOT NULL AND filtro->>'searchTerm' != '' THEN
        query_sql := query_sql || ' AND descricao ILIKE ''%' || filtro->>'searchTerm' || '%''';
    END IF;

    IF jsonb_array_length(filtro->'contaIds') > 0 THEN
        query_sql := query_sql || ' AND conta_id = ANY(ARRAY[' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(filtro->'contaIds')), ',') || '])';
    END IF;

    IF jsonb_array_length(filtro->'categoriaIds') > 0 THEN
        query_sql := query_sql || ' AND categoria_id = ANY(ARRAY[' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(filtro->'categoriaIds')), ',') || '])';
    END IF;
    
    -- CORREÇÃO: Adiciona o filtro por "tipo" (Receita/Despesa) se ele existir no JSON.
    IF jsonb_array_length(filtro->'tipo') > 0 THEN
        query_sql := query_sql || ' AND tipo = ANY(ARRAY[' || array_to_string(ARRAY(SELECT '''''' || value || '''''' FROM jsonb_array_elements_text(filtro->'tipo')), ',') || '])';
    END IF;

    IF filtro->>'startDate' IS NOT NULL AND filtro->>'startDate' != '' THEN
        query_sql := query_sql || ' AND data_transacao >= ''' || (filtro->>'startDate') || '''';
    END IF;
    
    IF filtro->>'endDate' IS NOT NULL AND filtro->>'endDate' != '' THEN
        query_sql := query_sql || ' AND data_transacao <= ''' || (filtro->>'endDate') || '''';
    END IF;

    -- Adiciona mais filtros conforme necessário (empresa, empreendimento, etc.)

    -- 3. Executa a consulta e armazena o resultado
    RAISE NOTICE 'Executando SQL para Índice: %', query_sql;
    EXECUTE query_sql INTO total_valor;

    -- 4. Retorna o valor calculado
    RETURN total_valor;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.link_funcionario_e_contato(p_funcionario_id bigint)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_contato_id bigint;
    v_funcionario_cpf text;
BEGIN
    -- 1. Pega o CPF do funcionário.
    SELECT cpf INTO v_funcionario_cpf FROM public.funcionarios WHERE id = p_funcionario_id;

    IF v_funcionario_cpf IS NULL THEN
        RETURN 'Erro: Funcionário não possui CPF para realizar a busca.';
    END IF;

    -- 2. Encontra o ID do contato que possui o mesmo CPF.
    SELECT id INTO v_contato_id FROM public.contatos WHERE cpf = v_funcionario_cpf LIMIT 1;

    -- 3. Se encontrou um contato, atualiza o funcionário com o ID do contato.
    IF v_contato_id IS NOT NULL THEN
        UPDATE public.funcionarios
        SET contato_id = v_contato_id
        WHERE id = p_funcionario_id;
        
        RETURN 'Sucesso: Funcionário ID ' || p_funcionario_id || ' foi vinculado ao Contato ID ' || v_contato_id;
    ELSE
        RETURN 'Aviso: Nenhum contato encontrado com o CPF ' || v_funcionario_cpf;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_valor_kpi(p_formula text)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- Esta função agora recebe a FÓRMULA como texto, não mais o ID do KPI.
    indice_name text;
    indice_filtro jsonb;
    indice_valor numeric;
    final_expression text := p_formula;
BEGIN
    -- Se a fórmula estiver vazia ou for nula, retorna 0.
    IF final_expression IS NULL OR final_expression = '' THEN
        RETURN 0;
    END IF;

    -- Usa uma expressão regular para encontrar todos os nomes de índices (ex: [NOME_INDICE])
    FOR indice_name IN SELECT (regexp_matches(final_expression, '\[([a-zA-Z0-9_]+)\]', 'g'))[1]
    LOOP
        -- Para cada nome encontrado, busca o filtro correspondente na tabela de índices
        SELECT configuracao_filtro INTO indice_filtro 
        FROM public.indices_financeiros 
        WHERE nome_indice = indice_name;

        -- Se encontrou o filtro, chama a função auxiliar para calcular o valor daquele índice
        IF indice_filtro IS NOT NULL THEN
            SELECT calcular_valor_indice(indice_filtro) INTO indice_valor;
            -- Substitui o nome do índice (ex: [CUSTO_TOTAL]) pelo seu valor numérico na fórmula
            final_expression := replace(final_expression, '[' || indice_name || ']', COALESCE(indice_valor, 0)::text);
        ELSE
            -- Se um índice na fórmula não for encontrado na tabela, substitui por 0 para evitar erros.
            final_expression := replace(final_expression, '[' || indice_name || ']', '0');
        END IF;
    END LOOP;

    -- Tenta executar a expressão matemática final (ex: (1000-500)/1000)
    -- Se der um erro (como divisão por zero), o bloco EXCEPTION captura e retorna 0.
    BEGIN
        EXECUTE 'SELECT ' || final_expression INTO indice_valor;
    EXCEPTION 
        WHEN division_by_zero THEN
            RETURN 0;
        WHEN others THEN
            RETURN NULL; -- Retorna NULL para outros tipos de erro de sintaxe na fórmula
    END;

    RETURN indice_valor;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reordenar_orcamento_itens(itens_para_atualizar jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_data jsonb;
BEGIN
    FOR item_data IN SELECT * FROM jsonb_array_elements(itens_para_atualizar)
    LOOP
        UPDATE public.orcamento_itens
        SET ordem = (item_data->>'ordem')::integer
        WHERE id = (item_data->>'id')::bigint;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_primeiro_funil_id()
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    funil_id UUID;
BEGIN
    SELECT id INTO funil_id FROM funis ORDER BY created_at LIMIT 1;
    RETURN funil_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_org_id bigint;
  v_nome text;
  v_funcao_id bigint;
BEGIN
  -- 1. Recupera os dados dos metadados (enviados pelo Auth do Supabase)
  v_org_id := (new.raw_user_meta_data->>'organizacao_id')::bigint;
  v_nome := COALESCE(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', 'Novo Usuário');
  
  -- 2. Define a função (Se for id 20 é corretor, se não, assume 1 que é o padrão/dono)
  v_funcao_id := COALESCE((new.raw_user_meta_data->>'funcao_id')::bigint, 1);

  -- 3. Inserção Blindada na tabela public.usuarios
  INSERT INTO public.usuarios (id, email, nome, organizacao_id, funcao_id, created_at)
  VALUES (
    new.id, 
    new.email, 
    v_nome, 
    v_org_id,
    v_funcao_id,
    now()
  );

  -- 4. Se for Corretor (ID 20), cria também o registro na tabela contatos
  IF v_funcao_id = 20 THEN
    INSERT INTO public.contatos (criado_por_usuario_id, nome, tipo_contato, organizacao_id)
    VALUES (new.id, v_nome, 'Corretor', 2); -- 2 é o ID da Studio 57
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Se der qualquer erro, o Supabase loga, mas não trava o cadastro do Auth
  RAISE WARNING 'Erro no gatilho handle_new_user: %', SQLERRM;
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.garantir_nome_material()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Só agimos se o NOME estiver VAZIO ou NULO
    IF NEW.nome IS NULL OR TRIM(NEW.nome) = '' THEN
        
        -- Tentamos usar a descrição como nome
        IF NEW.descricao IS NOT NULL AND TRIM(NEW.descricao) <> '' THEN
            NEW.nome := NEW.descricao;
        ELSE
            -- Se até a descrição estiver vazia, colocamos um aviso padrão
            NEW.nome := 'Material Sem Nome (Auto)';
        END IF;

    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_last_messages_for_contacts()
 RETURNS TABLE(contato_id bigint, content text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH ranked_messages AS (
        SELECT
            wm.contato_id,
            wm.content,
            wm.sent_at,
            ROW_NUMBER() OVER(PARTITION BY wm.contato_id ORDER BY wm.sent_at DESC) as rn
        FROM
            public.whatsapp_messages AS wm
    )
    SELECT
        rm.contato_id,
        rm.content,
        rm.sent_at
    FROM
        ranked_messages AS rm
    WHERE
        rm.rn = 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contact_id_by_phone(p_phone_number text)
 RETURNS TABLE(found_contact_id bigint, found_empresa_id bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_cleaned_phone TEXT;
    v_possible_phones TEXT[];
BEGIN
    -- 1. Limpa o número, removendo tudo o que não for dígito
    v_cleaned_phone := regexp_replace(p_phone_number, '\D', '', 'g');

    -- 2. Gera as possíveis variações do número de telemóvel brasileiro
    -- Formato com 13 dígitos (Ex: 5533999998888) -> cria a variação sem o 9
    IF LENGTH(v_cleaned_phone) = 13 AND v_cleaned_phone LIKE '55__9%' THEN
        v_possible_phones := ARRAY[
            v_cleaned_phone,
            '55' || SUBSTRING(v_cleaned_phone, 3, 2) || SUBSTRING(v_cleaned_phone, 6)
        ];
    -- Formato com 12 dígitos (Ex: 553332715757, mas que seja telemóvel) -> cria a variação com o 9
    ELSIF LENGTH(v_cleaned_phone) = 12 AND v_cleaned_phone LIKE '55__%' THEN
        v_possible_phones := ARRAY[
            v_cleaned_phone,
            '55' || SUBSTRING(v_cleaned_phone, 3, 2) || '9' || SUBSTRING(v_cleaned_phone, 5)
        ];
    ELSE
        -- Para todos os outros casos (números fixos, internacionais), usa apenas o número limpo
        v_possible_phones := ARRAY[v_cleaned_phone];
    END IF;

    -- 3. Busca na tabela de telefones usando as variações possíveis
    RETURN QUERY
    SELECT
        t.contato_id,
        c.empresa_id
    FROM public.telefones AS t
    JOIN public.contatos AS c ON t.contato_id = c.id
    WHERE regexp_replace(t.telefone, '\D', '', 'g') = ANY(v_possible_phones)
    ORDER BY LENGTH(regexp_replace(t.telefone, '\D', '', 'g')) DESC
    LIMIT 1;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.email_confirmed_at = now(); -- Define a data de confirmação como "agora"
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_pedido_com_atividade()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_activity_id bigint;
    v_empreendimento_id bigint;
    v_empresa_id bigint;
BEGIN
    -- Se a data de entrega não foi definida, não faz nada
    IF NEW.data_entrega_prevista IS NULL THEN
        -- Opcional: deletar a atividade se a data for removida
        DELETE FROM public.activities WHERE tipo_atividade = 'Entrega de Pedido' AND nome = 'Entrega Pedido #' || NEW.id;
        RETURN NEW;
    END IF;

    -- Busca o ID da empresa e do empreendimento
    SELECT empreendimento_id INTO v_empreendimento_id FROM public.pedidos_compra WHERE id = NEW.id;
    SELECT empresa_proprietaria_id INTO v_empresa_id FROM public.empreendimentos WHERE id = v_empreendimento_id;

    -- Verifica se já existe uma atividade para este pedido
    SELECT id INTO v_activity_id FROM public.activities 
    WHERE tipo_atividade = 'Entrega de Pedido' AND nome = 'Entrega Pedido #' || NEW.id;

    -- Se já existe, atualiza a data
    IF v_activity_id IS NOT NULL THEN
        UPDATE public.activities
        SET 
            data_inicio_prevista = NEW.data_entrega_prevista,
            data_fim_prevista = NEW.data_entrega_prevista
        WHERE id = v_activity_id;
    ELSE
        -- Se não existe, cria uma nova atividade
        INSERT INTO public.activities 
            (nome, tipo_atividade, empreendimento_id, empresa_id, data_inicio_prevista, data_fim_prevista, duracao_dias, status, criado_por_usuario_id)
        VALUES 
            ('Entrega Pedido #' || NEW.id, 'Entrega de Pedido', v_empreendimento_id, v_empresa_id, NEW.data_entrega_prevista, NEW.data_entrega_prevista, 1, 'Não Iniciado', auth.uid());
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_corporate_entities()
 RETURNS TABLE(id bigint, display_name text, cnpj text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        -- Prioriza nome_fantasia, depois razao_social, depois nome (se cnpj existir)
        COALESCE(c.nome_fantasia, c.razao_social, c.nome) as display_name,
        c.cnpj
    FROM
        public.contatos c
    WHERE
        c.cnpj IS NOT NULL; -- Apenas contatos que se comportam como PJ
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_materiais(search_term text)
 RETURNS TABLE(id bigint, descricao text, unidade_medida text, preco_unitario numeric, categoria text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.descricao,
        m.unidade_medida,
        m.preco_unitario,
        m.Grupo AS categoria
    FROM
        public.materiais m
    WHERE
        -- Busca case-insensitive, sem a camada de acentuação
        m.descricao ILIKE '%' || search_term || '%'
    LIMIT 10;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_saldo_banco_horas_ate_mes_anterior(p_funcionario_id bigint, p_mes_referencia text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_data_inicio_mes date;
    v_total_minutos_saldo integer;
    v_total_minutos_ajustes integer;
BEGIN
    -- Converte a string 'AAAA-MM' para o primeiro dia do mês.
    v_data_inicio_mes := (p_mes_referencia || '-01')::date;

    -- 1. Calcula o saldo do banco de horas de todos os meses ANTERIORES usando a VIEW.
    -- Esta consulta agora soma os saldos diários pré-calculados.
    SELECT COALESCE(SUM(saldo_minutos_dia), 0)::integer
    INTO v_total_minutos_saldo
    FROM public.saldos_diarios_ponto
    WHERE funcionario_id = p_funcionario_id
      AND data < v_data_inicio_mes;
      
    -- 2. Soma todos os ajustes manuais feitos ATÉ o final do mês anterior.
    SELECT COALESCE(SUM(minutos_ajustados), 0)
    INTO v_total_minutos_ajustes
    FROM public.ajustes_banco_horas
    WHERE funcionario_id = p_funcionario_id
      AND data_ajuste < v_data_inicio_mes;

    -- 3. Retorna o saldo total (horas calculadas + ajustes manuais)
    RETURN v_total_minutos_saldo + v_total_minutos_ajustes;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_tipo_contato_options()
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Retorna a lista de valores do ENUM como um array de texto
  RETURN enum_range(NULL::public.tipo_contato_enum)::text[];
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aplicar_cub_e_retornar_produtos(p_empreendimento_id bigint, p_novo_valor_cub numeric)
 RETURNS SETOF produtos_empreendimento
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Etapa 1: Salva ou atualiza o valor do CUB nas configurações do empreendimento.
    INSERT INTO public.configuracoes_venda (empreendimento_id, valor_cub)
    VALUES (p_empreendimento_id, p_novo_valor_cub)
    ON CONFLICT (empreendimento_id)
    DO UPDATE SET valor_cub = p_novo_valor_cub;

    -- Etapa 2: Atualiza todos os produtos do empreendimento, calculando o novo preço base.
    UPDATE public.produtos_empreendimento
    SET
        -- AQUI ESTÁ A LÓGICA CORRETA: valor_base = área * CUB
        valor_base = area_m2 * p_novo_valor_cub,
        -- O valor de venda também é recalculado na mesma operação.
        valor_venda_calculado = (area_m2 * p_novo_valor_cub) * (1 + (COALESCE(fator_reajuste_percentual, 0) / 100.0))
    WHERE
        empreendimento_id = p_empreendimento_id;
        
    -- Etapa 3: Retorna a lista de produtos já com os valores atualizados.
    RETURN QUERY
    SELECT *
    FROM public.produtos_empreendimento
    WHERE empreendimento_id = p_empreendimento_id
    ORDER BY unidade;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_fornecedores(search_term text)
 RETURNS TABLE(id bigint, nome_exibicao text, detalhe text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    SELECT
        c.id,
        COALESCE(c.razao_social, c.nome) AS nome_exibicao,
        COALESCE(c.nome_fantasia, c.cnpj, c.cpf) AS detalhe
    FROM
        public.contatos c
    WHERE
        search_term IS NULL OR search_term = ''
        OR unaccent(c.nome) ILIKE unaccent('%' || search_term || '%')
        OR unaccent(c.razao_social) ILIKE unaccent('%' || search_term || '%')
        OR unaccent(c.nome_fantasia) ILIKE unaccent('%' || search_term || '%')
    LIMIT 20;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_pedido_entregue(p_pedido_id bigint, p_usuario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Chama a função que já criamos para registrar o histórico
    -- e atualizar o status do pedido para 'Entregue'.
    PERFORM public.atualizar_status_pedido(p_pedido_id, 'Entregue', p_usuario_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.excluir_contrato_e_liberar_unidade(p_contrato_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_produto_id BIGINT;
BEGIN
    -- 1. Encontra o ID do produto associado ao contrato que será excluído.
    SELECT produto_id INTO v_produto_id
    FROM public.contratos
    WHERE id = p_contrato_id;

    -- 2. Se encontrou um produto, atualiza seu status para 'Disponível'.
    IF v_produto_id IS NOT NULL THEN
        UPDATE public.produtos_empreendimento
        SET status = 'Disponível'
        WHERE id = v_produto_id;
    END IF;

    -- 3. Exclui o contrato.
    DELETE FROM public.contratos
    WHERE id = p_contrato_id;

    -- 4. Retorna uma mensagem de sucesso.
    RETURN 'Contrato excluído e unidade liberada com sucesso.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_whatsapp_conversations()
 RETURNS TABLE(contato_id bigint, nome_contato text, ultima_mensagem_conteudo text, ultima_mensagem_em timestamp with time zone, nao_lidas bigint, foto_url text, numero_telefone text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT
            wm.contato_id,
            wm.content,
            wm.sent_at,
            wm.direction,
            c.nome AS nome_contato,
            c.foto_url,
            ROW_NUMBER() OVER(PARTITION BY wm.contato_id ORDER BY wm.sent_at DESC) as rn
        FROM
            public.whatsapp_messages wm
        JOIN
            public.contatos c ON wm.contato_id = c.id
    ),
    unread_counts AS (
        SELECT
            wm.contato_id,
            COUNT(*) as unread_count
        FROM
            public.whatsapp_messages wm
        WHERE
            wm.status = 'received' AND wm.direction = 'incoming'
        GROUP BY
            wm.contato_id
    ),
    contact_phones AS (
        SELECT
            t.contato_id,
            (SELECT tel.telefone FROM public.telefones tel WHERE tel.contato_id = t.contato_id LIMIT 1) as numero_telefone
        FROM
            public.telefones t
        GROUP BY t.contato_id
    )
    SELECT
        lm.contato_id,
        lm.nome_contato,
        lm.content AS ultima_mensagem_conteudo,
        lm.sent_at AS ultima_mensagem_em,
        COALESCE(uc.unread_count, 0) AS nao_lidas,
        lm.foto_url,
        cp.numero_telefone
    FROM
        latest_messages lm
    LEFT JOIN
        unread_counts uc ON lm.contato_id = uc.contato_id
    LEFT JOIN
        contact_phones cp ON lm.contato_id = cp.contato_id
    WHERE
        lm.rn = 1
    ORDER BY
        lm.sent_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.salvar_mensagem_whatsapp(p_contato_id bigint, p_enterprise_id bigint, p_message_id text, p_sender_id text, p_receiver_id text, p_content text, p_sent_at timestamp with time zone, p_direction text, p_status text, p_raw_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.whatsapp_messages (
    contato_id, enterprise_id, message_id, sender_id, receiver_id,
    content, sent_at, direction, status, raw_payload
  ) VALUES (
    p_contato_id, p_enterprise_id, p_message_id, p_sender_id, p_receiver_id,
    p_content, p_sent_at, p_direction, p_status, p_raw_payload
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.salvar_anexo_whatsapp(p_contato_id bigint, p_storage_path text, p_public_url text, p_file_name text, p_file_type text, p_file_size bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.whatsapp_attachments (
    contato_id, storage_path, public_url, file_name, file_type, file_size
  ) VALUES (
    p_contato_id, p_storage_path, p_public_url, p_file_name, p_file_type, p_file_size
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalcular_precos_com_cub(p_empreendimento_id bigint, p_novo_valor_cub numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Atualiza todos os produtos do empreendimento, garantindo que
    -- mesmo aqueles sem área (ou com área nula) não causem erros.
    UPDATE public.produtos_empreendimento
    SET
        -- Se a área for nula, considera como 0 para não quebrar o cálculo.
        valor_base = COALESCE(area_m2, 0) * p_novo_valor_cub,
        -- Recalcula o valor de venda com base no novo preço base.
        valor_venda_calculado = (COALESCE(area_m2, 0) * p_novo_valor_cub) * (1 + (COALESCE(fator_reajuste_percentual, 0) / 100))
    WHERE
        empreendimento_id = p_empreendimento_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.duplicar_pedido_compra(p_original_pedido_id bigint, p_novo_solicitante_id uuid)
 RETURNS SETOF pedidos_compra
 LANGUAGE plpgsql
AS $function$
DECLARE
    novo_pedido_id BIGINT;
BEGIN
    -- 1. Cria um novo pedido de compra, copiando os dados do original
    INSERT INTO public.pedidos_compra (
        empreendimento_id,
        solicitante_id,
        data_solicitacao,
        data_entrega_prevista,
        status,
        justificativa,
        titulo,
        turno_entrega
    )
    SELECT
        p.empreendimento_id,
        p_novo_solicitante_id, -- Define o novo solicitante
        NOW(), -- Define a data atual como data da solicitação
        p.data_entrega_prevista,
        'Pedido Realizado', -- Reseta o status para o inicial
        p.justificativa,
        p.titulo || ' - CÓPIA', -- Adiciona "CÓPIA" ao título
        p.turno_entrega
    FROM public.pedidos_compra p
    WHERE p.id = p_original_pedido_id
    RETURNING id INTO novo_pedido_id;

    -- 2. Copia todos os itens do pedido original para o novo pedido
    INSERT INTO public.pedidos_compra_itens (
        pedido_compra_id,
        orcamento_item_id,
        material_id,
        descricao_item,
        quantidade_solicitada,
        unidade_medida,
        fornecedor_id,
        preco_unitario_real,
        custo_total_real,
        etapa_id
    )
    SELECT
        novo_pedido_id, -- Usa o ID do novo pedido criado
        i.orcamento_item_id,
        i.material_id,
        i.descricao_item,
        i.quantidade_solicitada,
        i.unidade_medida,
        i.fornecedor_id,
        i.preco_unitario_real,
        i.custo_total_real,
        i.etapa_id
    FROM public.pedidos_compra_itens i
    WHERE i.pedido_compra_id = p_original_pedido_id;

    -- 3. Retorna o pedido completo que foi criado
    RETURN QUERY 
        SELECT * FROM public.pedidos_compra WHERE id = novo_pedido_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_whatsapp_conversation_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_phone_number TEXT;
BEGIN
    -- Obter o número de telefone associado ao contato_id da nova mensagem
    SELECT t.telefone INTO v_phone_number
    FROM public.contatos c
    JOIN public.telefones t ON c.id = t.contato_id
    WHERE c.id = NEW.contato_id
    LIMIT 1; -- Assegura que pegamos apenas um telefone, o principal se houver vários

    IF v_phone_number IS NOT NULL THEN
        -- Insere ou atualiza o 'updated_at' da conversa correspondente
        -- O GREATEST garante que 'updated_at' seja sempre a data mais recente
        INSERT INTO public.whatsapp_conversations (phone_number, updated_at)
        VALUES (v_phone_number, NEW.sent_at) -- Usando NEW.sent_at da nova mensagem
        ON CONFLICT (phone_number) DO UPDATE
        SET updated_at = GREATEST(whatsapp_conversations.updated_at, NEW.sent_at); 
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.importar_lancamentos_financeiros_com_transferencias(p_novos_lancamentos jsonb, p_empresa_id bigint, p_usuario_id uuid)
 RETURNS TABLE(import_status text, details text, original_descricao text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    lancamento jsonb;
    v_conta_origem_id bigint;
    v_conta_destino_id bigint;
    v_categoria_id bigint;
    v_favorecido_id bigint;
    v_empreendimento_id bigint;
    v_data_transacao date;
    v_valor numeric;
    v_tipo text;
    v_descricao text;
BEGIN
    -- Itera sobre cada novo registro enviado do arquivo
    FOR lancamento IN SELECT * FROM jsonb_array_elements(p_novos_lancamentos)
    LOOP
        -- Extrai os IDs (já resolvidos pelo front-end)
        v_conta_origem_id := (lancamento->>'conta_id')::bigint;
        v_conta_destino_id := (lancamento->>'conta_destino_id')::bigint;
        v_categoria_id := (lancamento->>'categoria_id')::bigint;
        v_favorecido_id := (lancamento->>'favorecido_contato_id')::bigint;
        v_empreendimento_id := (lancamento->>'empreendimento_id')::bigint;
        v_data_transacao := (lancamento->>'data_transacao')::date;
        v_valor := (lancamento->>'valor')::numeric;
        v_tipo := lancamento->>'tipo';
        v_descricao := lancamento->>'descricao';

        -- CASO 1: É UMA TRANSFERÊNCIA (quando conta_destino_id é informado)
        IF v_conta_destino_id IS NOT NULL THEN
            -- VERIFICA SE A TRANSFERÊNCIA JÁ EXISTE (a saída ou a entrada)
            IF NOT EXISTS (
                SELECT 1 FROM public.lancamentos
                WHERE tipo = 'Transferência'
                AND data_transacao = v_data_transacao
                AND valor = v_valor
                AND (
                    (conta_id = v_conta_origem_id AND conta_destino_id = v_conta_destino_id)
                    OR
                    (conta_id = v_conta_destino_id AND conta_destino_id = v_conta_origem_id)
                )
            ) THEN
                -- Se não existe, INSERE OS DOIS LANÇAMENTOS
                INSERT INTO public.lancamentos (descricao, valor, data_transacao, tipo, status, conta_id, conta_destino_id, empresa_id, criado_por_usuario_id)
                VALUES (v_descricao, v_valor, v_data_transacao, 'Transferência', 'Pago', v_conta_origem_id, v_conta_destino_id, p_empresa_id, p_usuario_id);

                import_status := 'Sucesso (Transferência)';
                details := 'Saída e Entrada criadas.';

            ELSE
                -- Se a transferência já existe, marca como ignorada
                import_status := 'Ignorado (Duplicado)';
                details := 'Transferência já registrada anteriormente.';
            END IF;

        -- CASO 2: NÃO É TRANSFERÊNCIA
        ELSE
            INSERT INTO public.lancamentos (descricao, valor, data_transacao, tipo, status, conta_id, categoria_id, favorecido_contato_id, empreendimento_id, empresa_id, criado_por_usuario_id)
            VALUES (v_descricao, v_valor, v_data_transacao, v_tipo, 'Pago', v_conta_origem_id, v_categoria_id, v_favorecido_id, v_empreendimento_id, p_empresa_id, p_usuario_id);
            
            import_status := 'Sucesso';
            details := 'Lançamento padrão importado.';
        END IF;

        original_descricao := v_descricao;
        RETURN NEXT;

    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_contatos_geral(p_search_term text)
 RETURNS TABLE(id bigint, nome text, razao_social text, nome_fantasia text, cpf text, cnpj text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.nome,
        c.razao_social,
        c.nome_fantasia,
        c.cpf,
        c.cnpj
    FROM
        public.contatos c
    WHERE
        p_search_term IS NULL OR p_search_term = '' OR
        c.nome ILIKE '%' || p_search_term || '%' OR
        c.razao_social ILIKE '%' || p_search_term || '%' OR
        c.nome_fantasia ILIKE '%' || p_search_term || '%' OR
        c.cpf ILIKE '%' || p_search_term || '%' OR
        c.cnpj ILIKE '%' || p_search_term || '%'
    LIMIT 10;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_latest_ad_snapshots(p_organizacao_id bigint)
 RETURNS SETOF meta_ads_historico
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (ad_id)
        *
    FROM
        public.meta_ads_historico
    WHERE
        organizacao_id = p_organizacao_id
    ORDER BY
        ad_id, created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sobrescrever_registros_ponto(novos_registros tipo_ponto_import[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- Variáveis para guardar os IDs dos funcionários e as datas do arquivo importado
    func_ids bigint[];
    min_data date;
    max_data date;
BEGIN
    -- 1. Pega todos os IDs de funcionários e o intervalo de datas dos novos registros
    SELECT
        array_agg(DISTINCT r.funcionario_id),
        MIN(r.data_hora::date),
        MAX(r.data_hora::date)
    INTO
        func_ids,
        min_data,
        max_data
    FROM unnest(novos_registros) AS r;

    -- 2. Se encontrou funcionários e datas, apaga os registros antigos APENAS para eles e nesse período
    IF func_ids IS NOT NULL AND min_data IS NOT NULL AND max_data IS NOT NULL THEN
        DELETE FROM public.pontos p
        WHERE
            p.funcionario_id = ANY(func_ids)
            AND p.data_hora::date >= min_data
            AND p.data_hora::date <= max_data;
    END IF;

    -- 3. Insere os novos registros que vieram do arquivo
    INSERT INTO public.pontos (funcionario_id, data_hora, tipo_registro, observacao)
    SELECT
        r.funcionario_id,
        r.data_hora,
        r.tipo_registro,
        r.observacao
    FROM
        unnest(novos_registros) AS r;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_dias_uteis(p_mes_referencia date)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_dias_uteis integer := 0;
    v_dia date;
BEGIN
    FOR v_dia IN 
        SELECT generate_series(
            date_trunc('month', p_mes_referencia), 
            date_trunc('month', p_mes_referencia) + interval '1 month' - interval '1 day',
            '1 day'
        )::date
    LOOP
        -- Conta apenas se for dia de semana (1=Seg, 5=Sex) E não for feriado
        IF extract(isodow from v_dia) < 6 AND NOT EXISTS (SELECT 1 FROM public.feriados WHERE data_feriado = v_dia) THEN
            v_dias_uteis := v_dias_uteis + 1;
        END IF;
    END LOOP;
    RETURN v_dias_uteis;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_saldo_ate_data(p_conta_id bigint, p_data_limite date)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    saldo_calculado NUMERIC;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN l.tipo = 'Receita' THEN l.valor ELSE -l.valor END), 0)
    INTO saldo_calculado
    FROM lancamentos l
    WHERE l.conta_id = p_conta_id
      AND l.data_transacao < p_data_limite;

    RETURN saldo_calculado;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_conversations_with_details()
 RETURNS TABLE(contato_id bigint, nome_contato text, foto_url text, ultima_mensagem_conteudo text, ultima_mensagem_em timestamp with time zone, nao_lidas bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Esta verificação garante que apenas usuários logados possam executar a função.
    IF auth.role() <> 'authenticated' THEN
        RAISE EXCEPTION 'Acesso não autorizado.';
    END IF;

    RETURN QUERY
    -- Este bloco de código encontra a mensagem mais recente de cada conversa.
    WITH latest_messages AS (
        SELECT
            m.contato_id,
            m.content,
            m.sent_at,
            ROW_NUMBER() OVER(PARTITION BY m.contato_id ORDER BY m.sent_at DESC) as rn
        FROM
            whatsapp_messages m
        WHERE m.contato_id IS NOT NULL
    )
    -- E aqui, juntamos a mensagem mais recente com as informações do contato.
    SELECT
        c.id as contato_id,
        c.nome as nome_contato,
        c.foto_url,
        lm.content as ultima_mensagem_conteudo,
        lm.sent_at as ultima_mensagem_em,
        -- A contagem de mensagens não lidas pode ser implementada aqui no futuro.
        0::bigint as nao_lidas
    FROM
        latest_messages lm
    JOIN
        contatos c ON lm.contato_id = c.id
    WHERE
        lm.rn = 1
    ORDER BY
        lm.sent_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_auth_user_org()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id bigint;
BEGIN
  SELECT organizacao_id INTO v_org_id FROM public.usuarios WHERE id = auth.uid();
  RETURN v_org_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_activity_start_date()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verifica se o status está sendo mudado PARA 'Em Andamento'
    -- E se a data de início real ainda não foi definida
    IF NEW.status = 'Em Andamento' AND OLD.data_inicio_real IS NULL THEN
        -- Define a data de início real como a data/hora atual
        NEW.data_inicio_real = timezone('America/Sao_Paulo', now());
    END IF;
    
    -- Retorna o registro modificado para ser salvo na tabela
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_bim_elements_chunk(p_organizacao_id bigint, p_projeto_id bigint, p_urn text, p_sync_session text, p_elementos jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. UPSERT (Inserir novos ou Atualizar existentes no Lote)
  INSERT INTO public.elementos_bim (
    organizacao_id,
    projeto_bim_id,
    external_id,
    categoria,
    familia,
    tipo,
    nivel,
    propriedades,
    urn_autodesk,
    is_active,
    atualizado_em,
    sync_session
  )
  SELECT 
    p_organizacao_id,
    p_projeto_id,
    item->>'external_id',
    item->>'categoria',
    item->>'familia',
    item->>'tipo',
    item->>'nivel',
    (item->>'propriedades')::jsonb,
    p_urn,
    true, -- Garante que itens que vieram no JSON fiquem ativos
    now(),
    p_sync_session
  FROM jsonb_array_elements(p_elementos) AS item
  ON CONFLICT (projeto_bim_id, external_id) 
  DO UPDATE SET
    categoria = EXCLUDED.categoria,
    familia = EXCLUDED.familia,
    tipo = EXCLUDED.tipo,
    nivel = EXCLUDED.nivel,
    propriedades = EXCLUDED.propriedades,
    urn_autodesk = EXCLUDED.urn_autodesk,
    is_active = true,
    atualizado_em = now(),
    sync_session = EXCLUDED.sync_session;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.provisionar_parcelas_contrato(p_contrato_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_categoria_id BIGINT;
    v_conta_id BIGINT;
    v_contrato_info RECORD;
    v_parcela_rec RECORD;
    v_novo_lancamento_id BIGINT;
    v_lancamentos_criados INT := 0;
BEGIN
    -- Etapa 1: Garante que a categoria "Vendas" exista e obtém seu ID.
    -- Se não existir, ela será criada automaticamente.
    -- ##### ALTERAÇÃO AQUI #####
    SELECT id INTO v_categoria_id FROM categorias_financeiras WHERE nome = 'Vendas' AND tipo = 'Receita';
    IF v_categoria_id IS NULL THEN
        INSERT INTO categorias_financeiras (nome, tipo) VALUES ('Vendas', 'Receita') RETURNING id INTO v_categoria_id;
    END IF;

    -- Etapa 2: Garante que a conta "Contas a Receber" exista e obtém seu ID.
    -- Se não existir, ela será criada automaticamente.
    SELECT id INTO v_conta_id FROM contas_financeiras WHERE nome = 'Contas a Receber';
    IF v_conta_id IS NULL THEN
        INSERT INTO contas_financeiras (nome, tipo, saldo_inicial) VALUES ('Contas a Receber', 'Outro', 0) RETURNING id INTO v_conta_id;
    END IF;

    -- Etapa 3: Obtém informações do contrato, cliente, empreendimento e empresa proprietária.
    -- ##### LÓGICA CONFIRMADA AQUI #####
    -- Busca os dados diretamente do contrato que está sendo provisionado.
    SELECT
        c.contato_id,
        c.empreendimento_id,
        emp.empresa_proprietaria_id,
        COALESCE(co.nome, co.razao_social) AS nome_cliente,
        c.numero_contrato
    INTO v_contrato_info
    FROM contratos c
    JOIN contatos co ON c.contato_id = co.id
    JOIN empreendimentos emp ON c.empreendimento_id = emp.id
    WHERE c.id = p_contrato_id;

    IF v_contrato_info IS NULL THEN
        RAISE EXCEPTION 'Contrato com ID % não encontrado.', p_contrato_id;
    END IF;

    -- Etapa 4: Percorre apenas as parcelas PENDENTES que ainda não foram enviadas ao financeiro.
    FOR v_parcela_rec IN
        SELECT * FROM contrato_parcelas
        WHERE contrato_id = p_contrato_id AND lancamento_id IS NULL AND status_pagamento = 'Pendente'
    LOOP
        -- Etapa 5: Insere o lançamento financeiro com os dados corretos.
        INSERT INTO lancamentos (
            descricao,
            valor,
            data_vencimento,
            data_transacao,
            tipo,
            status,
            conta_id,
            categoria_id,
            favorecido_contato_id,
            empreendimento_id, -- Preenchido a partir do contrato
            empresa_id, -- Preenchido a partir do empreendimento do contrato
            observacao
        )
        VALUES (
            'Recebimento: ' || v_parcela_rec.descricao || ' | Contrato #' || v_contrato_info.numero_contrato || ' (' || v_contrato_info.nome_cliente || ')',
            v_parcela_rec.valor_parcela,
            v_parcela_rec.data_vencimento,
            v_parcela_rec.data_vencimento,
            'Receita',
            'Pendente',
            v_conta_id,
            v_categoria_id, -- Categoria "Vendas"
            v_contrato_info.contato_id,
            v_contrato_info.empreendimento_id, -- ID do Empreendimento do contrato
            v_contrato_info.empresa_proprietaria_id, -- ID da Empresa do contrato
            'Lançamento provisionado do Contrato ID ' || p_contrato_id
        )
        RETURNING id INTO v_novo_lancamento_id;

        -- Etapa 6: Atualiza a parcela com o ID do lançamento, criando o vínculo.
        UPDATE contrato_parcelas
        SET lancamento_id = v_novo_lancamento_id
        WHERE id = v_parcela_rec.id;

        v_lancamentos_criados := v_lancamentos_criados + 1;

    END LOOP;

    -- Etapa 7: Retorna uma mensagem de sucesso com a contagem de lançamentos criados.
    RETURN v_lancamentos_criados || ' lançamento(s) foram provisionados no financeiro com sucesso!';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_activity_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Se a operação for uma ATUALIZAÇÃO (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        -- Verifica se o status mudou para 'Em andamento' e a data de início real está vazia
        IF NEW.status = 'Em andamento' AND OLD.status IS DISTINCT FROM 'Em andamento' AND NEW.data_inicio_real IS NULL THEN
            NEW.data_inicio_real := CURRENT_DATE;
        END IF;

        -- Verifica se o status mudou para 'Concluído' e a data de fim real está vazia
        IF NEW.status = 'Concluído' AND OLD.status IS DISTINCT FROM 'Concluído' AND NEW.data_fim_real IS NULL THEN
            NEW.data_fim_real := CURRENT_DATE;
        END IF;
    
    -- Se a operação for uma CRIAÇÃO (INSERT)
    ELSIF (TG_OP = 'INSERT') THEN
        -- Se a nova atividade já for criada como 'Em andamento', preenche a data de início real
        IF NEW.status = 'Em andamento' THEN
            NEW.data_inicio_real := CURRENT_DATE;
        END IF;

        -- Se a nova atividade já for criada como 'Concluído', preenche a data de fim real (e a de início, se vazia)
        IF NEW.status = 'Concluído' THEN
            IF NEW.data_inicio_real IS NULL THEN
                NEW.data_inicio_real := CURRENT_DATE;
            END IF;
            NEW.data_fim_real := CURRENT_DATE;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_bim_elements_finalize(p_projeto_id bigint, p_sync_session text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 2. SOFT DELETE (O Pulo do Gato)
  -- Se o elemento pertence a este projeto, MAS a sessão de sincronia é diferente da atual
  -- significa que ele NÃO veio em nenhum dos lotes JSON (foi excluído no Revit).
  UPDATE public.elementos_bim
  SET is_active = false
  WHERE projeto_bim_id = p_projeto_id
    AND (sync_session IS NULL OR sync_session != p_sync_session);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    role_name TEXT;
BEGIN
    SELECT f.nome_funcao INTO role_name
    FROM public.usuarios u
    JOIN public.funcoes f ON u.funcao_id = f.id
    WHERE u.id = user_id;
    RETURN role_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_bim_map_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.safe_date(p_text text)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    RETURN p_text::date;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL; -- Se der qualquer erro (ex: 2024-02-31), devolve NULL em vez de travar
END;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_contacts_and_relink_all_references(p_primary_contact_id bigint, p_secondary_contact_ids bigint[], p_final_data jsonb, p_final_telefones jsonb, p_final_emails jsonb, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    secondary_id bigint;
BEGIN
    -- 1. ATUALIZAR DADOS DO VENCEDOR (Com os dados escolhidos no Modal)
    UPDATE contatos
    SET 
        nome = COALESCE((p_final_data->>'nome'), nome),
        razao_social = COALESCE((p_final_data->>'razao_social'), razao_social),
        cpf = COALESCE((p_final_data->>'cpf'), cpf),
        cnpj = COALESCE((p_final_data->>'cnpj'), cnpj),
        rg = COALESCE((p_final_data->>'rg'), rg),
        -- CORREÇÃO AQUI: Convertendo explicitamente para o tipo ENUM correto
        tipo_contato = COALESCE((p_final_data->>'tipo_contato')::public.tipo_contato_enum, tipo_contato),
        estado_civil = COALESCE((p_final_data->>'estado_civil'), estado_civil),
        cargo = COALESCE((p_final_data->>'cargo'), cargo),
        address_street = COALESCE((p_final_data->>'address_street'), address_street),
        address_number = COALESCE((p_final_data->>'address_number'), address_number),
        address_complement = COALESCE((p_final_data->>'address_complement'), address_complement),
        neighborhood = COALESCE((p_final_data->>'neighborhood'), neighborhood),
        city = COALESCE((p_final_data->>'city'), city),
        state = COALESCE((p_final_data->>'state'), state),
        cep = COALESCE((p_final_data->>'cep'), cep)
    WHERE id = p_primary_contact_id;

    -- 2. REFAZER TELEFONES (Remove os atuais e insere a lista final limpa do Modal)
    DELETE FROM telefones WHERE contato_id = p_primary_contact_id;
    
    IF jsonb_array_length(p_final_telefones) > 0 THEN
        INSERT INTO telefones (contato_id, telefone, tipo, country_code, organizacao_id)
        SELECT 
            p_primary_contact_id, 
            t->>'telefone', 
            COALESCE(t->>'tipo', 'Celular'), 
            COALESCE(t->>'country_code', '+55'), 
            p_organizacao_id
        FROM jsonb_array_elements(p_final_telefones) as t;
    END IF;

    -- 3. REFAZER EMAILS
    DELETE FROM emails WHERE contato_id = p_primary_contact_id;
    
    IF jsonb_array_length(p_final_emails) > 0 THEN
        INSERT INTO emails (contato_id, email, tipo, organizacao_id)
        SELECT 
            p_primary_contact_id, 
            e->>'email', 
            COALESCE(e->>'tipo', 'Pessoal'), 
            p_organizacao_id
        FROM jsonb_array_elements(p_final_emails) as e;
    END IF;

    -- 4. PROCESSAR OS CONTATOS SECUNDÁRIOS (Relinkar referências com BLINDAGEM)
    FOREACH secondary_id IN ARRAY p_secondary_contact_ids LOOP
        
        -- A. BLINDAGEM: LISTAS DE WHATSAPP (Evita erro unique_contato_na_lista)
        -- Copia só o que o vencedor NÃO tem.
        INSERT INTO whatsapp_list_members (lista_id, contato_id)
        SELECT lista_id, p_primary_contact_id
        FROM whatsapp_list_members
        WHERE contato_id = secondary_id
        AND NOT EXISTS (
            SELECT 1 FROM whatsapp_list_members existing
            WHERE existing.contato_id = p_primary_contact_id
            AND existing.lista_id = whatsapp_list_members.lista_id
        );
        -- Apaga do secundário para liberar
        DELETE FROM whatsapp_list_members WHERE contato_id = secondary_id;

        -- B. BLINDAGEM: FUNIL DE VENDAS
        -- Se o vencedor já tem card, deleta o do secundário. Se não, move.
        IF EXISTS (SELECT 1 FROM contatos_no_funil WHERE contato_id = p_primary_contact_id) THEN
            DELETE FROM contatos_no_funil WHERE contato_id = secondary_id;
        ELSE
            UPDATE contatos_no_funil SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        END IF;

        -- C. MOVER O RESTO (Conversas, Mensagens, Notas, etc)
        UPDATE whatsapp_conversations SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE whatsapp_messages SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        
        BEGIN UPDATE crm_notas SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE whatsapp_attachments SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id; EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- D. TCHAU SECUNDÁRIO 👋
        DELETE FROM contatos WHERE id = secondary_id;
        -- Limpeza final de tabelas dependentes
        DELETE FROM telefones WHERE contato_id = secondary_id; 
        DELETE FROM emails WHERE contato_id = secondary_id;

    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_telefone(telefone_bruto text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  -- Retorna NULL se a entrada for nula para evitar erros
  IF telefone_bruto IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN REGEXP_REPLACE(telefone_bruto, '\D', '', 'g');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sugerir_vinculo_funcionario_contato(p_cpf text, p_nome text, p_telefone text)
 RETURNS TABLE(id bigint, nome_exibicao text, motivo text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_telefone_normalizado TEXT;
    v_nome_normalizado TEXT;
BEGIN
    v_telefone_normalizado := normalizar_telefone(p_telefone);
    v_nome_normalizado := trim(lower(p_nome));

    RETURN QUERY
    WITH possible_matches AS (
        -- Match por CPF (maior prioridade, busca exata)
        SELECT 
            c.id, 
            COALESCE(c.razao_social, c.nome) as nome_exibicao, 
            'CPF' as motivo
        FROM public.contatos c
        WHERE p_cpf IS NOT NULL AND p_cpf <> '' AND c.cpf = p_cpf

        UNION

        -- Match por Nome (agora compara sem espaços extras e sem diferenciar maiúsculas/minúsculas)
        SELECT 
            c.id, 
            COALESCE(c.razao_social, c.nome) as nome_exibicao, 
            'Nome' as motivo
        FROM public.contatos c
        WHERE v_nome_normalizado IS NOT NULL AND v_nome_normalizado <> '' 
          AND trim(lower(c.nome)) = v_nome_normalizado

        UNION

        -- Match por Telefone (agora verifica se um número contém o outro, resolvendo o problema do "55")
        SELECT 
            c.id, 
            COALESCE(c.razao_social, c.nome) as nome_exibicao, 
            'Telefone' as motivo
        FROM public.contatos c
        JOIN public.telefones t ON c.id = t.contato_id
        WHERE v_telefone_normalizado IS NOT NULL AND v_telefone_normalizado <> ''
          AND (
            normalizar_telefone(t.telefone) LIKE '%' || v_telefone_normalizado || '%' OR
            v_telefone_normalizado LIKE '%' || normalizar_telefone(t.telefone) || '%'
          )
    )
    -- Agrupa os resultados para não mostrar o mesmo contato múltiplas vezes
    SELECT 
        pm.id, 
        pm.nome_exibicao, 
        string_agg(DISTINCT pm.motivo, ', ') as motivo
    FROM possible_matches pm
    GROUP BY pm.id, pm.nome_exibicao;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.salvar_anexo_whatsapp(p_message_id bigint, p_contato_id bigint, p_enterprise_id bigint, p_storage_path text, p_public_url text, p_file_name text, p_file_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.whatsapp_attachments(message_id, contato_id, enterprise_id, storage_path, public_url, file_name, file_type)
    VALUES (p_message_id, p_contato_id, p_enterprise_id, p_storage_path, p_public_url, p_file_name, p_file_type);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_ou_atualizar_contracheque(p_funcionario_id bigint, p_mes_referencia text)
 RETURNS SETOF contracheques
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_mes_date date := to_date(p_mes_referencia || '-01', 'YYYY-MM-DD');
    v_funcionario record;
    v_ponto_resumo record;
    v_salario_bruto numeric;
    v_bonus numeric;
    v_faixa_inss numeric;
    v_desconto_inss numeric;
    v_base_fgts numeric;
    v_valor_fgts numeric;
    v_base_irrf numeric;
    v_contracheque_id bigint;
    v_daily_value_numeric numeric;
    v_base_salary_numeric numeric;
    v_total_salary_numeric numeric;
    -- NOVAS VARIÁVEIS PARA CUSTOS DA EMPRESA
    v_custo_inss_patronal numeric;
    v_custo_rat numeric;
    v_custo_terceiros numeric;
BEGIN
    -- 1. Buscar dados do funcionário
    SELECT id, daily_value, base_salary, total_salary, jornada_id
    INTO v_funcionario
    FROM public.funcionarios
    WHERE id = p_funcionario_id;

    IF v_funcionario IS NULL THEN
        RAISE EXCEPTION 'Funcionário com ID % não encontrado', p_funcionario_id;
    END IF;

    -- Converte os campos de texto para numérico de forma segura
    v_daily_value_numeric := COALESCE(NULLIF(REPLACE(REPLACE(TRIM(REPLACE(v_funcionario.daily_value, 'R$', '')), '.', ''), ',', '.'), '')::numeric, 0);
    v_base_salary_numeric := COALESCE(NULLIF(REPLACE(REPLACE(TRIM(REPLACE(v_funcionario.base_salary, 'R$', '')), '.', ''), ',', '.'), '')::numeric, 0);
    v_total_salary_numeric := COALESCE(NULLIF(REPLACE(REPLACE(TRIM(REPLACE(v_funcionario.total_salary, 'R$', '')), '.', ''), ',', '.'), '')::numeric, 0);

    -- 2. Chamar a função de ponto para obter dias trabalhados
    SELECT dias_trabalhados INTO v_ponto_resumo
    FROM calcular_resumo_ponto_mensal(p_funcionario_id, p_mes_referencia);

    -- 3. Calcular valores base do funcionário
    v_salario_bruto := v_base_salary_numeric + GREATEST(0, (v_ponto_resumo.dias_trabalhados * v_daily_value_numeric) - v_base_salary_numeric);
    v_bonus := GREATEST(0, v_salario_bruto - v_base_salary_numeric);

    -- 4. Calcular INSS do funcionário sobre o SALÁRIO BASE
    SELECT
        CASE
            WHEN v_base_salary_numeric <= 1518.00 THEN 7.5 WHEN v_base_salary_numeric <= 2793.88 THEN 9.0
            WHEN v_base_salary_numeric <= 4190.83 THEN 12.0 WHEN v_base_salary_numeric <= 8157.41 THEN 14.0
            ELSE 14.0
        END,
        CASE
            WHEN v_base_salary_numeric <= 1518.00 THEN v_base_salary_numeric * 0.075
            WHEN v_base_salary_numeric <= 2793.88 THEN v_base_salary_numeric * 0.09
            WHEN v_base_salary_numeric <= 4190.83 THEN v_base_salary_numeric * 0.12
            WHEN v_base_salary_numeric <= 8157.41 THEN v_base_salary_numeric * 0.14
            ELSE 8157.41 * 0.14
        END
    INTO v_faixa_inss, v_desconto_inss;

    -- 5. Calcular FGTS e Base IRRF sobre o SALÁRIO BASE
    v_base_fgts := v_base_salary_numeric;
    v_valor_fgts := v_base_fgts * 0.08;
    v_base_irrf := v_base_salary_numeric - v_desconto_inss;

    -- ***** INÍCIO DA NOVA LÓGICA *****
    -- 6. Calcular CUSTOS DA EMPRESA sobre o SALÁRIO BASE
    v_custo_inss_patronal := v_base_salary_numeric * 0.20;
    v_custo_rat := v_base_salary_numeric * 0.03;
    v_custo_terceiros := v_base_salary_numeric * 0.058;
    -- ***** FIM DA NOVA LÓGICA *****

    -- 7. Inserir ou atualizar o registro do contracheque com TODOS os dados
    INSERT INTO public.contracheques (
        funcionario_id, mes_referencia, salario_base, valor_diaria_base, dias_trabalhados,
        valor_total_diarias, bonus, salario_bruto, faixa_inss, desconto_inss,
        base_calculo_fgts, valor_fgts, base_calculo_irrf,
        custo_inss_patronal, custo_rat, custo_terceiros
    )
    VALUES (
        p_funcionario_id, v_mes_date, v_base_salary_numeric, v_daily_value_numeric, v_ponto_resumo.dias_trabalhados,
        (v_ponto_resumo.dias_trabalhados * v_daily_value_numeric), v_bonus, v_salario_bruto, v_faixa_inss, v_desconto_inss,
        v_base_fgts, v_valor_fgts, v_base_irrf,
        v_custo_inss_patronal, v_custo_rat, v_custo_terceiros
    )
    ON CONFLICT (funcionario_id, mes_referencia)
    DO UPDATE SET
        salario_base = EXCLUDED.salario_base,
        valor_diaria_base = EXCLUDED.valor_diaria_base,
        dias_trabalhados = EXCLUDED.dias_trabalhados,
        valor_total_diarias = EXCLUDED.valor_total_diarias,
        bonus = EXCLUDED.bonus,
        salario_bruto = EXCLUDED.salario_bruto,
        faixa_inss = EXCLUDED.faixa_inss,
        desconto_inss = EXCLUDED.desconto_inss,
        base_calculo_fgts = EXCLUDED.base_calculo_fgts,
        valor_fgts = EXCLUDED.valor_fgts,
        base_calculo_irrf = EXCLUDED.base_calculo_irrf,
        custo_inss_patronal = EXCLUDED.custo_inss_patronal,
        custo_rat = EXCLUDED.custo_rat,
        custo_terceiros = EXCLUDED.custo_terceiros
    RETURNING id INTO v_contracheque_id;

    -- 8. Retornar o registro completo
    RETURN QUERY SELECT * FROM public.contracheques WHERE id = v_contracheque_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.agendar_vale(p_funcionario_id bigint, p_organizacao_id bigint, p_periodo_inicio date, p_periodo_fim date, p_data_pagamento date, p_valor_projetado numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    novo_lancamento_id bigint;
    nome_funcionario text;
BEGIN
    -- Busca o nome do funcionário para a descrição do lançamento
    SELECT full_name INTO nome_funcionario FROM public.funcionarios WHERE id = p_funcionario_id;

    -- 1. Cria o lançamento financeiro com o valor projetado
    INSERT INTO public.lancamentos (
        descricao,
        valor,
        tipo,
        status,
        data_transacao,
        data_vencimento,
        data_pagamento,
        funcionario_id,
        favorecido_contato_id,
        conta_id, -- ATENÇÃO: Definir uma conta padrão ou buscar uma. Usando NULL por enquanto.
        organizacao_id
    )
    VALUES (
        'Adiantamento (Vale) para ' || nome_funcionario,
        p_valor_projetado,
        'Despesa',
        'Pendente',
        p_data_pagamento,
        p_data_pagamento,
        NULL, -- Data de pagamento fica nula até a confirmação
        p_funcionario_id,
        (SELECT contato_id FROM public.funcionarios WHERE id = p_funcionario_id),
        NULL, -- DEFINIR UMA CONTA PADRÃO AQUI SE NECESSÁRIO
        p_organizacao_id
    ) RETURNING id INTO novo_lancamento_id;

    -- 2. Cria o registro na tabela de controle de vales
    INSERT INTO public.vales_agendados (
        funcionario_id,
        lancamento_id,
        periodo_inicio,
        periodo_fim,
        data_pagamento_agendada,
        valor_projetado,
        organizacao_id
    )
    VALUES (
        p_funcionario_id,
        novo_lancamento_id,
        p_periodo_inicio,
        p_periodo_fim,
        p_data_pagamento,
        p_valor_projetado,
        p_organizacao_id
    );

    -- Retorna sucesso
    RETURN json_build_object('status', 'success', 'message', 'Vale agendado com sucesso!', 'lancamento_id', novo_lancamento_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_atividades_ia(p_organizacao_id bigint, p_termo_busca text DEFAULT NULL::text, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date, p_status text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, atividade text, descricao text, status text, data_inicio date, obra text, responsavel text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.nome as atividade,
        a.descricao,
        a.status,
        a.data_inicio_prevista,
        COALESCE(e.nome, 'Sem Obra') as obra,
        COALESCE(f.full_name, a.responsavel_texto, 'Sem Responsável') as responsavel
    FROM 
        public.activities a
    LEFT JOIN 
        public.empreendimentos e ON a.empreendimento_id = e.id
    LEFT JOIN 
        public.funcionarios f ON a.funcionario_id = f.id
    WHERE 
        a.organizacao_id = p_organizacao_id
        -- Filtro de Texto (Nome da atividade ou Nome da Obra)
        AND (
            p_termo_busca IS NULL OR p_termo_busca = '' OR
            a.nome ILIKE '%' || p_termo_busca || '%' OR
            e.nome ILIKE '%' || p_termo_busca || '%'
        )
        -- Filtro de Data (Início)
        AND (
            p_data_inicio IS NULL OR a.data_inicio_prevista >= p_data_inicio
        )
        -- Filtro de Data (Fim)
        AND (
            p_data_fim IS NULL OR a.data_inicio_prevista <= p_data_fim
        )
        -- Filtro de Status
        AND (
            p_status IS NULL OR p_status = '' OR
            a.status ILIKE '%' || p_status || '%'
        )
    ORDER BY 
        a.data_inicio_prevista ASC
    LIMIT 20;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_limpar_provisoes_demissao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_mes_competencia_demissao date;
BEGIN
    -- Define o primeiro dia do mês em que a demissão ocorreu.
    v_mes_competencia_demissao := date_trunc('month', NEW.demission_date)::date;

    -- Deleta todos os lançamentos de salário provisionados (status 'Pendente')
    -- para este funcionário, cujo mês de competência seja POSTERIOR
    -- ao mês da demissão. O pagamento do último mês trabalhado é mantido.
    DELETE FROM public.lancamentos
    WHERE funcionario_id = NEW.id
      AND status = 'Pendente'
      AND mes_competencia > v_mes_competencia_demissao;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.garantir_simulacao_para_contrato(p_contrato_id bigint)
 RETURNS TABLE(id bigint, empreendimento_id bigint, produto_id bigint, contato_id bigint, valor_venda numeric, desconto_percentual numeric, desconto_valor numeric, entrada_percentual numeric, entrada_valor numeric, num_parcelas_entrada integer, data_primeira_parcela_entrada date, parcelas_obra_percentual numeric, parcelas_obra_valor numeric, num_parcelas_obra integer, data_primeira_parcela_obra date, saldo_remanescente_percentual numeric, saldo_remanescente_valor numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_simulacao_id BIGINT;
    v_contrato RECORD;
    v_configuracao RECORD;
BEGIN
    -- Busca os dados do contrato
    SELECT * INTO v_contrato FROM public.contratos WHERE contratos.id = p_contrato_id;

    -- Verifica se o contrato já tem uma simulação associada
    IF v_contrato.simulacao_id IS NOT NULL THEN
        v_simulacao_id := v_contrato.simulacao_id;
    ELSE
        -- Se não tiver, busca a configuração padrão do empreendimento
        SELECT * INTO v_configuracao FROM public.configuracoes_venda WHERE configuracoes_venda.empreendimento_id = v_contrato.empreendimento_id;

        -- Cria uma nova simulação para o contrato
        INSERT INTO public.simulacoes (
            contrato_id,
            contato_id,
            empreendimento_id,
            produto_id,
            valor_venda,
            desconto_percentual,
            entrada_percentual,
            num_parcelas_entrada,
            data_primeira_parcela_entrada,
            parcelas_obra_percentual,
            num_parcelas_obra,
            data_primeira_parcela_obra,
            saldo_remanescente_percentual,
            status
        )
        VALUES (
            p_contrato_id,
            v_contrato.contato_id,
            v_contrato.empreendimento_id,
            v_contrato.produto_id,
            v_contrato.valor_final_venda,
            COALESCE(v_configuracao.desconto_percentual, 0),
            COALESCE(v_configuracao.entrada_percentual, 0),
            COALESCE(v_configuracao.num_parcelas_entrada, 1),
            v_configuracao.data_primeira_parcela_entrada,
            COALESCE(v_configuracao.parcelas_obra_percentual, 0),
            COALESCE(v_configuracao.num_parcelas_obra, 1),
            v_configuracao.data_primeira_parcela_obra,
            COALESCE(v_configuracao.saldo_remanescente_percentual, 0),
            'Vinculada'
        ) RETURNING simulacoes.id INTO v_simulacao_id;

        -- Atualiza o contrato com o ID da nova simulação
        UPDATE public.contratos SET simulacao_id = v_simulacao_id WHERE contratos.id = p_contrato_id;
    END IF;

    -- Retorna os dados da simulação encontrada ou criada
    RETURN QUERY
    SELECT
        s.id,
        s.empreendimento_id,
        s.produto_id,
        s.contato_id,
        s.valor_venda,
        s.desconto_percentual,
        s.desconto_valor,
        s.entrada_percentual,
        s.entrada_valor,
        s.num_parcelas_entrada,
        s.data_primeira_parcela_entrada,
        s.parcelas_obra_percentual,
        s.parcelas_obra_valor,
        s.num_parcelas_obra,
        s.data_primeira_parcela_obra,
        s.saldo_remanescente_percentual,
        s.saldo_remanescente_valor
    FROM public.simulacoes s
    WHERE s.id = v_simulacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalcular_banco_horas_dia()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_funcionario_id BIGINT;
    v_data_registro DATE;
    v_jornada_id BIGINT;
    v_dia_semana INT;
    v_horas_previstas INTERVAL;
    v_horas_trabalhadas INTERVAL;
    v_saldo_calculado INTERVAL;
    v_multiplicador NUMERIC(3, 1) := 1.0;
    v_e_feriado BOOLEAN;
    v_pontos_dia RECORD;
    v_tolerancia INT;
BEGIN
    -- Identifica o funcionário e a data a ser recalculada
    IF TG_OP = 'DELETE' THEN
        v_funcionario_id := OLD.funcionario_id;
        v_data_registro := DATE(OLD.data_hora);
    ELSE
        v_funcionario_id := NEW.funcionario_id;
        v_data_registro := DATE(NEW.data_hora);
    END IF;

    -- Busca a jornada do funcionário e a tolerância
    SELECT f.jornada_id, j.tolerancia_minutos INTO v_jornada_id, v_tolerancia
    FROM public.funcionarios f
    JOIN public.jornadas j ON f.jornada_id = j.id
    WHERE f.id = v_funcionario_id;
    
    v_tolerancia := COALESCE(v_tolerancia, 0);
    v_dia_semana := EXTRACT(ISODOW FROM v_data_registro); -- 1=Segunda, 7=Domingo

    -- 1. BUSCA AS 4 PRINCIPAIS MARCAÇÕES DO DIA
    SELECT
        MIN(CASE WHEN tipo_registro = 'Entrada' THEN data_hora END) as p_entrada,
        MAX(CASE WHEN tipo_registro = 'Início Intervalo' THEN data_hora END) as p_saida_intervalo,
        MIN(CASE WHEN tipo_registro = 'Fim Intervalo' THEN data_hora END) as p_volta_intervalo,
        MAX(CASE WHEN tipo_registro = 'Saída' THEN data_hora END) as p_saida
    INTO v_pontos_dia
    FROM public.pontos
    WHERE funcionario_id = v_funcionario_id AND DATE(data_hora) = v_data_registro;

    -- 2. CALCULA HORAS PREVISTAS
    SELECT (jd.horario_saida - jd.horario_entrada) - COALESCE((jd.horario_volta_intervalo - jd.horario_saida_intervalo), '00:00'::interval)
    INTO v_horas_previstas
    FROM public.jornada_detalhes jd
    WHERE jd.jornada_id = v_jornada_id AND jd.dia_semana = v_dia_semana;
    v_horas_previstas := COALESCE(v_horas_previstas, '0 hours');

    -- 3. CALCULA HORAS TRABALHADAS (LÓGICA CORRIGIDA)
    v_horas_trabalhadas := '0 hours'::interval;
    IF v_pontos_dia.p_entrada IS NOT NULL AND v_pontos_dia.p_saida IS NOT NULL THEN
        IF v_pontos_dia.p_saida_intervalo IS NOT NULL AND v_pontos_dia.p_volta_intervalo IS NOT NULL THEN
            -- Jornada com intervalo
            v_horas_trabalhadas := (v_pontos_dia.p_saida - v_pontos_dia.p_entrada) - (v_pontos_dia.p_volta_intervalo - v_pontos_dia.p_saida_intervalo);
        ELSE
            -- Jornada sem intervalo
            v_horas_trabalhadas := (v_pontos_dia.p_saida - v_pontos_dia.p_entrada);
        END IF;
    END IF;
    v_horas_trabalhadas := GREATEST('0 hours'::interval, v_horas_trabalhadas);

    -- 4. APLICA MULTIPLICADOR E CALCULA SALDO
    SELECT EXISTS (SELECT 1 FROM public.feriados WHERE data_feriado = v_data_registro) INTO v_e_feriado;
    IF (v_dia_semana IN (6, 7) OR v_e_feriado) AND v_horas_previstas = '0 hours'::interval THEN
        v_multiplicador := 1.5;
    END IF;
    
    v_saldo_calculado := (v_horas_trabalhadas * v_multiplicador) - v_horas_previstas;

    -- 5. SALVA O RESULTADO NA NOVA TABELA (UPSERT)
    INSERT INTO public.banco_horas_registros
        (funcionario_id, data_registro, entrada_1, saida_1, entrada_2, saida_2, horas_previstas, horas_trabalhadas, saldo_dia, multiplicador_aplicado)
    VALUES
        (v_funcionario_id, v_data_registro, 
         CAST(v_pontos_dia.p_entrada AS TIME), 
         CAST(v_pontos_dia.p_saida_intervalo AS TIME), 
         CAST(v_pontos_dia.p_volta_intervalo AS TIME), 
         CAST(v_pontos_dia.p_saida AS TIME),
         v_horas_previstas, v_horas_trabalhadas, v_saldo_calculado, v_multiplicador)
    ON CONFLICT (funcionario_id, data_registro)
    DO UPDATE SET
        entrada_1 = EXCLUDED.entrada_1,
        saida_1 = EXCLUDED.saida_1,
        entrada_2 = EXCLUDED.entrada_2,
        saida_2 = EXCLUDED.saida_2,
        horas_previstas = EXCLUDED.horas_previstas,
        horas_trabalhadas = EXCLUDED.horas_trabalhadas,
        saldo_dia = EXCLUDED.saldo_dia,
        multiplicador_aplicado = EXCLUDED.multiplicador_aplicado;

    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_funil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Insere um novo registro na tabela de histórico com os dados da movimentação
    INSERT INTO public.historico_movimentacao_funil (
        contato_no_funil_id,
        coluna_anterior_id,
        coluna_nova_id,
        usuario_id,
        organizacao_id
    )
    VALUES (
        NEW.id,                 -- O ID do card que foi movido
        OLD.coluna_id,          -- A coluna em que ele estava ANTES
        NEW.coluna_id,          -- A nova coluna para a qual ele foi
        auth.uid(),             -- Pega automaticamente o ID do usuário que fez a ação
        NEW.organizacao_id      -- A organização do card
    );
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_resumo_ponto_mensal(p_funcionario_id bigint, p_mes_referencia text)
 RETURNS TABLE(dias_trabalhados integer, horas_trabalhadas_formatado text, faltas integer, valor_a_pagar numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_start_date date;
    v_end_date date;
    v_employee record;
    v_total_minutos_trabalhados numeric;
    v_dias_uteis integer;
BEGIN
    -- Define o primeiro e o último dia do mês de referência
    v_start_date := to_date(p_mes_referencia || '-01', 'YYYY-MM-DD');
    v_end_date := (v_start_date + interval '1 month - 1 day');

    -- Busca os dados do funcionário, incluindo sua jornada e tolerância
    SELECT f.id, f.daily_value, j.tolerancia_minutos, f.jornada_id
    INTO v_employee
    FROM public.funcionarios f
    LEFT JOIN public.jornadas j ON f.jornada_id = j.id
    WHERE f.id = p_funcionario_id;

    IF v_employee IS NULL THEN
        RETURN QUERY SELECT 0, '00:00', 0, 0.00;
        RETURN;
    END IF;

    -- ***** INÍCIO DA CORREÇÃO *****
    -- 1. Conta os dias únicos em que houve pelo menos uma batida de ponto
    SELECT COUNT(DISTINCT p.data_hora::date)
    INTO dias_trabalhados
    FROM public.pontos p
    WHERE p.funcionario_id = p_funcionario_id AND p.data_hora::date BETWEEN v_start_date AND v_end_date;
    -- ***** FIM DA CORREÇÃO *****

    -- CTEs para agrupar pontos e aplicar lógica de tolerância para o CÁLCULO DE HORAS
    WITH daily_punches AS (
        SELECT
            p.data_hora::date as dia,
            MIN(CASE WHEN p.tipo_registro = 'Entrada' THEN p.data_hora::time END) as entrada,
            MAX(CASE WHEN p.tipo_registro = 'Inicio_Intervalo' THEN p.data_hora::time END) as saida_intervalo,
            MIN(CASE WHEN p.tipo_registro = 'Fim_Intervalo' THEN p.data_hora::time END) as volta_intervalo,
            MAX(CASE WHEN p.tipo_registro = 'Saida' THEN p.data_hora::time END) as saida
        FROM public.pontos p
        WHERE p.funcionario_id = p_funcionario_id AND p.data_hora::date BETWEEN v_start_date AND v_end_date
        GROUP BY p.data_hora::date
    ),
    adjusted_times AS (
        SELECT
            dp.*,
            CASE WHEN abs(extract(epoch from dp.entrada - jd.horario_entrada)/60) <= v_employee.tolerancia_minutos THEN jd.horario_entrada ELSE dp.entrada END as entrada_ajustada,
            CASE WHEN abs(extract(epoch from dp.saida_intervalo - jd.horario_saida_intervalo)/60) <= v_employee.tolerancia_minutos THEN jd.horario_saida_intervalo ELSE dp.saida_intervalo END as saida_intervalo_ajustada,
            CASE WHEN abs(extract(epoch from dp.volta_intervalo - jd.horario_volta_intervalo)/60) <= v_employee.tolerancia_minutos THEN jd.horario_volta_intervalo ELSE dp.volta_intervalo END as volta_intervalo_ajustada,
            CASE WHEN abs(extract(epoch from dp.saida - jd.horario_saida)/60) <= v_employee.tolerancia_minutos THEN jd.horario_saida ELSE dp.saida END as saida_ajustada
        FROM daily_punches dp
        LEFT JOIN public.jornada_detalhes jd ON jd.jornada_id = v_employee.jornada_id AND jd.dia_semana = EXTRACT(DOW FROM dp.dia)
    )
    SELECT
        COALESCE(SUM(
            GREATEST(0, (
                EXTRACT(EPOCH FROM (saida_ajustada - entrada_ajustada)) - 
                COALESCE(EXTRACT(EPOCH FROM (volta_intervalo_ajustada - saida_intervalo_ajustada)), 0)
            )) / 60
        ), 0)
    INTO v_total_minutos_trabalhados
    FROM adjusted_times
    WHERE entrada_ajustada IS NOT NULL AND saida_ajustada IS NOT NULL;
    
    SELECT count(*) INTO v_dias_uteis
    FROM generate_series(v_start_date, v_end_date, '1 day'::interval) AS d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);

    faltas := GREATEST(0, v_dias_uteis - dias_trabalhados);
    horas_trabalhadas_formatado := floor(v_total_minutos_trabalhados / 60)::text || ':' || lpad( (v_total_minutos_trabalhados % 60)::int::text, 2, '0');
    valor_a_pagar := dias_trabalhados * (COALESCE(REPLACE(REPLACE(TRIM(REPLACE(v_employee.daily_value, 'R$', '')), '.', ''), ',', '.')::numeric, 0));

    RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_ajuste_banco_horas(p_funcionario_id bigint, p_minutos_ajustados integer, p_motivo text, p_conta_id bigint, p_categoria_id bigint, p_criado_por_usuario_id uuid)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_valor_diaria numeric;
    v_carga_horaria_semanal integer;
    v_valor_hora numeric;
    v_valor_ajuste numeric;
    v_tipo_lancamento text;
    v_descricao_lancamento text;
    v_favorecido_contato_id bigint;
    novo_lancamento_id bigint;
BEGIN
    -- 1. Buscar dados do funcionário para cálculo
    SELECT
        REPLACE(f.daily_value, ',', '.')::numeric,
        j.carga_horaria_semanal,
        f.contato_id
    INTO
        v_valor_diaria,
        v_carga_horaria_semanal,
        v_favorecido_contato_id
    FROM funcionarios f
    LEFT JOIN jornadas j ON f.jornada_id = j.id
    WHERE f.id = p_funcionario_id;

    IF v_valor_diaria IS NULL OR v_valor_diaria <= 0 THEN
        RETURN QUERY SELECT false, 'Erro: Funcionário não possui um valor de diária válido cadastrado.';
        RETURN;
    END IF;

    IF v_carga_horaria_semanal IS NULL OR v_carga_horaria_semanal <= 0 THEN
       v_carga_horaria_semanal := 44; -- Valor padrão se não houver jornada
    END IF;

    -- 2. Calcular valor da hora e o valor total do ajuste
    v_valor_hora := (v_valor_diaria * 5) / v_carga_horaria_semanal;
    v_valor_ajuste := (abs(p_minutos_ajustados) / 60.0) * v_valor_hora;

    -- 3. Definir tipo e descrição do lançamento financeiro
    IF p_minutos_ajustados < 0 THEN
        v_tipo_lancamento := 'Despesa';
        v_descricao_lancamento := 'Pagamento de Banco de Horas - ' || p_motivo;
    ELSE
        v_tipo_lancamento := 'Receita';
        v_descricao_lancamento := 'Desconto de Banco de Horas - ' || p_motivo;
    END IF;

    -- 4. Inserir o lançamento financeiro
    INSERT INTO public.lancamentos (
        descricao, valor, tipo, status, data_transacao, data_vencimento, data_pagamento,
        conta_id, categoria_id, favorecido_contato_id, criado_por_usuario_id
    ) VALUES (
        v_descricao_lancamento,
        v_valor_ajuste,
        v_tipo_lancamento,
        'Pago',
        CURRENT_DATE,
        CURRENT_DATE,
        CURRENT_DATE,
        p_conta_id,
        p_categoria_id,
        v_favorecido_contato_id,
        p_criado_por_usuario_id
    ) RETURNING id INTO novo_lancamento_id;

    -- 5. Inserir o registro de ajuste, vinculando ao lançamento
    INSERT INTO public.ajustes_banco_horas (
        funcionario_id, lancamento_financeiro_id, minutos_ajustados,
        valor_ajustado, data_ajuste, motivo, criado_por_usuario_id
    ) VALUES (
        p_funcionario_id,
        novo_lancamento_id,
        p_minutos_ajustados,
        v_valor_ajuste,
        CURRENT_DATE,
        p_motivo,
        p_criado_por_usuario_id
    );

    RETURN QUERY SELECT true, 'Ajuste de banco de horas e lançamento financeiro criados com sucesso!';

EXCEPTION
    WHEN others THEN
        RETURN QUERY SELECT false, 'Erro inesperado: ' || SQLERRM;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_salario_atual(p_funcionario_id bigint)
 RETURNS TABLE(salario_base numeric, valor_diaria numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Etapa 1: Tenta encontrar o salário mais recente que já está em vigor (data de início <= hoje)
    RETURN QUERY
    SELECT
        hs.salario_base,
        hs.valor_diaria
    FROM
        public.historico_salarial hs
    WHERE
        hs.funcionario_id = p_funcionario_id
        AND hs.data_inicio_vigencia <= CURRENT_DATE
    ORDER BY
        hs.data_inicio_vigencia DESC, hs.criado_em DESC
    LIMIT 1;

    -- Etapa 2: Se NADA foi retornado acima (ou seja, não há histórico válido para o presente/passado),
    -- então a função continua para o próximo passo.
    IF NOT FOUND THEN
        -- Etapa 2a: Procura por salários agendados para o FUTURO.
        RETURN QUERY
        SELECT
            hs.salario_base,
            hs.valor_diaria
        FROM
            public.historico_salarial hs
        WHERE
            hs.funcionario_id = p_funcionario_id
        ORDER BY
            hs.data_inicio_vigencia ASC, hs.criado_em ASC -- Pega o mais próximo do futuro
        LIMIT 1;

        -- Etapa 3: Se ainda não encontrou NADA (nem passado, nem futuro),
        -- usa o plano B e busca os valores da ficha do funcionário.
        IF NOT FOUND THEN
            RETURN QUERY
            SELECT 
                CAST(REPLACE(REPLACE(f.base_salary, '.', ''), ',', '.') AS NUMERIC),
                CAST(REPLACE(REPLACE(f.daily_value, '.', ''), ',', '.') AS NUMERIC)
            FROM 
                public.funcionarios f
            WHERE 
                f.id = p_funcionario_id;
        END IF;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.link_contato_to_whatsapp_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    found_contato_id BIGINT;
BEGIN
    -- Só executa a lógica se for uma mensagem RECEBIDA (inbound) e se o contato_id estiver VAZIO.
    IF NEW.contato_id IS NULL AND NEW.direction = 'inbound' THEN

        -- Procura na tabela 'telefones' por um número correspondente.
        -- A função regexp_replace('...', '\D', '', 'g') remove todos os caracteres não numéricos,
        -- garantindo que a gente consiga comparar '5533991912291' com '(33) 99191-2291'.
        SELECT T.contato_id INTO found_contato_id
        FROM public.telefones T
        WHERE regexp_replace(T.telefone, '\D', '', 'g') = regexp_replace(NEW.sender_id, '\D', '', 'g')
        LIMIT 1;

        -- Se um contato_id correspondente foi encontrado, atualiza a nova mensagem ANTES de ela ser salva.
        IF found_contato_id IS NOT NULL THEN
            NEW.contato_id := found_contato_id;
        END IF;

    END IF;

    -- Retorna a nova linha (com o contato_id preenchido, se encontrado) para ser inserida na tabela.
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_retirada_estoque(p_estoque_id uuid, p_quantidade numeric, p_observacao text, p_usuario_id text, p_funcionario_id uuid, p_organizacao_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_quantidade_atual NUMERIC;
    v_quantidade_em_uso NUMERIC;
BEGIN
    -- 1. Cria um bloqueio explícito (FOR UPDATE) na linha do estoque.
    --    Se 2 usuários clicarem ao mesmo tempo, um deles terá que 
    --    esperar o outro terminar a transação.
    SELECT quantidade_atual, quantidade_em_uso 
    INTO v_quantidade_atual, v_quantidade_em_uso
    FROM estoque 
    WHERE id = p_estoque_id 
      AND organizacao_id = p_organizacao_id
    FOR UPDATE;

    -- 2. Valida se o ID do estoque existe e pertence à organização
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de estoque não encontrado ou não pertence a esta organização.';
    END IF;

    -- 3. Valida se a quantidade pedida é possível
    IF v_quantidade_atual < p_quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente. Quantidade atual (%), Solicitada (%).', v_quantidade_atual, p_quantidade;
    END IF;

    -- 4. Subtrai o "Disponível" e soma o "Em Uso" da obra
    UPDATE estoque
       SET quantidade_atual = v_quantidade_atual - p_quantidade,
           quantidade_em_uso = COALESCE(v_quantidade_em_uso, 0) + p_quantidade,
           ultima_atualizacao = NOW()
     WHERE id = p_estoque_id;

    -- 5. Grava o fato histórico de Retirada mantendo a string exata que
    --    as Políticas (RLS) e o Painel de Movimentações (Dashboard) esperam encontrar.
    INSERT INTO movimentacoes_estoque (
        estoque_id,
        organizacao_id,
        tipo,
        quantidade,
        usuario_id,
        observacao,
        funcionario_id
    ) VALUES (
        p_estoque_id,
        p_organizacao_id,
        'Retirada por Funcionário',
        p_quantidade,
        CAST(p_usuario_id AS UUID), -- Garante o Casting de Auth JWT
        p_observacao,
        p_funcionario_id
    );

    -- Ocorrendo sucesso, o COMMIT já é disparado nativamente pelo Postgres
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_acumulado_12m(p_indice text, p_data_limite date)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_acumulado DECIMAL := 1.0;
    v_fator DECIMAL;
    v_count INTEGER := 0;
BEGIN
    FOR v_fator IN 
        SELECT (1 + (valor_mensal / 100))
        FROM public.indices_governamentais
        WHERE nome_indice = p_indice
          AND data_referencia <= p_data_limite
        ORDER BY data_referencia DESC
        LIMIT 12
    LOOP
        v_acumulado := v_acumulado * v_fator;
        v_count := v_count + 1;
    END LOOP;

    IF v_count = 0 THEN
        RETURN 0.00;
    END IF;

    RETURN ROUND(((v_acumulado - 1) * 100)::numeric, 4);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user_id uuid, p_contact_id uuid, p_org_id bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_conv_id uuid;
BEGIN
    SELECT c.id INTO v_conv_id
    FROM sys_chat_conversations c
    JOIN sys_chat_participants p1 ON c.id = p1.conversation_id AND p1.user_id = p_user_id
    JOIN sys_chat_participants p2 ON c.id = p2.conversation_id AND p2.user_id = p_contact_id
    WHERE c.organizacao_id = p_org_id;

    IF v_conv_id IS NULL THEN
        INSERT INTO sys_chat_conversations (organizacao_id)
        VALUES (p_org_id)
        RETURNING id INTO v_conv_id;

        INSERT INTO sys_chat_participants (conversation_id, user_id)
        VALUES 
            (v_conv_id, p_user_id),
            (v_conv_id, p_contact_id);
    END IF;

    RETURN v_conv_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_dados_ponto_funcionario(p_funcionario_id bigint, p_mes_referencia date)
 RETURNS TABLE(total_dias_trabalhados bigint, total_dias_uteis_mes integer, total_horas_trabalhadas_interval interval, total_horas_previstas_interval interval, saldo_banco_horas_interval interval, total_faltas integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH mes_dados AS (
        SELECT
            SUM(CASE WHEN bhr.horas_trabalhadas > '0 seconds' THEN 1 ELSE 0 END) AS dias_trabalhados,
            SUM(bhr.horas_previstas) AS total_previsto,
            SUM(bhr.horas_trabalhadas) AS total_trabalhado,
            SUM(bhr.saldo_dia_contabilizado) AS saldo_total,
            SUM(CASE WHEN bhr.horas_previstas > '0 seconds' AND bhr.horas_trabalhadas = '0 seconds' AND NOT EXISTS (SELECT 1 FROM abonos a WHERE a.funcionario_id = bhr.funcionario_id AND a.data_abono = bhr.data_registro) THEN 1 ELSE 0 END) AS dias_falta
        FROM
            public.banco_horas_registros bhr
        WHERE
            bhr.funcionario_id = p_funcionario_id
            AND date_trunc('month', bhr.data_registro) = date_trunc('month', p_mes_referencia)
    ),
    dias_uteis AS (
        SELECT COUNT(DISTINCT jd.dia_semana)::INT as count_uteis
        FROM public.funcionarios f
        JOIN public.jornada_detalhes jd ON f.jornada_id = jd.jornada_id
        WHERE f.id = p_funcionario_id
    )
    SELECT
        COALESCE(md.dias_trabalhados, 0)::BIGINT,
        -- Este cálculo de dias úteis é uma aproximação, o ideal seria refatorar se precisar de exatidão
        (SELECT COUNT(*)::INT FROM dias_uteis),
        COALESCE(md.total_trabalhado, '0 seconds'),
        COALESCE(md.total_previsto, '0 seconds'),
        COALESCE(md.saldo_total, '0 seconds'),
        COALESCE(md.dias_falta, 0)::INT
    FROM
        mes_dados md;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_agendar_salarios_novofuncionario()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    i integer;
BEGIN
    -- Cria a provisão para os próximos 12 meses a partir do mês atual
    FOR i IN 0..11 LOOP
        PERFORM public.agendar_salario_provisionado(NEW.id, (date_trunc('month', NOW()) + (i || ' months')::interval)::date);
    END LOOP;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.manutencao_provisionamento_salarial()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_funcionario record;
    v_mes_a_provisionar date;
BEGIN
    -- Define o mês a ser criado (o 12º mês a partir de hoje, ou seja, 11 meses no futuro)
    v_mes_a_provisionar := (date_trunc('month', NOW()) + '11 months'::interval)::date;

    -- Itera sobre todos os funcionários que não foram demitidos
    FOR v_funcionario IN SELECT id, full_name FROM public.funcionarios WHERE demission_date IS NULL
    LOOP
        -- Verifica se a provisão para este funcionário e este mês futuro já não existe
        IF NOT EXISTS (
            SELECT 1 FROM public.lancamentos 
            WHERE funcionario_id = v_funcionario.id
              AND mes_competencia = v_mes_a_provisionar
        ) THEN
            -- Se não existe, cria a provisão
            PERFORM public.agendar_salario_provisionado(v_funcionario.id, v_mes_a_provisionar);
        END IF;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_contatos_geral(p_search_term text, p_organizacao_id bigint)
 RETURNS TABLE(id bigint, nome text, razao_social text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT c.id, c.nome, c.razao_social
    FROM public.contatos AS c
    WHERE c.organizacao_id = p_organizacao_id
      AND (
        c.nome ILIKE '%' || p_search_term || '%' OR
        c.razao_social ILIKE '%' || p_search_term || '%'
      )
    LIMIT 20;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_elemento_bim_etapa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.duplicar_parcela_contrato(p_parcela_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    original_parcela RECORD;
    nova_parcela_id INT;
BEGIN
    -- 1. Encontra a parcela original
    SELECT * INTO original_parcela
    FROM contrato_parcelas
    WHERE id = p_parcela_id;

    -- 2. Se não encontrar, gera um erro
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcela com ID % não encontrada.', p_parcela_id;
    END IF;

    -- 3. Insere a nova parcela apenas com os campos essenciais
    INSERT INTO contrato_parcelas (
        contrato_id,
        descricao,
        tipo,
        data_vencimento,
        valor_parcela,
        status_pagamento
    )
    VALUES (
        original_parcela.contrato_id,
        original_parcela.descricao || ' (Cópia)',
        'Adicional',
        original_parcela.data_vencimento + INTERVAL '30 days',
        original_parcela.valor_parcela,
        'Pendente'
    )
    RETURNING id INTO nova_parcela_id;

    -- 4. Confirma se a inserção funcionou
    IF nova_parcela_id IS NULL THEN
        RAISE EXCEPTION 'A inserção no banco de dados falhou silenciosamente.';
    END IF;

    -- 5. Retorna sucesso
    RETURN json_build_object('success', true, 'message', 'Parcela duplicada com sucesso!');

EXCEPTION
    -- 6. Captura qualquer outro erro
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_lancamentos_com_saldo(p_conta_id bigint, p_start_date date, p_end_date date)
 RETURNS TABLE(id bigint, descricao text, valor numeric, data_transacao date, tipo text, status text, conta_id bigint, categoria_id bigint, empreendimento_id bigint, etapa_id bigint, pedido_compra_id bigint, funcionario_id bigint, created_at timestamp with time zone, data_vencimento date, data_pagamento date, parcela_info text, recorrencia_id bigint, favorecido_contato_id bigint, conciliado boolean, id_transacao_externa text, empresa_id bigint, criado_por_usuario_id uuid, conta_destino_id bigint, observacao text, mes_competencia date, saldo numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    saldo_inicial NUMERIC;
BEGIN
    -- Calcula o saldo inicial da conta ANTES da data de início do filtro.
    SELECT COALESCE(SUM(CASE WHEN l.tipo = 'Receita' THEN l.valor ELSE -l.valor END), 0)
    INTO saldo_inicial
    FROM lancamentos l
    WHERE l.conta_id = p_conta_id AND l.data_transacao < p_start_date;

    -- Retorna os lançamentos do período, calculando o saldo progressivo.
    RETURN QUERY
    SELECT
        l.id,
        l.descricao,
        l.valor,
        l.data_transacao,
        l.tipo,
        l.status,
        l.conta_id,
        l.categoria_id,
        l.empreendimento_id,
        l.etapa_id,
        l.pedido_compra_id,
        l.funcionario_id,
        l.created_at,
        l.data_vencimento,
        l.data_pagamento,
        l.parcela_info,
        l.recorrencia_id,
        l.favorecido_contato_id,
        l.conciliado,
        l.id_transacao_externa,
        l.empresa_id,
        l.criado_por_usuario_id,
        l.conta_destino_id,
        l.observacao,
        l.mes_competencia,
        saldo_inicial + SUM(CASE WHEN l.tipo = 'Receita' THEN l.valor ELSE -l.valor END) OVER (ORDER BY l.data_transacao, l.created_at, l.id) AS saldo
    FROM
        lancamentos l
    WHERE
        l.conta_id = p_conta_id
        AND l.data_transacao >= p_start_date
        AND l.data_transacao <= p_end_date
    ORDER BY
        l.data_transacao, l.created_at, l.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_extrato_por_conta(conta_id_param integer, data_inicio_param date, data_fim_param date)
 RETURNS TABLE(data date, descricao text, valor numeric, saldo numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    saldo_inicial NUMERIC;
BEGIN
    -- 1. Calcular o Saldo Inicial
    -- Soma o saldo inicial da conta com todos os lançamentos ANTES da data de início.
    SELECT
        COALESCE(cf.saldo_inicial, 0) + 
        COALESCE(SUM(
            CASE
                WHEN l.tipo = 'receita' THEN l.valor
                WHEN l.tipo = 'despesa' THEN -l.valor
                ELSE 0
            END
        ), 0)
    INTO saldo_inicial
    FROM contas_financeiras cf
    LEFT JOIN lancamentos l ON cf.id = l.conta_id
    WHERE cf.id = conta_id_param AND l.data_transacao < data_inicio_param;

    -- Se não houver lançamentos anteriores, o saldo inicial é apenas o da conta.
    IF saldo_inicial IS NULL THEN
        SELECT COALESCE(cf.saldo_inicial, 0)
        INTO saldo_inicial
        FROM contas_financeiras cf
        WHERE cf.id = conta_id_param;
    END IF;


    -- 2. Retornar a tabela do extrato
    -- Cria uma linha "virtual" para o saldo inicial e une com os lançamentos do período.
    RETURN QUERY
    WITH lancamentos_periodo AS (
        SELECT
            l.data_transacao,
            l.descricao,
            CASE
                WHEN l.tipo = 'receita' THEN l.valor
                ELSE -l.valor
            END AS valor_calculado
        FROM lancamentos l
        WHERE l.conta_id = conta_id_param
        AND l.data_transacao >= data_inicio_param
        AND l.data_transacao <= data_fim_param
    ),
    extrato_com_saldo_inicial AS (
        SELECT 
            (data_inicio_param - INTERVAL '1 day')::DATE AS data,
            'Saldo Inicial' AS descricao,
            saldo_inicial AS valor,
            saldo_inicial AS saldo
        UNION ALL
        SELECT
            lp.data_transacao,
            lp.descricao,
            lp.valor_calculado,
            0 -- Saldo será calculado na próxima etapa
        FROM lancamentos_periodo lp
    )
    SELECT
        s.data,
        s.descricao,
        s.valor,
        -- Calcula a soma acumulada (saldo corrente)
        SUM(s.valor) OVER (ORDER BY s.data, (CASE WHEN s.descricao = 'Saldo Inicial' THEN 0 ELSE 1 END))::NUMERIC AS saldo
    FROM extrato_com_saldo_inicial s
    ORDER BY s.data, (CASE WHEN s.descricao = 'Saldo Inicial' THEN 0 ELSE 1 END);

END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_clientes_com_contrato(p_organizacao_id bigint)
 RETURNS TABLE(id bigint, nome text, razao_social text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        c.id,
        c.nome,
        c.razao_social
    FROM
        public.contatos c
    JOIN
        public.contratos co ON c.id = co.contato_id
    WHERE
        c.organizacao_id = p_organizacao_id
        AND co.organizacao_id = p_organizacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_pedido_entregue(p_pedido_id bigint, p_usuario_id uuid, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_empreendimento_id bigint;
    v_data_entrega_prevista date;
BEGIN
    -- 1. Atualiza o status do pedido para 'Entregue'.
    -- CORREÇÃO: Removida a coluna 'data_entrega_real' que não existe.
    UPDATE public.pedidos_compra
    SET
        status = 'Entregue'
    WHERE
        id = p_pedido_id AND organizacao_id = p_organizacao_id
    RETURNING empreendimento_id, data_entrega_prevista INTO v_empreendimento_id, v_data_entrega_prevista;

    -- 2. Cria uma atividade para registrar o evento da entrega.
    IF v_empreendimento_id IS NOT NULL THEN
        INSERT INTO public.activities (
            nome,
            tipo_atividade,
            status,
            data_inicio_prevista,
            data_fim_prevista,
            data_fim_real,
            empreendimento_id,
            criado_por_usuario_id, -- CORREÇÃO: Nome da coluna ajustado de 'usuario_responsavel_id'
            organizacao_id
        )
        VALUES (
            'Entrega Pedido #' || p_pedido_id,
            'Entrega de Pedido',
            'Concluído',
            v_data_entrega_prevista,
            v_data_entrega_prevista,
            CURRENT_DATE,
            v_empreendimento_id,
            p_usuario_id,
            p_organizacao_id
        );
    END IF;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_link_message_to_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Se a mensagem tem um contato, busca a conversa dele e salva o ID
  IF NEW.contato_id IS NOT NULL THEN
    NEW.conversation_record_id := (
        SELECT id 
        FROM whatsapp_conversations 
        WHERE contato_id = NEW.contato_id 
        ORDER BY updated_at DESC -- Pega a mais recente se houver dúvida
        LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_saldo_banco_horas(p_funcionario_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_minutos integer;
BEGIN
    SELECT COALESCE(SUM(saldo_minutos), 0)
    INTO total_minutos
    FROM public.banco_de_horas
    WHERE funcionario_id = p_funcionario_id;

    RETURN total_minutos;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_lancamentos_filtrados(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_search_term text DEFAULT NULL::text, p_empresa_ids bigint[] DEFAULT NULL::bigint[], p_conta_ids bigint[] DEFAULT NULL::bigint[], p_categoria_ids bigint[] DEFAULT NULL::bigint[], p_empreendimento_ids bigint[] DEFAULT NULL::bigint[], p_etapa_ids bigint[] DEFAULT NULL::bigint[], p_tipos text[] DEFAULT NULL::text[], p_status text[] DEFAULT NULL::text[], p_sort_key text DEFAULT 'data_relevante'::text, p_sort_direction text DEFAULT 'desc'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, descricao text, valor numeric, data_transacao date, tipo text, status text, conta_id bigint, categoria_id bigint, empreendimento_id bigint, etapa_id bigint, pedido_compra_id bigint, funcionario_id bigint, created_at timestamp with time zone, data_vencimento date, data_pagamento date, parcela_info text, recorrencia_id bigint, favorecido_contato_id bigint, conciliado boolean, id_transacao_externa text, empresa_id bigint, criado_por_usuario_id uuid, conta_destino_id bigint, observacao text, mes_competencia date, data_relevante date, total_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH lancamentos_com_relevancia AS (
        SELECT 
            l.*,
            CASE
                WHEN l.status = 'Pago' AND l.data_pagamento IS NOT NULL THEN l.data_pagamento
                WHEN l.status = 'Pendente' AND l.data_vencimento IS NOT NULL THEN l.data_vencimento
                ELSE l.data_transacao
            END AS data_relevante
        FROM public.lancamentos l
    ),
    filtered_lancamentos AS (
        SELECT *
        FROM lancamentos_com_relevancia
        WHERE
            (p_start_date IS NULL OR data_relevante >= p_start_date) AND
            (p_end_date IS NULL OR data_relevante <= p_end_date) AND
            (p_search_term IS NULL OR p_search_term = '' OR descricao ILIKE '%' || p_search_term || '%') AND
            (p_empresa_ids IS NULL OR array_length(p_empresa_ids, 1) IS NULL OR empresa_id = ANY(p_empresa_ids)) AND
            (p_conta_ids IS NULL OR array_length(p_conta_ids, 1) IS NULL OR (conta_id = ANY(p_conta_ids) OR conta_destino_id = ANY(p_conta_ids))) AND
            (p_categoria_ids IS NULL OR array_length(p_categoria_ids, 1) IS NULL OR categoria_id = ANY(p_categoria_ids)) AND
            (p_empreendimento_ids IS NULL OR array_length(p_empreendimento_ids, 1) IS NULL OR empreendimento_id = ANY(p_empreendimento_ids)) AND
            (p_etapa_ids IS NULL OR array_length(p_etapa_ids, 1) IS NULL OR etapa_id = ANY(p_etapa_ids)) AND
            (p_tipos IS NULL OR array_length(p_tipos, 1) IS NULL OR tipo = ANY(p_tipos))
    ),
    counted_lancamentos AS (
        SELECT *, COUNT(*) OVER() as full_count FROM filtered_lancamentos
    )
    SELECT 
        c.id, c.descricao, c.valor, c.data_transacao, c.tipo, c.status, c.conta_id, c.categoria_id, c.empreendimento_id, c.etapa_id, c.pedido_compra_id,
        c.funcionario_id, c.created_at, c.data_vencimento, c.data_pagamento, c.parcela_info, c.recorrencia_id, c.favorecido_contato_id,
        c.conciliado, c.id_transacao_externa, c.empresa_id, c.criado_por_usuario_id, c.conta_destino_id, c.observacao, c.mes_competencia, c.data_relevante,
        c.full_count as total_count
    FROM counted_lancamentos c
    ORDER BY
        CASE WHEN p_sort_key = 'data_relevante' AND p_sort_direction = 'asc' THEN c.data_relevante END ASC NULLS LAST,
        CASE WHEN p_sort_key = 'data_relevante' AND p_sort_direction <> 'asc' THEN c.data_relevante END DESC NULLS LAST,
        CASE WHEN p_sort_key = 'descricao' AND p_sort_direction = 'asc' THEN c.descricao END ASC NULLS LAST,
        CASE WHEN p_sort_key = 'descricao' AND p_sort_direction <> 'asc' THEN c.descricao END DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_contatos_manualmente(p_primary_contact_id bigint, p_secondary_contact_ids bigint[], p_final_data jsonb, p_final_telefones jsonb, p_final_emails jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  secondary_id bigint;
begin
  -- Atualiza o contato principal com os dados finais escolhidos pelo usuário
  update public.contatos
  set
    nome = p_final_data->>'nome',
    razao_social = p_final_data->>'razao_social',
    cpf = p_final_data->>'cpf',
    cnpj = p_final_data->>'cnpj',
    -- ##### CORREÇÃO AQUI: Converte o texto para o tipo enum correto #####
    tipo_contato = (p_final_data->>'tipo_contato')::public.tipo_contato_enum
    -- Adicionar outros campos aqui se necessário
  where id = p_primary_contact_id;

  -- Deleta todos os telefones e emails antigos do contato principal
  delete from public.telefones where contato_id = p_primary_contact_id;
  delete from public.emails where contato_id = p_primary_contact_id;

  -- Insere os novos telefones e emails finais escolhidos pelo usuário
  if jsonb_array_length(p_final_telefones) > 0 then
    insert into public.telefones (contato_id, telefone, tipo)
    select p_primary_contact_id, (t->>'telefone'), 'Principal' from jsonb_array_elements(p_final_telefones) as t;
  end if;
  
  if jsonb_array_length(p_final_emails) > 0 then
    insert into public.emails (contato_id, email, tipo)
    select p_primary_contact_id, (e->>'email'), 'Principal' from jsonb_array_elements(p_final_emails) as e;
  end if;

  -- Loop para re-parentar registros dos contatos secundários para o principal
  foreach secondary_id in array p_secondary_contact_ids
  loop
    update public.contatos_no_funil set contato_id = p_primary_contact_id where contato_id = secondary_id;
    update public.crm_notas set contato_id = p_primary_contact_id where contato_id = secondary_id;
    update public.activities set contato_id = p_primary_contact_id where contato_id = secondary_id;
    update public.contratos set contato_id = p_primary_contact_id where contato_id = secondary_id;
    update public.contratos set corretor_id = p_primary_contact_id where corretor_id = secondary_id;
    update public.lancamentos set favorecido_contato_id = p_primary_contact_id where favorecido_contato_id = secondary_id;
    update public.funcionarios set contato_id = p_primary_contact_id where contato_id = secondary_id;
    
    -- Finalmente, deleta o contato secundário
    delete from public.contatos where id = secondary_id;
  end loop;

  return 'Contatos mesclados com sucesso no ID ' || p_primary_contact_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_elemento_bim_etapa_from_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.pagar_descontar_saldo_banco_horas(p_funcionario_id bigint, p_mes_referencia_str text, p_saldo_minutos integer)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_valor_diaria NUMERIC;
    v_carga_horaria NUMERIC;
    v_valor_hora NUMERIC;
    v_valor_ajuste NUMERIC;
    v_tipo_lancamento TEXT;
    v_categoria_id BIGINT;
    v_categoria_nome TEXT;
    v_conta_id BIGINT;
    v_lancamento_id BIGINT;
    v_descricao_lancamento TEXT;
    v_mes_referencia DATE;
BEGIN
    -- Converte a string de mês para o tipo DATE
    v_mes_referencia := to_date(p_mes_referencia_str, 'YYYY-MM-DD');

    -- Pega o último salário/diária cadastrado para o funcionário
    SELECT valor_diaria INTO v_valor_diaria
    FROM public.historico_salarial
    WHERE funcionario_id = p_funcionario_id
    ORDER BY data_inicio_vigencia DESC
    LIMIT 1;

    -- Pega a jornada de trabalho
    SELECT j.carga_horaria_semanal INTO v_carga_horaria
    FROM public.funcionarios f
    JOIN public.jornadas j ON f.jornada_id = j.id
    WHERE f.id = p_funcionario_id;

    -- Validações
    IF v_valor_diaria IS NULL OR v_valor_diaria <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Erro: Valor da diária não encontrado ou inválido para o funcionário.';
        RETURN;
    END IF;
    IF v_carga_horaria IS NULL OR v_carga_horaria <= 0 THEN
        v_carga_horaria := 44; -- Valor padrão se não houver jornada
    END IF;

    -- Calcula o valor da hora e o valor total do ajuste
    v_valor_hora := (v_valor_diaria * 5) / v_carga_horaria;
    v_valor_ajuste := (abs(p_saldo_minutos) / 60.0) * v_valor_hora;

    -- Define o tipo de lançamento e a categoria
    IF p_saldo_minutos > 0 THEN
        v_tipo_lancamento := 'Despesa';
        v_categoria_nome := 'Pagamento de Banco de Horas';
    ELSE
        v_tipo_lancamento := 'Receita';
        v_categoria_nome := 'Desconto de Banco de Horas';
    END IF;

    -- Busca o ID da categoria
    SELECT id INTO v_categoria_id FROM public.categorias_financeiras WHERE nome = v_categoria_nome AND tipo = v_tipo_lancamento LIMIT 1;

    -- Se a categoria não existir, retorna erro
    IF v_categoria_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Erro: Categoria "' || v_categoria_nome || '" não encontrada. Por favor, crie-a no módulo financeiro.';
        RETURN;
    END IF;
    
    -- Pega a primeira conta financeira como padrão (ou a que for mais adequada)
    SELECT id INTO v_conta_id FROM public.contas_financeiras LIMIT 1;
    IF v_conta_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Erro: Nenhuma conta financeira encontrada para registrar o lançamento.';
        RETURN;
    END IF;

    -- Cria a descrição do lançamento
    v_descricao_lancamento := 'Ref. ' || v_tipo_lancamento || ' de banco de horas - ' || (SELECT full_name FROM public.funcionarios WHERE id = p_funcionario_id) || ' - Mês ' || to_char(v_mes_referencia, 'MM/YYYY');

    -- Insere o lançamento financeiro
    INSERT INTO public.lancamentos (descricao, valor, data_transacao, tipo, status, conta_id, categoria_id, funcionario_id, empresa_id)
    VALUES (v_descricao_lancamento, v_valor_ajuste, current_date, v_tipo_lancamento, 'Pago', v_conta_id, v_categoria_id, p_funcionario_id, (SELECT empresa_id FROM public.funcionarios WHERE id = p_funcionario_id))
    RETURNING id INTO v_lancamento_id;

    -- Atualiza o registro no banco de horas para "Pago" ou "Descontado"
    UPDATE public.banco_de_horas
    SET 
        status = CASE WHEN p_saldo_minutos > 0 THEN 'Pago' ELSE 'Descontado' END,
        lancamento_id = v_lancamento_id
    WHERE funcionario_id = p_funcionario_id AND mes_referencia = v_mes_referencia;

    RETURN QUERY SELECT TRUE, 'Operação realizada e lançamento financeiro criado com sucesso!';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fundir_cargos(p_ids_origem bigint[], p_id_destino bigint, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- 1. Move os funcionários dos cargos antigos para o novo
    UPDATE public.funcionarios
    SET cargo_id = p_id_destino
    WHERE cargo_id = ANY(p_ids_origem)
    AND organizacao_id = p_organizacao_id;

    -- 2. Deleta os cargos antigos que agora estão vazios
    DELETE FROM public.cargos
    WHERE id = ANY(p_ids_origem)
    AND id <> p_id_destino -- Segurança para não deletar o destino
    AND organizacao_id = p_organizacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.excluir_parcela_e_lancamento(p_parcela_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_lancamento_id BIGINT;
    v_parcela_descricao TEXT;
BEGIN
    -- Etapa 1: Encontrar o ID do lançamento financeiro vinculado à parcela, se houver.
    SELECT lancamento_id, descricao INTO v_lancamento_id, v_parcela_descricao
    FROM contrato_parcelas
    WHERE id = p_parcela_id;

    -- Se não encontrar a parcela, retorna um erro.
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcela com ID % não encontrada.', p_parcela_id;
    END IF;

    -- Etapa 2: Excluir a parcela do cronograma do contrato.
    DELETE FROM contrato_parcelas WHERE id = p_parcela_id;

    -- Etapa 3: Se existir um lançamento vinculado, excluí-lo também.
    IF v_lancamento_id IS NOT NULL THEN
        DELETE FROM lancamentos WHERE id = v_lancamento_id;
        RETURN 'Parcela "' || v_parcela_descricao || '" e seu lançamento financeiro foram excluídos com sucesso.';
    ELSE
        RETURN 'Parcela "' || v_parcela_descricao || '" foi excluída com sucesso (não possuía lançamento financeiro).';
    END IF;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_parcela_com_lancamento(p_parcela_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_categoria_id BIGINT;
    v_conta_id BIGINT;
    v_contrato_info RECORD;
    v_parcela_info RECORD;
    v_novo_lancamento_id BIGINT;
BEGIN
    -- Busca os dados da parcela que está sendo salva/editada
    SELECT * INTO v_parcela_info FROM contrato_parcelas WHERE id = p_parcela_id;

    -- Se a parcela não for "Pendente", não faz nada no financeiro.
    IF v_parcela_info.status_pagamento <> 'Pendente' THEN
        RETURN 'Ação não necessária para parcelas com status "' || v_parcela_info.status_pagamento || '".';
    END IF;

    -- Busca informações do contrato (cliente, empreendimento, empresa)
    SELECT
        c.contato_id,
        c.empreendimento_id,
        emp.empresa_proprietaria_id,
        COALESCE(co.nome, co.razao_social) AS nome_cliente,
        c.numero_contrato
    INTO v_contrato_info
    FROM contratos c
    JOIN contatos co ON c.contato_id = co.id
    JOIN empreendimentos emp ON c.empreendimento_id = emp.id
    WHERE c.id = v_parcela_info.contrato_id;

    -- Garante que a categoria "Vendas" exista
    SELECT id INTO v_categoria_id FROM categorias_financeiras WHERE nome = 'Vendas' AND tipo = 'Receita';
    IF v_categoria_id IS NULL THEN
        INSERT INTO categorias_financeiras (nome, tipo) VALUES ('Vendas', 'Receita') RETURNING id INTO v_categoria_id;
    END IF;

    -- Garante que a conta "Contas a Receber" exista
    SELECT id INTO v_conta_id FROM contas_financeiras WHERE nome = 'Contas a Receber';
    IF v_conta_id IS NULL THEN
        INSERT INTO contas_financeiras (nome, tipo, saldo_inicial) VALUES ('Contas a Receber', 'Outro', 0) RETURNING id INTO v_conta_id;
    END IF;

    -- Lógica principal: Verifica se a parcela JÁ TEM um lançamento vinculado
    IF v_parcela_info.lancamento_id IS NOT NULL THEN
        -- SE TEM: ATUALIZA o lançamento financeiro existente com os novos dados
        UPDATE lancamentos
        SET
            descricao = 'Recebimento: ' || v_parcela_info.descricao || ' | Contrato #' || v_contrato_info.numero_contrato || ' (' || v_contrato_info.nome_cliente || ')',
            valor = v_parcela_info.valor_parcela,
            data_vencimento = v_parcela_info.data_vencimento
        WHERE id = v_parcela_info.lancamento_id;
        RETURN 'Lançamento financeiro vinculado foi atualizado com sucesso!';
    ELSE
        -- SE NÃO TEM: CRIA um novo lançamento financeiro
        INSERT INTO lancamentos (
            descricao, valor, data_vencimento, data_transacao, tipo, status, conta_id, categoria_id,
            favorecido_contato_id, empreendimento_id, empresa_id, observacao
        ) VALUES (
            'Recebimento: ' || v_parcela_info.descricao || ' | Contrato #' || v_contrato_info.numero_contrato || ' (' || v_contrato_info.nome_cliente || ')',
            v_parcela_info.valor_parcela, v_parcela_info.data_vencimento, v_parcela_info.data_vencimento, 'Receita', 'Pendente', v_conta_id, v_categoria_id,
            v_contrato_info.contato_id, v_contrato_info.empreendimento_id, v_contrato_info.empresa_proprietaria_id, 'Lançamento provisionado do Contrato ID ' || v_parcela_info.contrato_id
        ) RETURNING id INTO v_novo_lancamento_id;

        -- Atualiza a parcela com o ID do novo lançamento, criando o vínculo
        UPDATE contrato_parcelas SET lancamento_id = v_novo_lancamento_id WHERE id = p_parcela_id;
        RETURN 'Novo lançamento financeiro criado e vinculado à parcela!';
    END IF;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_conversation_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE sys_chat_messages 
    SET read_at = now()
    WHERE conversation_id = p_conversation_id 
    AND sender_id != p_user_id 
    AND read_at IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_movimentacoes_estoque(p_organizacao_id bigint, p_empreendimento_id bigint, p_termo_busca text DEFAULT NULL::text, p_tipo text DEFAULT 'Todos'::text, p_data_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_data_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_funcionario_id bigint DEFAULT NULL::bigint)
 RETURNS TABLE(id bigint, tipo text, quantidade numeric, data_movimentacao timestamp with time zone, observacao text, pedido_compra_id bigint, material_nome text, unidade_medida text, funcionario_nome text, usuario_nome text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    me.id,
    me.tipo,
    me.quantidade,
    me.data_movimentacao,
    me.observacao,
    me.pedido_compra_id,
    mat.nome as material_nome,
    mat.unidade_medida,
    func.full_name as funcionario_nome,
    u.nome as usuario_nome
  FROM public.movimentacoes_estoque me
  JOIN public.estoque e ON me.estoque_id = e.id
  JOIN public.materiais mat ON e.material_id = mat.id
  LEFT JOIN public.funcionarios func ON me.funcionario_id = func.id
  LEFT JOIN public.usuarios u ON me.usuario_id = u.id
  WHERE
    me.organizacao_id = p_organizacao_id
    AND e.empreendimento_id = p_empreendimento_id
    -- Filtro de Tipo
    AND (p_tipo = 'Todos' OR p_tipo IS NULL OR p_tipo = '' OR me.tipo = p_tipo)
    -- Filtro de Data
    AND (p_data_inicio IS NULL OR me.data_movimentacao >= p_data_inicio)
    AND (p_data_fim IS NULL OR me.data_movimentacao <= p_data_fim)
    -- Filtro de Funcionario
    AND (p_funcionario_id IS NULL OR me.funcionario_id = p_funcionario_id)
    -- BUSCA DE TEXTO INTELIGENTE (Procura no material, obs, funcionario ou usuario)
    AND (
      p_termo_busca IS NULL OR p_termo_busca = '' OR
      (
        mat.nome ILIKE '%' || p_termo_busca || '%' OR
        me.observacao ILIKE '%' || p_termo_busca || '%' OR
        func.full_name ILIKE '%' || p_termo_busca || '%' OR
        u.nome ILIKE '%' || p_termo_busca || '%'
      )
    )
  ORDER BY me.data_movimentacao DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_contacts_and_relink_all_references(p_primary_contact_id bigint, p_secondary_contact_ids bigint[], p_final_data jsonb, p_final_telefones jsonb[], p_final_emails jsonb[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    secondary_id bigint;
BEGIN
    -- Etapa 1: "Transferir a Herança"
    FOREACH secondary_id IN ARRAY p_secondary_contact_ids
    LOOP
        UPDATE public.simulacoes SET corretor_id = p_primary_contact_id WHERE corretor_id = secondary_id;
        UPDATE public.simulacoes SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE public.contratos SET corretor_id = p_primary_contact_id WHERE corretor_id = secondary_id;
        UPDATE public.contratos SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE public.lancamentos SET favorecido_contato_id = p_primary_contact_id WHERE favorecido_contato_id = secondary_id;
        UPDATE public.contatos_no_funil SET corretor_id = p_primary_contact_id WHERE corretor_id = secondary_id;
        UPDATE public.contatos_no_funil SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE public.crm_notas SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE public.activities SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE public.funcionarios SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE public.pedidos_compra_itens SET fornecedor_id = p_primary_contact_id WHERE fornecedor_id = secondary_id;
        UPDATE public.whatsapp_messages SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
        UPDATE public.whatsapp_conversations SET contato_id = p_primary_contact_id WHERE contato_id = secondary_id;
    END LOOP;

    -- Etapa 2: Atualizar os dados do contato principal
    UPDATE public.contatos
    SET
        nome = p_final_data->>'nome',
        razao_social = p_final_data->>'razao_social',
        cpf = p_final_data->>'cpf',
        cnpj = p_final_data->>'cnpj',
        -- ***** AQUI ESTÁ A CORREÇÃO DA CORREÇÃO :) *****
        -- Usando o nome completo e correto do tipo: tipo_contato_enum
        tipo_contato = (p_final_data->>'tipo_contato')::public.tipo_contato_enum
    WHERE id = p_primary_contact_id;

    -- Etapa 3: Limpar e reinserir telefones e e-mails
    DELETE FROM public.telefones WHERE contato_id = p_primary_contact_id;
    DELETE FROM public.emails WHERE contato_id = p_primary_contact_id;

    IF array_length(p_final_telefones, 1) > 0 THEN
        INSERT INTO public.telefones (contato_id, telefone, country_code)
        SELECT p_primary_contact_id, (elem->>'telefone')::text, (elem->>'country_code')::text FROM jsonb_array_elements(array_to_json(p_final_telefones)::jsonb) elem;
    END IF;

    IF array_length(p_final_emails, 1) > 0 THEN
        INSERT INTO public.emails (contato_id, email)
        SELECT p_primary_contact_id, (elem->>'email')::text FROM jsonb_array_elements(array_to_json(p_final_emails)::jsonb) elem;
    END IF;

    -- Etapa 4: Excluir os contatos secundários
    DELETE FROM public.contatos WHERE id = ANY(p_secondary_contact_ids);

    RETURN 'Contatos mesclados com sucesso! Todas as referências foram atualizadas.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.agendar_salario_provisionado(p_funcionario_id bigint, p_mes_competencia date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_funcionario record;
    v_categoria_id bigint;
    v_conta_id bigint;
    v_valor_provisionado numeric;
    v_dias_uteis integer;
    v_data_vencimento date;
    v_valor_diaria_numeric numeric;
    v_salario_base_numeric numeric;
BEGIN
    -- Busca os dados do funcionário que acabou de ser inserido
    SELECT * INTO v_funcionario FROM public.funcionarios WHERE id = p_funcionario_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- Converte os campos de texto (moeda BR) para número
    v_valor_diaria_numeric := COALESCE(NULLIF(REPLACE(REPLACE(v_funcionario.daily_value, '.', ''), ',', '.'), '')::numeric, 0);
    v_salario_base_numeric := COALESCE(NULLIF(REPLACE(REPLACE(v_funcionario.base_salary, '.', ''), ',', '.'), '')::numeric, 0);

    -- Define o valor provisionado
    IF v_valor_diaria_numeric > 0 THEN
        -- Se houver uma função para calcular dias úteis, ela será usada. Caso contrário, assume 22 dias.
        BEGIN
            v_dias_uteis := public.calcular_dias_uteis(p_mes_competencia);
        EXCEPTION WHEN undefined_function THEN
            v_dias_uteis := 22; -- Valor padrão se a função não existir
        END;
        v_valor_provisionado := v_dias_uteis * v_valor_diaria_numeric;
    ELSE
        v_valor_provisionado := v_salario_base_numeric;
    END IF;

    -- Encontra o ID da categoria "Folha de Pagamento"
    SELECT id INTO v_categoria_id 
    FROM public.categorias_financeiras 
    WHERE nome ILIKE 'Folha de Pagamento' AND organizacao_id = v_funcionario.organizacao_id;

    -- Encontra uma conta bancária associada à empresa do funcionário
    SELECT id INTO v_conta_id 
    FROM public.contas_financeiras 
    WHERE empresa_id = v_funcionario.empresa_id AND organizacao_id = v_funcionario.organizacao_id
    LIMIT 1;

    IF v_conta_id IS NULL THEN
        RAISE NOTICE 'Nenhuma conta financeira encontrada para a empresa ID: %. Não foi possível provisionar o salário.', v_funcionario.empresa_id;
        RETURN; -- Não para a execução com erro, apenas avisa e retorna.
    END IF;

    -- Calcula o vencimento para o 5º dia útil do mês seguinte
    v_data_vencimento := (date_trunc('month', p_mes_competencia) + interval '1 month' + interval '4 days')::date;

    -- Insere o lançamento provisionado com a conta_id e a organizacao_id
    INSERT INTO public.lancamentos (
        empresa_id,
        empreendimento_id,
        categoria_id,
        conta_id,
        descricao,
        valor,
        data_vencimento,
        mes_competencia,
        status,
        tipo,
        funcionario_id,
        organizacao_id -- <<< CORREÇÃO APLICADA AQUI
    )
    VALUES (
        v_funcionario.empresa_id,
        v_funcionario.empreendimento_atual_id,
        v_categoria_id,
        v_conta_id,
        'Salário Ref: ' || to_char(p_mes_competencia, 'MM/YYYY') || ' - ' || v_funcionario.full_name,
        v_valor_provisionado,
        v_data_vencimento,
        p_mes_competencia,
        'Pendente',
        'Despesa',
        p_funcionario_id,
        v_funcionario.organizacao_id -- <<< CORREÇÃO APLICADA AQUI
    );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_entrada_pedido_no_estoque(p_pedido_id bigint, p_usuario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_record RECORD;
    v_estoque_id BIGINT;
    v_empreendimento_id BIGINT;
    v_custo_total_anterior NUMERIC;
    v_quantidade_anterior NUMERIC;
    v_novo_custo_medio NUMERIC;
BEGIN
    -- Busca o empreendimento do pedido
    SELECT empreendimento_id INTO v_empreendimento_id
    FROM public.pedidos_compra
    WHERE id = p_pedido_id;

    -- Se não encontrar o pedido ou o empreendimento, encerra a função
    IF v_empreendimento_id IS NULL THEN
        RAISE EXCEPTION 'Pedido de compra ou empreendimento não encontrado.';
    END IF;

    -- Itera sobre cada item do pedido de compra
    FOR item_record IN
        SELECT
            pci.material_id,
            pci.quantidade_solicitada,
            pci.unidade_medida,
            pci.custo_total_real
        FROM
            public.pedidos_compra_itens AS pci
        WHERE
            pci.pedido_compra_id = p_pedido_id AND pci.material_id IS NOT NULL
    LOOP
        -- Tenta encontrar um registro de estoque existente para o material no empreendimento
        SELECT id, quantidade_atual, custo_medio INTO v_estoque_id, v_quantidade_anterior, v_custo_total_anterior
        FROM public.estoque
        WHERE empreendimento_id = v_empreendimento_id AND material_id = item_record.material_id;
        
        -- Garante que valores nulos sejam tratados como zero para o cálculo
        v_quantidade_anterior := COALESCE(v_quantidade_anterior, 0);
        v_custo_total_anterior := COALESCE(v_custo_total_anterior, 0);

        -- Calcula o novo custo médio ponderado, evitando divisão por zero
        IF (v_quantidade_anterior + item_record.quantidade_solicitada) > 0 THEN
            v_custo_total_anterior := (v_quantidade_anterior * v_custo_total_anterior);
            v_novo_custo_medio := (v_custo_total_anterior + COALESCE(item_record.custo_total_real, 0)) / (v_quantidade_anterior + item_record.quantidade_solicitada);
        ELSE
            v_novo_custo_medio := 0;
        END IF;


        IF v_estoque_id IS NOT NULL THEN
            -- Se o item já existe no estoque, atualiza a quantidade e o custo médio
            UPDATE public.estoque
            SET
                quantidade_atual = quantidade_atual + item_record.quantidade_solicitada,
                custo_medio = v_novo_custo_medio,
                ultima_atualizacao = NOW()
            WHERE
                id = v_estoque_id;
        ELSE
            -- Se o item não existe, insere um novo registro no estoque
            INSERT INTO public.estoque (empreendimento_id, material_id, quantidade_atual, unidade_medida, custo_medio)
            VALUES (v_empreendimento_id, item_record.material_id, item_record.quantidade_solicitada, item_record.unidade_medida, (COALESCE(item_record.custo_total_real, 0) / item_record.quantidade_solicitada))
            RETURNING id INTO v_estoque_id;
        END IF;

        -- ***** CORREÇÃO AQUI *****
        -- O tipo da movimentação foi alterado de 'Entrada' para 'Entrada por Compra'
        INSERT INTO public.movimentacoes_estoque (estoque_id, tipo, quantidade, pedido_compra_id, usuario_id)
        VALUES (v_estoque_id, 'Entrada por Compra', item_record.quantidade_solicitada, p_pedido_id, p_usuario_id);

    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.agendar_vale(p_funcionario_id bigint, p_organizacao_id bigint, p_periodo_inicio date, p_periodo_fim date, p_data_pagamento date, p_valor_projetado numeric, p_conta_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    novo_lancamento_id bigint;
    nome_funcionario text;
BEGIN
    -- Busca o nome do funcionário para a descrição do lançamento
    SELECT full_name INTO nome_funcionario FROM public.funcionarios WHERE id = p_funcionario_id;

    -- Cria o lançamento financeiro com o valor projetado
    INSERT INTO public.lancamentos (
        descricao,
        valor,
        tipo,
        status,
        data_transacao,
        data_vencimento,
        data_pagamento,
        funcionario_id,
        favorecido_contato_id,
        conta_id, -- Valor agora vem do parâmetro
        organizacao_id
    )
    VALUES (
        'Adiantamento (Vale) para ' || nome_funcionario,
        p_valor_projetado,
        'Despesa',
        'Pendente',
        p_data_pagamento,
        p_data_pagamento,
        NULL,
        p_funcionario_id,
        (SELECT contato_id FROM public.funcionarios WHERE id = p_funcionario_id),
        p_conta_id, -- Usa o ID da conta recebido
        p_organizacao_id
    ) RETURNING id INTO novo_lancamento_id;

    -- Cria o registro na tabela de controle de vales
    INSERT INTO public.vales_agendados (
        funcionario_id,
        lancamento_id,
        periodo_inicio,
        periodo_fim,
        data_pagamento_agendada,
        valor_projetado,
        organizacao_id
    )
    VALUES (
        p_funcionario_id,
        novo_lancamento_id,
        p_periodo_inicio,
        p_periodo_fim,
        p_data_pagamento,
        p_valor_projetado,
        p_organizacao_id
    );

    RETURN json_build_object('status', 'success', 'message', 'Vale agendado com sucesso!', 'lancamento_id', novo_lancamento_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.regerar_parcelas_contrato(p_contrato_id bigint, p_organizacao_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_simulacao RECORD;
  v_contrato RECORD;
  v_valor_parcela_entrada NUMERIC;
  v_valor_parcela_obra NUMERIC;
  v_total_gerado NUMERIC := 0;
  v_saldo_remanescente NUMERIC;
  v_ultima_data DATE;
  i INT;
BEGIN
  -- 1. Obter dados do contrato e do plano de pagamento (simulação) vinculado
  SELECT * INTO v_contrato FROM public.contratos WHERE id = p_contrato_id AND organizacao_id = p_organizacao_id;
  IF v_contrato.id IS NULL THEN RETURN 'Erro: Contrato não encontrado.'; END IF;

  SELECT * INTO v_simulacao FROM public.simulacoes WHERE contrato_id = v_contrato.id;
  IF v_simulacao.id IS NULL THEN RETURN 'Erro: Plano de pagamento não encontrado para este contrato.'; END IF;

  -- 2. Limpar parcelas pendentes antigas para começar do zero.
  DELETE FROM public.contrato_parcelas WHERE contrato_id = p_contrato_id AND status_pagamento = 'Pendente';

  -- 3. Gerar as parcelas da ENTRADA
  IF v_simulacao.entrada_valor > 0 AND v_simulacao.num_parcelas_entrada > 0 AND v_simulacao.data_primeira_parcela_entrada IS NOT NULL THEN
    v_valor_parcela_entrada := v_simulacao.entrada_valor / v_simulacao.num_parcelas_entrada;
    FOR i IN 1..v_simulacao.num_parcelas_entrada LOOP
      INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
      VALUES (
        p_contrato_id,
        'Entrada - Parcela ' || i || '/' || v_simulacao.num_parcelas_entrada,
        'Entrada',
        v_simulacao.data_primeira_parcela_entrada + ((i-1) || ' months')::interval,
        v_valor_parcela_entrada,
        p_organizacao_id
      );
    END LOOP;
    v_total_gerado := v_total_gerado + v_simulacao.entrada_valor;
  END IF;

  -- 4. Gerar as parcelas de OBRA
  IF v_simulacao.parcelas_obra_valor > 0 AND v_simulacao.num_parcelas_obra > 0 AND v_simulacao.data_primeira_parcela_obra IS NOT NULL THEN
    v_valor_parcela_obra := v_simulacao.parcelas_obra_valor / v_simulacao.num_parcelas_obra;
    FOR i IN 1..v_simulacao.num_parcelas_obra LOOP
      INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
      VALUES (
        p_contrato_id,
        'Obra - Parcela ' || i || '/' || v_simulacao.num_parcelas_obra,
        'Obra',
        v_simulacao.data_primeira_parcela_obra + ((i-1) || ' months')::interval,
        v_valor_parcela_obra,
        p_organizacao_id
      );
    END LOOP;
    v_total_gerado := v_total_gerado + v_simulacao.parcelas_obra_valor;
  END IF;

  -- 5. Calcular e gerar a parcela do SALDO REMANESCENTE
  v_saldo_remanescente := v_contrato.valor_final_venda - v_total_gerado;

  IF v_saldo_remanescente > 0.01 THEN
    SELECT MAX(data_vencimento) INTO v_ultima_data
    FROM public.contrato_parcelas
    WHERE contrato_id = p_contrato_id;

    IF v_ultima_data IS NULL THEN
        v_ultima_data := v_contrato.data_venda + interval '30 days';
    ELSE
        v_ultima_data := v_ultima_data + interval '1 month';
    END IF;

    INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
    VALUES (
      p_contrato_id,
      'Saldo Remanescente (Chaves)',
      'Saldo Remanescente',
      v_ultima_data,
      v_saldo_remanescente,
      p_organizacao_id
    );
  END IF;

  RETURN 'Cronograma de parcelas recalculado com sucesso, incluindo o Saldo Remanescente.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_user_organizacao_id()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    org_id BIGINT;
BEGIN
    SELECT COALESCE(
        (SELECT organizacao_id FROM public.usuarios WHERE id = auth.uid()),
        (SELECT (auth.jwt()->>'user_metadata')::jsonb->>'organizacao_id')::BIGINT
    ) INTO org_id;
    RETURN org_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_auditoria_folha(p_organizacao_id bigint, p_data_inicio text, p_data_fim text)
 RETURNS TABLE(out_funcionario_id bigint, out_nome text, out_cargo text, out_modelo_contratacao text, out_salario_base numeric, out_valor_diaria numeric, out_dias_uteis_previstos numeric, out_dias_trabalhados_reais numeric, out_dias_faltas numeric, out_dias_abonados numeric, out_dias_extras numeric, out_horas_previstas text, out_horas_trabalhadas text, out_horas_extras text, out_custo_previsto numeric, out_observacao text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_inicio date := to_date(p_data_inicio, 'YYYY-MM-DD');
  v_fim date := to_date(p_data_fim, 'YYYY-MM-DD');
  
  r_func record;
  v_inicio_efetivo date;
  v_fim_efetivo date;
  v_dia_loop date;
  v_dow int;
  
  -- Variáveis de Jornada e Ponto
  v_jornada_ent time;
  v_jornada_sai time;
  v_jornada_sai_int time;
  v_jornada_vol_int time;
  v_minutos_dia_previsto numeric;
  
  v_pt_ent timestamp;
  v_pt_sai timestamp;
  v_pt_ini_int timestamp;
  v_pt_fim_int timestamp;
  v_minutos_dia_trabalhado numeric;
  
  v_eh_feriado boolean;
  v_tipo_feriado text;
  v_tem_jornada boolean;
  v_bateu_ponto boolean;
  v_tem_abono boolean;
  
  -- Acumuladores
  v_acc_dias_previstos numeric;
  v_acc_dias_trabalhados numeric;
  v_acc_dias_faltas numeric;
  v_acc_dias_abonos numeric;
  v_acc_dias_extras numeric;         -- Novo Acumulador
  v_acc_minutos_previstos numeric;
  v_acc_minutos_trabalhados numeric;
  v_acc_minutos_extras numeric;      -- Novo Acumulador
  v_acc_custo numeric;
  
  v_obs text;
  v_modelo text;
  v_valor_dia_base numeric;
  v_custo_extra numeric;

BEGIN
  FOR r_func IN
    SELECT 
      f.id, 
      f.full_name,
      COALESCE(c.nome, 'Cargo não definido') as cargo_nome,
      f.admission_date, 
      f.demission_date,
      f.jornada_id,
      h.salario_base, 
      h.valor_diaria
    FROM funcionarios f
    LEFT JOIN cargos c ON f.cargo_id = c.id
    LEFT JOIN LATERAL (
      SELECT hs.salario_base, hs.valor_diaria 
      FROM historico_salarial hs 
      WHERE hs.funcionario_id = f.id 
      ORDER BY hs.data_inicio_vigencia DESC LIMIT 1
    ) h ON true
    WHERE f.organizacao_id = p_organizacao_id
      AND f.status = 'Ativo'
      AND (f.demission_date IS NULL OR f.demission_date >= v_inicio)
      AND (f.admission_date <= v_fim::text)
    ORDER BY f.full_name
  LOOP
    
    -- Reset dos acumuladores
    v_acc_dias_previstos := 0;
    v_acc_dias_trabalhados := 0;
    v_acc_dias_faltas := 0;
    v_acc_dias_abonos := 0;
    v_acc_dias_extras := 0;
    v_acc_minutos_previstos := 0;
    v_acc_minutos_trabalhados := 0;
    v_acc_minutos_extras := 0;
    v_obs := '';

    v_inicio_efetivo := GREATEST(v_inicio, r_func.admission_date::date);
    IF r_func.demission_date IS NOT NULL THEN
       v_fim_efetivo := LEAST(v_fim, r_func.demission_date::date);
    ELSE
       v_fim_efetivo := v_fim;
    END IF;

    if v_inicio_efetivo > v_inicio THEN v_obs := v_obs || 'Admissão recente. '; END IF;
    if v_fim_efetivo < v_fim THEN v_obs := v_obs || 'Desligamento. '; END IF;

    -- === LOOP DOS DIAS ===
    v_dia_loop := v_inicio_efetivo;
    
    WHILE v_dia_loop <= v_fim_efetivo LOOP
      v_dow := EXTRACT(DOW FROM v_dia_loop); 
      v_minutos_dia_previsto := 0;
      v_minutos_dia_trabalhado := 0;
      
      -- 1. Verifica Feriado
      SELECT tipo INTO v_tipo_feriado FROM feriados WHERE organizacao_id = p_organizacao_id AND data_feriado = v_dia_loop;
      
      -- 2. Verifica Jornada Prevista
      SELECT horario_entrada, horario_saida, horario_saida_intervalo, horario_volta_intervalo 
      INTO v_jornada_ent, v_jornada_sai, v_jornada_sai_int, v_jornada_vol_int
      FROM jornada_detalhes 
      WHERE jornada_id = r_func.jornada_id AND dia_semana = v_dow;
      
      v_tem_jornada := (v_jornada_ent IS NOT NULL);

      -- 3. Busca Ponto do Dia
      SELECT 
         MAX(CASE WHEN tipo_registro = 'Entrada' THEN data_hora END),
         MAX(CASE WHEN tipo_registro = 'Saida' THEN data_hora END),
         MAX(CASE WHEN tipo_registro = 'Inicio_Intervalo' THEN data_hora END),
         MAX(CASE WHEN tipo_registro = 'Fim_Intervalo' THEN data_hora END)
      INTO v_pt_ent, v_pt_sai, v_pt_ini_int, v_pt_fim_int
      FROM pontos p
      WHERE p.funcionario_id = r_func.id AND p.data_hora::date = v_dia_loop;

      v_bateu_ponto := (v_pt_ent IS NOT NULL);

      -- 4. Calcula Minutos Trabalhados (Se houver ponto)
      IF v_bateu_ponto THEN
         -- Manhã
         IF v_pt_ent IS NOT NULL THEN
            IF v_pt_ini_int IS NOT NULL THEN
               v_minutos_dia_trabalhado := v_minutos_dia_trabalhado + (EXTRACT(EPOCH FROM (v_pt_ini_int - v_pt_ent)) / 60);
            ELSIF v_pt_sai IS NOT NULL AND v_pt_fim_int IS NULL THEN
               v_minutos_dia_trabalhado := v_minutos_dia_trabalhado + (EXTRACT(EPOCH FROM (v_pt_sai - v_pt_ent)) / 60);
            END IF;
         END IF;
         -- Tarde
         IF v_pt_fim_int IS NOT NULL AND v_pt_sai IS NOT NULL THEN
             v_minutos_dia_trabalhado := v_minutos_dia_trabalhado + (EXTRACT(EPOCH FROM (v_pt_sai - v_pt_fim_int)) / 60);
         END IF;
         IF v_minutos_dia_trabalhado < 0 THEN v_minutos_dia_trabalhado := 0; END IF;
      END IF;

      -- === CENÁRIO A: DIA NORMAL DE TRABALHO ===
      IF v_tem_jornada AND (v_tipo_feriado IS DISTINCT FROM 'Integral') THEN
         
         -- Calcula Minutos Previstos
         v_minutos_dia_previsto := (EXTRACT(EPOCH FROM (v_jornada_sai - v_jornada_ent)) / 60);
         IF v_jornada_vol_int IS NOT NULL AND v_jornada_sai_int IS NOT NULL THEN
            v_minutos_dia_previsto := v_minutos_dia_previsto - (EXTRACT(EPOCH FROM (v_jornada_vol_int - v_jornada_sai_int)) / 60);
         END IF;

         -- Ajuste Meio Período
         IF v_tipo_feriado = 'Meio Período' THEN 
            v_acc_dias_previstos := v_acc_dias_previstos + 0.5;
            v_minutos_dia_previsto := v_minutos_dia_previsto / 2;
         ELSE
            v_acc_dias_previstos := v_acc_dias_previstos + 1;
         END IF;
         v_acc_minutos_previstos := v_acc_minutos_previstos + v_minutos_dia_previsto;

         -- Verifica Status (Presença/Falta/Abono)
         SELECT EXISTS(SELECT 1 FROM abonos a WHERE a.funcionario_id = r_func.id AND a.data_abono = v_dia_loop) INTO v_tem_abono;

         IF v_bateu_ponto THEN
            -- TRABALHOU NORMAL
            IF v_tipo_feriado = 'Meio Período' THEN v_acc_dias_trabalhados := v_acc_dias_trabalhados + 0.5;
            ELSE v_acc_dias_trabalhados := v_acc_dias_trabalhados + 1; END IF;
            v_acc_minutos_trabalhados := v_acc_minutos_trabalhados + v_minutos_dia_trabalhado;
         ELSIF v_tem_abono THEN
            -- ABONADO
            IF v_tipo_feriado = 'Meio Período' THEN v_acc_dias_abonos := v_acc_dias_abonos + 0.5;
            ELSE v_acc_dias_abonos := v_acc_dias_abonos + 1; END IF;
         ELSE
            -- FALTOU
            IF v_tipo_feriado = 'Meio Período' THEN v_acc_dias_faltas := v_acc_dias_faltas + 0.5;
            ELSE v_acc_dias_faltas := v_acc_dias_faltas + 1; END IF;
         END IF;

      -- === CENÁRIO B: DIA EXTRA (Fora da Jornada ou Feriado) ===
      ELSIF v_bateu_ponto THEN
         -- Trabalhou num dia que não devia (Sábado, Domingo ou Feriado)
         v_acc_dias_extras := v_acc_dias_extras + 1; -- Conta como 1 dia extra
         v_acc_minutos_extras := v_acc_minutos_extras + v_minutos_dia_trabalhado;
         v_acc_minutos_trabalhados := v_acc_minutos_trabalhados + v_minutos_dia_trabalhado;
      END IF;

      v_dia_loop := v_dia_loop + 1;
    END LOOP;

    -- 5. CÁLCULO FINANCEIRO FINAL
    v_acc_custo := 0;
    v_valor_dia_base := 0;

    -- Define o valor do dia base
    IF COALESCE(r_func.valor_diaria, 0) > 0 THEN
       v_modelo := 'Diarista';
       v_valor_dia_base := r_func.valor_diaria;
       
       -- DIARISTA:
       -- Ganha pelos dias trabalhados (Jornada) + Abonos
       v_acc_custo := (v_acc_dias_trabalhados + v_acc_dias_abonos) * v_valor_dia_base;

    ELSIF COALESCE(r_func.salario_base, 0) > 0 THEN
       v_modelo := 'Mensalista';
       
       DECLARE
         v_dias_contrato int := (v_fim_efetivo - v_inicio_efetivo) + 1;
       BEGIN
         IF v_dias_contrato > 30 THEN v_dias_contrato := 30; END IF;
         v_valor_dia_base := (r_func.salario_base / 30.0);
         
         -- MENSALISTA:
         -- Salário Proporcional - Desconto de Faltas
         v_acc_custo := (v_dias_contrato * v_valor_dia_base) - (v_acc_dias_faltas * v_valor_dia_base);
       END;
    ELSE
       v_modelo := 'Sem Valor';
    END IF;

    -- === ADICIONAL DE EXTRAS (1.5x) ===
    -- Independente se é Mensalista ou Diarista, o dia extra vale 1.5x o dia normal
    v_custo_extra := (v_acc_dias_extras * v_valor_dia_base * 1.5);
    v_acc_custo := v_acc_custo + v_custo_extra;

    -- Preenche retorno
    out_funcionario_id := r_func.id;
    out_nome := r_func.full_name;
    out_cargo := r_func.cargo_nome;
    out_modelo_contratacao := v_modelo;
    out_salario_base := COALESCE(r_func.salario_base, 0);
    out_valor_diaria := COALESCE(r_func.valor_diaria, 0);
    
    out_dias_uteis_previstos := v_acc_dias_previstos;
    out_dias_trabalhados_reais := v_acc_dias_trabalhados;
    out_dias_faltas := v_acc_dias_faltas;
    out_dias_abonados := v_acc_dias_abonos;
    out_dias_extras := v_acc_dias_extras;  -- Retorna os dias extras
    
    out_horas_previstas := TO_CHAR((v_acc_minutos_previstos || ' minutes')::interval, 'HH24:MI');
    out_horas_trabalhadas := TO_CHAR((v_acc_minutos_trabalhados || ' minutes')::interval, 'HH24:MI');
    out_horas_extras := TO_CHAR((v_acc_minutos_extras || ' minutes')::interval, 'HH24:MI');
    
    out_custo_previsto := ROUND(GREATEST(v_acc_custo, 0), 2);
    out_observacao := TRIM(v_obs);
    
    RETURN NEXT;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_organizacao_id()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT organizacao_id FROM public.usuarios WHERE id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_historico_vgv_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_vgv_novo NUMERIC;
    v_vgv_anterior NUMERIC;
BEGIN
    -- Se o valor_venda_calculado não mudou, apenas retorna sem engatilhar
    IF OLD.valor_venda_calculado IS NOT DISTINCT FROM NEW.valor_venda_calculado THEN
        RETURN NEW;
    END IF;

    -- Calcula o novo VGV do Empreendimento somando todos os produtos atuais dele no banco
    SELECT COALESCE(SUM(valor_venda_calculado), 0) INTO v_vgv_novo
    FROM public.produtos_empreendimento
    WHERE empreendimento_id = NEW.empreendimento_id;

    -- O VGV antigo é o novo VGV matematicamente subtraído da troca de peso deste produto
    v_vgv_anterior := v_vgv_novo - COALESCE(NEW.valor_venda_calculado, 0) + COALESCE(OLD.valor_venda_calculado, 0);

    -- Insere o registro de auditoria no histórico
    INSERT INTO public.historico_vgv (
        empreendimento_id,
        produto_id,
        valor_produto_anterior,
        valor_produto_novo,
        vgv_anterior,
        vgv_novo,
        organizacao_id,
        usuario_alteracao
    ) VALUES (
        NEW.empreendimento_id,
        NEW.id,
        OLD.valor_venda_calculado,
        NEW.valor_venda_calculado,
        v_vgv_anterior,
        v_vgv_novo,
        NEW.organizacao_id,
        auth.uid()
    );

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_saldo_atual_conta(p_conta_id bigint, p_organizacao_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    saldo_total NUMERIC;
    saldo_inicial_conta NUMERIC;
BEGIN
    -- Pega o saldo inicial da conta
    SELECT COALESCE(saldo_inicial, 0)
    INTO saldo_inicial_conta
    FROM public.contas_financeiras
    WHERE id = p_conta_id AND organizacao_id = p_organizacao_id;

    -- Calcula a soma de todas as transações pagas/conciliadas para a conta
    SELECT
        saldo_inicial_conta + 
        COALESCE(SUM(
            CASE
                WHEN tipo = 'Receita' THEN valor
                WHEN tipo = 'Despesa' THEN -valor
                ELSE 0
            END
        ), 0)
    INTO saldo_total
    FROM public.lancamentos
    WHERE conta_id = p_conta_id
      AND organizacao_id = p_organizacao_id
      AND (status = 'Pago' OR status = 'Conciliado');

    RETURN saldo_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_corretores_com_contrato(p_organizacao_id bigint)
 RETURNS TABLE(id bigint, nome text, razao_social text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        c.id,
        c.nome,
        c.razao_social
    FROM
        public.contatos c
    JOIN
        public.contratos co ON c.id = co.corretor_id
    WHERE
        c.organizacao_id = p_organizacao_id
        AND co.organizacao_id = p_organizacao_id
        AND co.corretor_id IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.excluir_contrato_e_liberar_unidade(p_contrato_id bigint, p_organizacao_id bigint)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_produto_id bigint;
    v_parcelas_pagas_count integer;
BEGIN
    -- Verifica se o contrato pertence à organização correta
    IF NOT EXISTS (
        SELECT 1 FROM public.contratos
        WHERE id = p_contrato_id AND organizacao_id = p_organizacao_id
    ) THEN
        RAISE EXCEPTION 'Contrato não encontrado ou não pertence à sua organização.';
    END IF;

    -- O PORQUÊ DA MUDANÇA: Adicionamos uma verificação de segurança crucial.
    -- A função agora verifica se existem parcelas com status 'Pago' ou 'Conciliado'.
    SELECT count(*)
    INTO v_parcelas_pagas_count
    FROM public.contrato_parcelas
    WHERE contrato_id = p_contrato_id
      AND (status_pagamento = 'Pago' OR status_pagamento = 'Conciliado');

    -- Se houver UMA ou mais parcelas pagas, a função gera um erro e para.
    IF v_parcelas_pagas_count > 0 THEN
        RAISE EXCEPTION 'Não é possível excluir um contrato que possui parcelas pagas.';
    END IF;

    -- Se passou pela verificação, continua com a lógica original...
    -- Pega o ID do produto associado ao contrato
    SELECT produto_id INTO v_produto_id
    FROM public.contratos
    WHERE id = p_contrato_id;

    -- Exclui o contrato (o CASCADE cuidará das parcelas e anexos)
    DELETE FROM public.contratos WHERE id = p_contrato_id;

    -- Se encontrou um produto, libera a unidade
    IF v_produto_id IS NOT NULL THEN
        UPDATE public.produtos_empreendimento
        SET status = 'Disponível'
        WHERE id = v_produto_id;
    END IF;

    RETURN 'Contrato excluído e unidade liberada com sucesso!';
EXCEPTION
    WHEN OTHERS THEN
        -- Retorna a mensagem de erro específica para o frontend
        RETURN 'Erro ao excluir: ' || SQLERRM;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_funcao_id()
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    funcao_id_result BIGINT;
BEGIN
    -- Busca o funcao_id na tabela usuarios usando o ID do usuário autenticado (auth.uid())
    SELECT
        funcao_id
    INTO
        funcao_id_result
    FROM
        public.usuarios
    WHERE
        id = auth.uid(); -- auth.uid() é uma função especial do Supabase que retorna o ID do usuário logado

    -- Retorna o ID encontrado ou NULL se não encontrar
    RETURN funcao_id_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_merge_contacts_and_relink(p_contact_ids bigint[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_primary_contact_id bigint;
    v_secondary_contact_ids bigint[];
    v_final_data jsonb;
    v_final_telefones jsonb[];
    v_final_emails jsonb[];
BEGIN
    -- Se o array de entrada tiver 1 ou 0 contatos, não há nada a fazer.
    IF array_length(p_contact_ids, 1) <= 1 THEN
        RETURN 'Não há contatos suficientes para mesclar.';
    END IF;

    -- Define o contato mais antigo como o principal
    SELECT id INTO v_primary_contact_id FROM public.contatos WHERE id = ANY(p_contact_ids) ORDER BY created_at ASC LIMIT 1;
    
    -- Os demais são secundários. 
    -- ***** AQUI ESTÁ A CORREÇÃO *****
    -- Usamos COALESCE para garantir que, se não houver secundários, teremos um array vazio '{}' em vez de NULL.
    SELECT COALESCE(array_agg(id), '{}') INTO v_secondary_contact_ids FROM public.contatos WHERE id = ANY(p_contact_ids) AND id <> v_primary_contact_id;

    -- Pega os dados do contato principal como base
    SELECT to_jsonb(c.*) INTO v_final_data FROM public.contatos c WHERE id = v_primary_contact_id;

    -- Junta todos os telefones e e-mails únicos de todos os contatos
    SELECT array_agg(DISTINCT to_jsonb(t.*)) INTO v_final_telefones FROM public.telefones t WHERE t.contato_id = ANY(p_contact_ids);
    SELECT array_agg(DISTINCT to_jsonb(e.*)) INTO v_final_emails FROM public.emails e WHERE e.contato_id = ANY(p_contact_ids);

    -- Chama a nossa função principal com os dados preparados
    RETURN public.merge_contacts_and_relink_all_references(
        v_primary_contact_id,
        v_secondary_contact_ids,
        v_final_data,
        v_final_telefones,
        v_final_emails
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_all_contact_meta_names()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    updated_count integer;
BEGIN
    WITH updated_rows AS (
        UPDATE public.contatos c
        SET
            meta_ad_name = ma.name,
            meta_campaign_name = mc.name,
            -- Garante que o ID da campanha seja preenchido se estiver faltando
            meta_campaign_id = COALESCE(c.meta_campaign_id, ma.campaign_id)
        FROM
            public.meta_ads AS ma
        LEFT JOIN
            public.meta_campaigns AS mc ON ma.campaign_id = mc.id
        WHERE
            c.meta_ad_id = ma.id
            -- Apenas atualiza se o nome do anúncio ou da campanha estiverem vazios
            AND (c.meta_ad_name IS NULL OR c.meta_campaign_name IS NULL)
        RETURNING c.id
    )
    SELECT count(*) INTO updated_count FROM updated_rows;

    RETURN 'Atualização concluída. ' || updated_count || ' contatos foram atualizados.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE id = auth.uid() AND is_superadmin = true
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.importar_registros_ponto_se_vazio(novos_registros jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    registro jsonb;
    dia_registro date;
    tipo_registro_txt text;
    funcionario_id_int bigint;
    ponto_existente int;
BEGIN
    -- Itera sobre cada registro de ponto enviado pelo frontend
    FOR registro IN SELECT * FROM jsonb_array_elements(novos_registros)
    LOOP
        -- Extrai os dados de cada registro
        dia_registro := (registro->>'data_hora')::date;
        tipo_registro_txt := registro->>'tipo_registro';
        funcionario_id_int := (registro->>'funcionario_id')::bigint;

        -- Verifica se já existe uma batida daquele tipo, para aquele funcionário, naquele dia
        SELECT count(*)
        INTO ponto_existente
        FROM public.pontos p
        WHERE p.funcionario_id = funcionario_id_int
          AND p.tipo_registro = tipo_registro_txt
          AND p.data_hora::date = dia_registro;

        -- Se o campo estiver vazio (não existe batida), insere o novo registro
        IF ponto_existente = 0 THEN
            INSERT INTO public.pontos (
                funcionario_id,
                data_hora,
                tipo_registro,
                observacao,
                organizacao_id -- <-- O campo de segurança
            )
            VALUES (
                (registro->>'funcionario_id')::bigint,
                (registro->>'data_hora')::timestamp,
                (registro->>'tipo_registro')::text,
                (registro->>'observacao')::text,
                (registro->>'organizacao_id')::bigint -- <-- O valor de segurança, agora lido do payload
            );
        END IF;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_entrada_pedido_no_estoque(p_pedido_id bigint, p_usuario_id uuid, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    item_row RECORD;
    v_empreendimento_id bigint;
    v_estoque_id bigint;
BEGIN
    -- Busca o ID do empreendimento do pedido.
    SELECT empreendimento_id INTO v_empreendimento_id
    FROM public.pedidos_compra
    WHERE id = p_pedido_id AND organizacao_id = p_organizacao_id;

    IF v_empreendimento_id IS NULL THEN
        RAISE WARNING 'Empreendimento não encontrado para o pedido %', p_pedido_id;
        RETURN;
    END IF;

    -- Itera sobre cada item do pedido.
    -- CORREÇÃO: Nomes das colunas ajustados para 'material_id' e 'quantidade_solicitada'.
    FOR item_row IN
        SELECT
            pi.material_id,
            pi.quantidade_solicitada,
            pi.unidade_medida
        FROM public.pedidos_compra_itens AS pi
        WHERE pi.pedido_compra_id = p_pedido_id
    LOOP
        -- Etapa crucial: Verifica se o item já existe no estoque deste empreendimento.
        SELECT id INTO v_estoque_id
        FROM public.estoque
        WHERE empreendimento_id = v_empreendimento_id
          AND material_id = item_row.material_id
          AND organizacao_id = p_organizacao_id;

        -- Se não existir, CRIA o registro no estoque central.
        IF v_estoque_id IS NULL THEN
            INSERT INTO public.estoque (empreendimento_id, material_id, unidade_medida, organizacao_id)
            VALUES (v_empreendimento_id, item_row.material_id, item_row.unidade_medida, p_organizacao_id)
            RETURNING id INTO v_estoque_id;
        END IF;

        -- Insere a movimentação de ENTRADA, agora com o ID de estoque correto.
        -- CORREÇÃO: Nomes da tabela e colunas ajustados.
        INSERT INTO public.movimentacoes_estoque (
            estoque_id,
            tipo,
            quantidade,
            data_movimentacao,
            pedido_compra_id,
            usuario_id,
            observacao,
            organizacao_id
        )
        VALUES (
            v_estoque_id,
            'Entrada por Compra', -- Valor conforme o CHECK da sua tabela
            item_row.quantidade_solicitada,
            CURRENT_TIMESTAMP,
            p_pedido_id,
            p_usuario_id,
            'Entrada referente ao Pedido de Compra #' || p_pedido_id,
            p_organizacao_id
        );
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.provisionar_parcelas_contrato(p_contrato_id bigint, p_organizacao_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_parcela RECORD;
  v_contrato RECORD;
  v_empreendimento RECORD;
  v_categoria_id BIGINT;
  v_lancamento_id BIGINT;
  v_parcelas_criadas_count INT := 0;
  v_cliente_nome TEXT;
BEGIN
  -- 1. Buscar os detalhes essenciais do contrato
  SELECT *
  INTO v_contrato
  FROM public.contratos
  WHERE id = p_contrato_id AND organizacao_id = p_organizacao_id;

  IF v_contrato.id IS NULL THEN
    RETURN 'Erro: Contrato não encontrado.';
  END IF;

  IF v_contrato.contato_id IS NULL THEN
    RETURN 'Erro: O contrato precisa ter um cliente (comprador) definido.';
  END IF;

  IF v_contrato.conta_bancaria_id IS NULL THEN
    RETURN 'Erro: Defina uma "Conta Bancária para Pagamentos" nos detalhes da venda do contrato.';
  END IF;

  -- Adiciona busca por detalhes do empreendimento para pegar o ID da empresa
  SELECT *
  INTO v_empreendimento
  FROM public.empreendimentos
  WHERE id = v_contrato.empreendimento_id;

  IF v_empreendimento.id IS NULL THEN
      RETURN 'Erro: Empreendimento associado ao contrato não foi encontrado.';
  END IF;
  
  -- Buscar o nome do cliente
  SELECT COALESCE(nome, razao_social)
  INTO v_cliente_nome
  FROM public.contatos
  WHERE id = v_contrato.contato_id;

  -- 2. Buscar o ID da categoria financeira
  SELECT id INTO v_categoria_id
  FROM public.categorias_financeiras
  WHERE nome = 'Venda de Imóvel' AND tipo = 'Receita' AND organizacao_id = p_organizacao_id;

  IF v_categoria_id IS NULL THEN
    RETURN 'Erro: Categoria financeira "Venda de Imóvel" do tipo "Receita" não encontrada.';
  END IF;

  -- 3. Inicia o loop para processar parcelas
  FOR v_parcela IN
    SELECT id, descricao, valor_parcela, data_vencimento
    FROM public.contrato_parcelas
    WHERE contrato_id = p_contrato_id
      AND organizacao_id = p_organizacao_id
      AND status_pagamento = 'Pendente'
      AND lancamento_id IS NULL
  LOOP
    -- 4. Insere o novo lançamento
    INSERT INTO public.lancamentos (
      descricao,
      valor,
      data_vencimento,
      data_transacao,
      tipo,
      status,
      conta_id,
      categoria_id,
      empreendimento_id,
      empresa_id,
      favorecido_contato_id,
      organizacao_id,
      criado_por_usuario_id,
      contrato_id,
      observacao
    )
    VALUES (
      'Recebimento: ' || v_parcela.descricao || ' | Contrato #' || p_contrato_id || ' (' || COALESCE(v_cliente_nome, 'N/A') || ')',
      v_parcela.valor_parcela,
      v_parcela.data_vencimento,
      CURRENT_DATE,
      'Receita',
      'Pendente',
      v_contrato.conta_bancaria_id,
      v_categoria_id,
      v_contrato.empreendimento_id,
      v_empreendimento.empresa_proprietaria_id,
      v_contrato.contato_id,
      p_organizacao_id,
      auth.uid(),
      p_contrato_id,
      'Lançamento provisionado do Contrato ID ' || p_contrato_id
    )
    RETURNING id INTO v_lancamento_id;

    -- 5. Atualiza a parcela
    UPDATE public.contrato_parcelas
    SET lancamento_id = v_lancamento_id
    WHERE id = v_parcela.id;

    v_parcelas_criadas_count := v_parcelas_criadas_count + 1;
  END LOOP;

  -- 6. Retorna uma mensagem de sucesso
  IF v_parcelas_criadas_count > 0 THEN
    RETURN 'Sucesso: ' || v_parcelas_criadas_count || ' lançamento(s) financeiro(s) foram provisionados.';
  ELSE
    RETURN 'Nenhuma parcela pendente para sincronizar.';
  END IF;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.garantir_simulacao_para_contrato(p_contrato_id bigint, p_organizacao_id bigint)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    simulacao_rec record;
BEGIN
    SELECT * INTO simulacao_rec FROM public.simulacoes WHERE contrato_id = p_contrato_id LIMIT 1;
    IF FOUND THEN
        RETURN row_to_json(simulacao_rec);
    END IF;

    INSERT INTO public.simulacoes (
        contrato_id, contato_id, empreendimento_id, corretor_id,
        valor_venda, status, organizacao_id, produto_id
    )
    SELECT
        id, contato_id, empreendimento_id, corretor_id,
        valor_final_venda, 'Aprovado', organizacao_id,
        (SELECT produto_id FROM public.contrato_produtos WHERE contrato_id = p_contrato_id LIMIT 1)
    FROM public.contratos
    WHERE id = p_contrato_id AND organizacao_id = p_organizacao_id
    RETURNING * INTO simulacao_rec;

    UPDATE public.contratos SET simulacao_id = simulacao_rec.id WHERE id = p_contrato_id;
    RETURN row_to_json(simulacao_rec);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_broadcast_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reabrir_mes_ponto(p_funcionario_id bigint, p_mes_referencia date, p_organizacao_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    fechamento_rec record;
    lancamento_rec record;
BEGIN
    -- 1. Encontrar o registro de fechamento em banco_de_horas
    SELECT * INTO fechamento_rec
    FROM public.banco_de_horas
    WHERE funcionario_id = p_funcionario_id
      AND mes_referencia = p_mes_referencia
      AND organizacao_id = p_organizacao_id;

    -- Se não encontrar, informa que não há o que reabrir
    IF NOT FOUND THEN
        RETURN 'Nenhum fechamento encontrado para este mês e funcionário.';
    END IF;

    -- 2. Verificar se existe um lançamento financeiro associado
    IF fechamento_rec.lancamento_id IS NOT NULL THEN
        -- Reverte o lançamento para 'Pendente' se ele foi marcado como 'Pago'
        UPDATE public.lancamentos
        SET status = 'Pendente', data_pagamento = NULL
        WHERE id = fechamento_rec.lancamento_id
          AND organizacao_id = p_organizacao_id;
    END IF;

    -- 3. Excluir o registro de fechamento do banco de horas
    DELETE FROM public.banco_de_horas
    WHERE id = fechamento_rec.id;

    RETURN 'Mês reaberto com sucesso!';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_contato_completo(p_contato_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- 1. Desassocia o contato como corretor das simulações
    -- Isso evita o erro de chave estrangeira que você encontrou
    UPDATE public.simulacoes
    SET corretor_id = NULL
    WHERE corretor_id = p_contato_id;

    -- 2. Desassocia o contato como cliente principal das simulações
    UPDATE public.simulacoes
    SET contato_id = NULL
    WHERE contato_id = p_contato_id;

    -- 3. Remove o contato de qualquer funil de vendas
    DELETE FROM public.contatos_no_funil
    WHERE contato_id = p_contato_id;
    
    -- 4. Deleta os registros associados em outras tabelas (telefones, emails, etc.)
    DELETE FROM public.telefones
    WHERE contato_id = p_contato_id;

    DELETE FROM public.emails
    WHERE contato_id = p_contato_id;

    -- Adicione aqui outras tabelas que tenham relação direta se necessário
    -- Ex: DELETE FROM public.crm_notas WHERE contato_id = p_contato_id;

    -- 5. Finalmente, deleta o contato da tabela principal
    DELETE FROM public.contatos
    WHERE id = p_contato_id;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_kpi_generico(p_organizacao_id bigint, p_tabela_fonte text, p_operacao text, p_coluna_alvo text, p_filtros jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    query_sql TEXT;
    resultado NUMERIC;
    filtro_chave TEXT;
    filtro_valor JSONB;
BEGIN
    -- 1. VALIDAÇÃO DE SEGURANÇA: Adicionamos 'lancamentos' na lista!
    IF p_tabela_fonte NOT IN ('contratos', 'funcionarios', 'contatos_no_funil', 'pedidos_compra', 'lancamentos') THEN
        RAISE EXCEPTION 'Acesso negado. A tabela % não é permitida para KPIs.', p_tabela_fonte;
    END IF;

    -- 2. CONSTRUÇÃO DA BASE DA CONSULTA
    IF p_operacao = 'COUNT' THEN
        query_sql := format('SELECT COUNT(*) FROM public.%I', p_tabela_fonte);
    ELSIF p_operacao = 'SUM' THEN
        query_sql := format('SELECT SUM(%I) FROM public.%I', p_coluna_alvo, p_tabela_fonte);
    ELSE
        RAISE EXCEPTION 'Operação de KPI inválida: %', p_operacao;
    END IF;

    -- 3. FILTRO DE SEGURANÇA PRINCIPAL
    query_sql := query_sql || format(' WHERE organizacao_id = %L', p_organizacao_id);

    -- 4. APLICAÇÃO DINÂMICA DOS FILTROS ADICIONAIS
    IF p_filtros IS NOT NULL AND jsonb_typeof(p_filtros) = 'object' THEN
        FOR filtro_chave, filtro_valor IN SELECT key, value FROM jsonb_each(p_filtros)
        LOOP
            IF filtro_valor IS NOT NULL AND filtro_valor::text <> 'null' AND filtro_valor::text <> '[]' AND filtro_valor::text <> '""' THEN
                 query_sql := query_sql || format(' AND %I = %L', filtro_chave, filtro_valor::text);
            END IF;
        END LOOP;
    END IF;

    -- 5. EXECUÇÃO E RETORNO
    EXECUTE query_sql INTO resultado;

    RETURN COALESCE(resultado, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.agendar_vale(p_funcionario_id bigint, p_organizacao_id bigint, p_periodo_inicio date, p_periodo_fim date, p_data_pagamento date, p_valor_projetado numeric, p_conta_id bigint, p_empresa_id bigint, p_empreendimento_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    novo_lancamento_id bigint;
    nome_funcionario text;
    v_categoria_id bigint;
    -- O PORQUÊ: Variáveis para guardar os dados do cálculo.
    v_dias_trabalhados int;
    v_valor_diaria numeric;
    v_observacao text;
BEGIN
    -- Busca o nome do funcionário para a descrição
    SELECT full_name INTO nome_funcionario FROM public.funcionarios WHERE id = p_funcionario_id;

    -- Procura o ID da categoria "Folha de Pagamento"
    SELECT id INTO v_categoria_id
    FROM public.categorias_financeiras
    WHERE nome ILIKE 'Folha de Pagamento' AND organizacao_id = p_organizacao_id
    LIMIT 1;

    -- =================================================================================
    -- INÍCIO DA CORREÇÃO
    -- O PORQUÊ: Esta é a lógica que estava faltando. Ela gera a "memória de cálculo".
    -- =================================================================================

    -- 1. Busca a diária mais recente do funcionário
    SELECT valor_diaria INTO v_valor_diaria
    FROM public.historico_salarial
    WHERE funcionario_id = p_funcionario_id AND data_inicio_vigencia <= p_periodo_fim
    ORDER BY data_inicio_vigencia DESC LIMIT 1;
    
    -- Se não encontrar diária, define como 0 para evitar erros.
    IF NOT FOUND THEN
        v_valor_diaria := 0;
    END IF;

    -- 2. Calcula o número de dias (evita divisão por zero)
    IF v_valor_diaria > 0 THEN
        v_dias_trabalhados := round(p_valor_projetado / v_valor_diaria);
    ELSE
        v_dias_trabalhados := 0;
    END IF;

    -- 3. Monta a string de observação com todos os detalhes
    v_observacao := format(
        'Referente a %s dias de trabalho no período de %s a %s, com diária de R$ %s.',
        v_dias_trabalhados,
        to_char(p_periodo_inicio, 'DD/MM/YYYY'),
        to_char(p_periodo_fim, 'DD/MM/YYYY'),
        to_char(v_valor_diaria, 'FM999G999D00') -- Formata para o padrão monetário brasileiro
    );
    -- =================================================================================
    -- FIM DA CORREÇÃO
    -- =================================================================================

    -- Cria o lançamento financeiro, agora incluindo a observação
    INSERT INTO public.lancamentos (
        descricao, valor, tipo, status, data_transacao, data_vencimento, data_pagamento,
        funcionario_id, favorecido_contato_id, conta_id, categoria_id, empresa_id,
        empreendimento_id, observacao, organizacao_id
    )
    VALUES (
        'Adiantamento (Vale) para ' || nome_funcionario, p_valor_projetado, 'Despesa', 'Pendente', p_data_pagamento, p_data_pagamento, NULL,
        p_funcionario_id, (SELECT contato_id FROM public.funcionarios WHERE id = p_funcionario_id), p_conta_id, v_categoria_id, p_empresa_id,
        p_empreendimento_id, v_observacao, p_organizacao_id
    ) RETURNING id INTO novo_lancamento_id;

    -- Cria o registro na tabela de controle de vales
    INSERT INTO public.vales_agendados (
        funcionario_id, lancamento_id, periodo_inicio, periodo_fim,
        data_pagamento_agendada, valor_projetado, organizacao_id
    )
    VALUES (
        p_funcionario_id, novo_lancamento_id, p_periodo_inicio, p_periodo_fim,
        p_data_pagamento, p_valor_projetado, p_organizacao_id
    );

    RETURN json_build_object('status', 'success', 'message', 'Vale agendado com sucesso!', 'lancamento_id', novo_lancamento_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_inss(salario_base numeric)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    inss_faixa_1 numeric := 1412.00;
    inss_faixa_2 numeric := 2666.68;
    inss_faixa_3 numeric := 4000.03;
    inss_faixa_4 numeric := 7786.02;
    desconto numeric := 0;
BEGIN
    IF salario_base <= inss_faixa_1 THEN
        desconto := salario_base * 0.075;
    ELSIF salario_base <= inss_faixa_2 THEN
        desconto := (inss_faixa_1 * 0.075) + 
                    ((salario_base - inss_faixa_1) * 0.09);
    ELSIF salario_base <= inss_faixa_3 THEN
        desconto := (inss_faixa_1 * 0.075) + 
                    ((inss_faixa_2 - inss_faixa_1) * 0.09) +
                    ((salario_base - inss_faixa_2) * 0.12);
    ELSIF salario_base <= inss_faixa_4 THEN
        desconto := (inss_faixa_1 * 0.075) +
                    ((inss_faixa_2 - inss_faixa_1) * 0.09) +
                    ((inss_faixa_3 - inss_faixa_2) * 0.12) +
                    ((salario_base - inss_faixa_3) * 0.14);
    ELSE
        desconto := (inss_faixa_1 * 0.075) +
                    ((inss_faixa_2 - inss_faixa_1) * 0.09) +
                    ((inss_faixa_3 - inss_faixa_2) * 0.12) +
                    ((inss_faixa_4 - inss_faixa_3) * 0.14);
    END IF;

    RETURN TRUNC(desconto, 2);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_faixa_inss(salario_base numeric)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF salario_base <= 1412.00 THEN
        RETURN 7.5;
    ELSIF salario_base <= 2666.68 THEN
        RETURN 9.0;
    ELSIF salario_base <= 4000.03 THEN
        RETURN 12.0;
    ELSE
        RETURN 14.0;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_rdo_numero()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verifica se o rdo_numero já não foi definido (para evitar sobrescrever em casos especiais)
    IF NEW.rdo_numero IS NULL THEN
        -- Pega o próximo valor da sequência e formata o campo
        NEW.rdo_numero := 'RDO-' || nextval('public.rdo_numero_seq');
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.limpar_conversas_duplicadas()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    r_grupo RECORD;
    v_vencedor_id bigint;
    v_ids_perdedores bigint[];
    v_total_unificados int := 0;
BEGIN
    -- 1. Encontrar grupos de números que são iguais (ex: com e sem 55)
    FOR r_grupo IN
        WITH numeros_limpos AS (
            SELECT 
                id, 
                phone_number,
                contato_id,
                -- Normaliza: Se for BR, pega os últimos 8 dígitos. Se for gringo, pega tudo.
                CASE 
                    WHEN phone_number LIKE '55%' OR length(phone_number) BETWEEN 12 AND 13 
                    THEN RIGHT(REGEXP_REPLACE(phone_number, '\D', '', 'g'), 8)
                    ELSE REGEXP_REPLACE(phone_number, '\D', '', 'g')
                END as final_numero
            FROM public.whatsapp_conversations
        )
        SELECT 
            final_numero,
            -- O Vencedor é o número mais longo (mais completo) e mais antigo
            ARRAY_AGG(id ORDER BY length(phone_number) DESC, id ASC) as ids
        FROM numeros_limpos
        GROUP BY final_numero
        HAVING COUNT(*) > 1
    LOOP
        -- Define quem fica e quem sai
        v_vencedor_id := r_grupo.ids[1];
        v_ids_perdedores := r_grupo.ids[2:array_length(r_grupo.ids, 1)];

        -- A. Move as mensagens dos perdedores para o vencedor
        UPDATE public.whatsapp_messages
        SET conversation_record_id = v_vencedor_id
        WHERE conversation_record_id = ANY(v_ids_perdedores);

        -- B. Se o vencedor não tem Dono (contato_id), herda de um perdedor
        UPDATE public.whatsapp_conversations v
        SET contato_id = (
            SELECT p.contato_id 
            FROM public.whatsapp_conversations p 
            WHERE p.id = ANY(v_ids_perdedores) 
            AND p.contato_id IS NOT NULL 
            LIMIT 1
        )
        WHERE v.id = v_vencedor_id AND v.contato_id IS NULL;

        -- C. Remove os perdedores do mapa
        DELETE FROM public.whatsapp_conversations
        WHERE id = ANY(v_ids_perdedores);

        v_total_unificados := v_total_unificados + 1;
    END LOOP;

    RETURN 'Sucesso! ' || v_total_unificados || ' grupos de conversas foram unificados.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consultar_contratos_filtrados(p_organizacao_id bigint, p_search_term text, p_cliente_ids bigint[], p_corretor_ids bigint[], p_produto_ids bigint[], p_empreendimento_ids bigint[], p_status text[], p_start_date date, p_end_date date)
 RETURNS TABLE(id bigint, contato_id bigint, produto_id bigint, empreendimento_id bigint, data_venda date, valor_final_venda numeric, status_contrato text, created_at timestamp with time zone, simulacao_id bigint, corretor_id bigint, indice_reajuste text, multa_inadimplencia_percentual numeric, juros_mora_inadimplencia_percentual numeric, clausula_penal_percentual numeric, numero_contrato text, organizacao_id bigint, contato json, produto json, empreendimento json, corretor json)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.contato_id,
        c.produto_id,
        c.empreendimento_id,
        c.data_venda,
        c.valor_final_venda,
        c.status_contrato,
        c.created_at,
        c.simulacao_id,
        c.corretor_id,
        c.indice_reajuste,
        c.multa_inadimplencia_percentual,
        c.juros_mora_inadimplencia_percentual,
        c.clausula_penal_percentual,
        c.numero_contrato,
        c.organizacao_id,
        json_build_object('nome', cliente.nome, 'razao_social', cliente.razao_social) as contato,
        json_build_object('unidade', produto.unidade, 'tipo', produto.tipo) as produto,
        json_build_object('nome', empreendimento.nome) as empreendimento,
        json_build_object('nome', corretor.nome, 'razao_social', corretor.razao_social) as corretor
    FROM public.contratos c
    LEFT JOIN public.contatos cliente ON c.contato_id = cliente.id
    LEFT JOIN public.contatos corretor ON c.corretor_id = corretor.id
    LEFT JOIN public.produtos_empreendimento produto ON c.produto_id = produto.id
    LEFT JOIN public.empreendimentos empreendimento ON c.empreendimento_id = empreendimento.id
    WHERE
        c.organizacao_id = p_organizacao_id
        AND (p_search_term IS NULL OR p_search_term = '' OR
             c.id::text ILIKE '%' || p_search_term || '%' OR
             cliente.nome ILIKE '%' || p_search_term || '%' OR
             cliente.razao_social ILIKE '%' || p_search_term || '%' OR
             produto.unidade ILIKE '%' || p_search_term || '%' OR
             empreendimento.nome ILIKE '%' || p_search_term || '%' OR
             corretor.nome ILIKE '%' || p_search_term || '%')
        AND (p_cliente_ids IS NULL OR c.contato_id = ANY(p_cliente_ids))
        AND (p_corretor_ids IS NULL OR c.corretor_id = ANY(p_corretor_ids))
        AND (p_produto_ids IS NULL OR c.produto_id = ANY(p_produto_ids))
        AND (p_empreendimento_ids IS NULL OR c.empreendimento_id = ANY(p_empreendimento_ids))
        AND (p_status IS NULL OR c.status_contrato = ANY(p_status))
        AND (p_start_date IS NULL OR c.data_venda >= p_start_date)
        AND (p_end_date IS NULL OR c.data_venda <= p_end_date);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.corrigir_materiais_com_logica_inteligente()
 RETURNS TABLE(acao_realizada text, item_pedido_id_corrigido bigint, descricao_item text, id_do_pedido bigint, id_do_material_final bigint, nome_do_material_final text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_rec RECORD;
    material_encontrado RECORD;
BEGIN
    -- Habilita a extensão para ignorar acentos, caso ainda não esteja ativa.
    CREATE EXTENSION IF NOT EXISTS unaccent;

    -- Cria a tabela temporária para o relatório
    CREATE TEMP TABLE temp_reporte_inteligente (
        acao_realizada TEXT,
        item_pedido_id_corrigido BIGINT,
        descricao_item TEXT,
        id_do_pedido BIGINT,
        id_do_material_final BIGINT,
        nome_do_material_final TEXT
    ) ON COMMIT DROP;

    -- Loop por cada item que precisa ser corrigido
    FOR item_rec IN
        SELECT pci.id, pci.descricao_item, pci.unidade_medida, p.organizacao_id, pci.pedido_compra_id
        FROM pedidos_compra_itens AS pci
        JOIN pedidos_compra AS p ON pci.pedido_compra_id = p.id
        WHERE pci.material_id IS NULL AND pci.descricao_item IS NOT NULL AND trim(pci.descricao_item) <> ''
    LOOP
        -- PASSO 1: Tenta encontrar um material existente (busca inteligente)
        SELECT m.id, m.nome INTO material_encontrado
        FROM materiais AS m
        WHERE
            m.organizacao_id = item_rec.organizacao_id
            AND unaccent(lower(trim(m.nome))) = unaccent(lower(trim(item_rec.descricao_item)))
        LIMIT 1;

        -- PASSO 2: Decide se vincula ou cria
        IF material_encontrado.id IS NOT NULL THEN
            -- SE ENCONTROU: Apenas atualiza o item do pedido
            UPDATE pedidos_compra_itens SET material_id = material_encontrado.id WHERE id = item_rec.id;
            -- Adiciona ao relatório
            INSERT INTO temp_reporte_inteligente VALUES ('VINCULADO', item_rec.id, item_rec.descricao_item, item_rec.pedido_compra_id, material_encontrado.id, material_encontrado.nome);
        ELSE
            -- SE NÃO ENCONTROU: Cria um novo material
            INSERT INTO materiais (nome, descricao, unidade_medida, classificacao, organizacao_id)
            VALUES (
                trim(item_rec.descricao_item),
                trim(item_rec.descricao_item),
                COALESCE(item_rec.unidade_medida, 'unid.'),
                'Insumo',
                item_rec.organizacao_id
            )
            RETURNING id, nome INTO material_encontrado;
            -- Atualiza o item do pedido com o novo ID
            UPDATE pedidos_compra_itens SET material_id = material_encontrado.id WHERE id = item_rec.id;
            -- Adiciona ao relatório
            INSERT INTO temp_reporte_inteligente VALUES ('CRIADO', item_rec.id, item_rec.descricao_item, item_rec.pedido_compra_id, material_encontrado.id, material_encontrado.nome);
        END IF;

    END LOOP;

    -- Retorna o relatório completo
    RETURN QUERY SELECT * FROM temp_reporte_inteligente ORDER BY acao_realizada, id_do_pedido;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_nomes_meta_apos_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Como esta função roda DEPOIS que o contato já foi inserido,
    -- nós executamos um comando UPDATE separado para a linha que acabou de ser criada (NEW.id).
    UPDATE public.contatos
    SET 
        -- Para cada campo, buscamos o nome correspondente nas tabelas da Meta
        meta_ad_name = (SELECT name FROM public.meta_ads WHERE id = NEW.meta_ad_id),
        meta_adset_name = (SELECT name FROM public.meta_adsets WHERE id = NEW.meta_adgroup_id),
        meta_campaign_name = (SELECT name FROM public.meta_campaigns WHERE id = NEW.meta_campaign_id)
    WHERE 
        -- A condição WHERE garante que estamos atualizando EXATAMENTE a linha que disparou o gatilho.
        id = NEW.id;

    -- Em um gatilho AFTER, o valor de retorno é ignorado, mas é boa prática retornar NEW.
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.excluir_material_forca_bruta(p_material_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- (Opcional) Aqui você poderia adicionar uma verificação se o usuário é ADMIN
    -- Mas por enquanto vamos confiar na re-autenticação do Front-end

    -- 1. Varrer e deletar das tabelas filhas
    DELETE FROM public.orcamento_itens WHERE material_id = p_material_id;
    DELETE FROM public.pedidos_compra_itens WHERE material_id = p_material_id;
    DELETE FROM public.estoque WHERE material_id = p_material_id;
    DELETE FROM public.estoque_obra WHERE material_id = p_material_id;

    -- Movimentações (se existir link direto)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'movimentacoes_estoque') THEN
       NULL; -- Lógica específica se necessário
    END IF;

    -- 2. Deletar o Material
    DELETE FROM public.materiais WHERE id = p_material_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_all_contact_meta_names_v2()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    updated_campaign_ids_count integer := 0;
    updated_names_count integer := 0;
BEGIN
    -- ETAPA 1: Garante que o ID da campanha no contato seja preenchido,
    -- buscando a informação a partir do anúncio vinculado.
    -- Isso corrige os contatos onde o 'meta_campaign_id' está nulo.
    WITH updated_ids AS (
        UPDATE public.contatos c
        SET meta_campaign_id = ma.campaign_id
        FROM public.meta_ads AS ma
        WHERE c.meta_ad_id = ma.id
          AND c.meta_campaign_id IS NULL -- Apenas atualiza se o ID da campanha do contato estiver faltando
          AND ma.campaign_id IS NOT NULL
        RETURNING c.id
    )
    SELECT count(*) INTO updated_campaign_ids_count FROM updated_ids;

    -- ETAPA 2: Agora que os IDs de campanha estão corretos, atualiza os nomes
    -- do anúncio e da campanha que estiverem faltando.
    WITH updated_names AS (
        UPDATE public.contatos c
        SET
            meta_ad_name = (SELECT name FROM public.meta_ads WHERE id = c.meta_ad_id),
            meta_campaign_name = (SELECT name FROM public.meta_campaigns WHERE id = c.meta_campaign_id)
        WHERE
            -- Condição para rodar:
            -- Apenas em contatos que tenham um anúncio ou campanha vinculados
            (c.meta_ad_id IS NOT NULL OR c.meta_campaign_id IS NOT NULL)
            -- E que ainda tenham o nome do anúncio ou da campanha em branco
            AND (c.meta_ad_name IS NULL OR c.meta_campaign_name IS NULL)
        RETURNING c.id
    )
    SELECT count(*) INTO updated_names_count FROM updated_names;

    RETURN 'Atualização V2 concluída. IDs de campanha corrigidos: ' || updated_campaign_ids_count || '. Contatos com nomes atualizados: ' || updated_names_count;
END;
$function$
;

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
;

CREATE OR REPLACE FUNCTION public.get_crm_filter_options_v2(p_organizacao_id bigint)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    result json;
BEGIN
    WITH contatos_ids_no_funil AS (
        -- Primeiro, pegamos apenas os IDs dos contatos que estão no funil. Esta é a nossa base.
        SELECT DISTINCT contato_id FROM public.contatos_no_funil WHERE organizacao_id = p_organizacao_id
    )
    SELECT json_build_object(
        'corretores', (
            SELECT COALESCE(json_agg(json_build_object('id', c.id, 'nome', COALESCE(c.nome, c.razao_social)) ORDER BY COALESCE(c.nome, c.razao_social)), '[]'::json)
            FROM public.contatos c
            WHERE c.id IN (SELECT DISTINCT corretor_id FROM public.contatos_no_funil WHERE organizacao_id = p_organizacao_id AND corretor_id IS NOT NULL)
        ),
        'origens', (
            SELECT COALESCE(json_agg(json_build_object('id', o.origem, 'nome', o.origem)), '[]'::json)
            FROM (
                SELECT DISTINCT c.origem FROM public.contatos c JOIN contatos_ids_no_funil f ON c.id = f.contato_id WHERE c.origem IS NOT NULL ORDER BY c.origem
            ) o
        ),
        'unidades', ( -- Unidades não dependem do contato, então a busca é direta e rápida.
            SELECT COALESCE(json_agg(json_build_object('id', id, 'nome', unidade) ORDER BY unidade), '[]'::json)
            FROM public.produtos_empreendimento WHERE organizacao_id = p_organizacao_id
        ),
        'campaigns', (
            SELECT COALESCE(json_agg(json_build_object('id', mc.id, 'nome', mc.name) ORDER BY mc.name), '[]'::json)
            FROM public.meta_campaigns mc
            WHERE mc.id IN (SELECT DISTINCT c.meta_campaign_id FROM public.contatos c JOIN contatos_ids_no_funil f ON c.id = f.contato_id WHERE c.meta_campaign_id IS NOT NULL)
        ),
        'ads', (
            SELECT COALESCE(json_agg(json_build_object('id', ma.id, 'nome', ma.name) ORDER BY ma.name), '[]'::json)
            FROM public.meta_ads ma
            WHERE ma.id IN (SELECT DISTINCT c.meta_ad_id FROM public.contatos c JOIN contatos_ids_no_funil f ON c.id = f.contato_id WHERE c.meta_ad_id IS NOT NULL)
        )
    ) INTO result;

    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_lancamentos_futuros_do_grupo(p_grupo_id uuid, p_data_referencia date, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM public.lancamentos
    WHERE
        parcela_grupo = p_grupo_id AND
        data_vencimento >= p_data_referencia AND
        organizacao_id = p_organizacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_contact_meta_names()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_ad_name TEXT;
    v_campaign_id TEXT;
    v_campaign_name TEXT;
BEGIN
    -- Verifica se existe um ID de anúncio no novo contato
    IF NEW.meta_ad_id IS NOT NULL THEN
        -- Fluxo 1: Busca o nome do anúncio e o ID da campanha dele
        SELECT
            "name", "campaign_id"
        INTO
            v_ad_name, v_campaign_id
        FROM
            public.meta_ads
        WHERE
            id = NEW.meta_ad_id;

        -- Se encontrou um ID de campanha, continua a investigação
        IF v_campaign_id IS NOT NULL THEN
            -- Fluxo 2: Busca o nome da campanha
            SELECT
                "name"
            INTO
                v_campaign_name
            FROM
                public.meta_campaigns
            WHERE
                id = v_campaign_id;
        END IF;

        -- Atualiza a linha do contato com os nomes encontrados
        UPDATE public.contatos
        SET
            meta_ad_name = v_ad_name,
            meta_campaign_name = v_campaign_name
        WHERE
            id = NEW.id;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_financeiro_consolidado(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_where text;
  v_result jsonb;
begin
  v_where := financeiro_montar_where(p_organizacao_id, p_filtros);

  execute '
    select jsonb_build_object(
      ''totalReceitas'', coalesce(sum(case when tipo = ''Receita'' then ABS(valor) else 0 end), 0),
      ''totalDespesas'', coalesce(sum(case when tipo = ''Despesa'' then ABS(valor) else 0 end), 0),
      ''resultado'', coalesce(sum(case when tipo = ''Receita'' then ABS(valor) else -ABS(valor) end), 0),
      ''totalPago'', coalesce(sum(case when status in (''Pago'', ''Conciliado'') then (case when tipo = ''Receita'' then ABS(valor) else -ABS(valor) end) else 0 end), 0),
      ''totalPendente'', coalesce(sum(case when status = ''Pendente'' then (case when tipo = ''Receita'' then ABS(valor) else -ABS(valor) end) else 0 end), 0)
    )
    from lancamentos l
    ' || v_where 
  into v_result;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_organization_id()
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN (
    SELECT organizacao_id
    FROM public.usuarios
    WHERE id = auth.uid() -- auth.uid() pega o ID do usuário autenticado
    LIMIT 1 -- Garante que retorne apenas um valor
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_conversations_with_unread_count()
 RETURNS TABLE(contato_id bigint, nome text, last_message text, last_message_sent_at timestamp with time zone, unread_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT
            wm.contato_id,
            ROW_NUMBER() OVER(PARTITION BY wm.contato_id ORDER BY wm.sent_at DESC) as rn,
            wm.content,
            wm.sent_at
        FROM
            whatsapp_messages wm
    ),
    unread_counts AS (
        SELECT
            wm.contato_id,
            COUNT(*) as unread
        FROM
            whatsapp_messages wm
        WHERE
            wm.is_read = false
        GROUP BY
            wm.contato_id
    )
    SELECT
        c.id as contato_id,
        c.nome,
        lm.content as last_message,
        lm.sent_at as last_message_sent_at,
        COALESCE(uc.unread, 0) as unread_count
    FROM
        contatos c
    JOIN
        latest_messages lm ON c.id = lm.contato_id AND lm.rn = 1
    LEFT JOIN
        unread_counts uc ON c.id = uc.contato_id
    ORDER BY
        lm.sent_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_previsao_fatura_cartao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_conta_cartao_id BIGINT;
    v_conta_debito_id BIGINT;
    v_total_fatura NUMERIC;
    v_nome_cartao TEXT;
    v_lancamento_previsao_id BIGINT;
    v_dia_pagamento INT;
    v_data_vencimento_previsao DATE;
    v_data_base DATE;
BEGIN
    -- 1. Identifica a conta do cartão
    IF (TG_OP = 'DELETE') THEN
        v_conta_cartao_id := OLD.conta_id;
    ELSE
        v_conta_cartao_id := NEW.conta_id;
    END IF;

    -- 2. Busca configurações do cartão (Dia Pagamento e Conta Débito)
    SELECT id, nome, conta_debito_fatura_id, dia_pagamento_fatura
    INTO v_conta_cartao_id, v_nome_cartao, v_conta_debito_id, v_dia_pagamento
    FROM public.contas_financeiras
    WHERE id = v_conta_cartao_id AND tipo = 'Cartão de Crédito';

    -- Se não for cartão ou não tiver conta vinculada, para aqui
    IF v_conta_cartao_id IS NULL OR v_conta_debito_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Se o dia de pagamento não estiver configurado, usa dia 10 como padrão (segurança)
    IF v_dia_pagamento IS NULL THEN v_dia_pagamento := 10; END IF;

    -- 3. Calcula a Data de Vencimento da Previsão
    -- Pega o primeiro dia do mês atual
    v_data_base := date_trunc('month', CURRENT_DATE)::DATE;
    
    -- Soma os dias para chegar no dia de pagamento (ex: 1 + (10-1) = dia 10)
    -- Usamos intervalo para evitar erro em meses curtos (o banco ajusta automaticamente)
    v_data_vencimento_previsao := (v_data_base + ((v_dia_pagamento - 1) || ' days')::INTERVAL)::DATE;

    -- Se hoje já passou do dia de pagamento, a previsão é para o mês que vem
    IF CURRENT_DATE > v_data_vencimento_previsao THEN
        v_data_vencimento_previsao := (v_data_vencimento_previsao + INTERVAL '1 month')::DATE;
    END IF;

    -- 4. Calcula o valor total pendente
    SELECT COALESCE(SUM(valor), 0)
    INTO v_total_fatura
    FROM public.lancamentos
    WHERE conta_id = v_conta_cartao_id;

    -- 5. Gerencia o Lançamento de Previsão na Conta Corrente
    
    -- Busca se já existe
    SELECT id INTO v_lancamento_previsao_id
    FROM public.lancamentos
    WHERE conta_id = v_conta_debito_id 
      AND observacao = 'SISTEMA: PREVISÃO FATURA CARTÃO ID ' || v_conta_cartao_id
      AND status = 'Pendente'
    LIMIT 1;

    IF v_lancamento_previsao_id IS NOT NULL THEN
        -- ATUALIZA existente
        IF v_total_fatura < 0 THEN
            UPDATE public.lancamentos
            SET valor = ABS(v_total_fatura),
                data_vencimento = v_data_vencimento_previsao, -- Data calculada
                data_transacao = v_data_vencimento_previsao   -- Mantém data transação igual vencimento para previsão
            WHERE id = v_lancamento_previsao_id;
        ELSE
            -- Se saldo zerou (foi pago), remove a previsão
            DELETE FROM public.lancamentos WHERE id = v_lancamento_previsao_id;
        END IF;
    ELSE
        -- CRIA novo
        IF v_total_fatura < 0 THEN
            INSERT INTO public.lancamentos (
                descricao, 
                valor, 
                tipo, 
                conta_id, 
                status, 
                data_transacao, 
                data_vencimento, 
                observacao,
                organizacao_id
            ) VALUES (
                'Previsão Fatura - ' || v_nome_cartao,
                ABS(v_total_fatura),
                'Despesa',
                v_conta_debito_id,
                'Pendente',
                v_data_vencimento_previsao, -- Data calculada
                v_data_vencimento_previsao, -- Data calculada
                'SISTEMA: PREVISÃO FATURA CARTÃO ID ' || v_conta_cartao_id,
                (SELECT organizacao_id FROM public.contas_financeiras WHERE id = v_conta_cartao_id)
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.corrigir_e_criar_materiais_versao_robusta()
 RETURNS TABLE(acao_realizada text, item_pedido_id bigint, descricao_item text, pedido_id bigint, id_final_do_material bigint, nome_material_vinculado text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_rec RECORD;
    material_id_encontrado BIGINT;
    v_organizacao_id BIGINT;
    updated_ids BIGINT[];
BEGIN
    -- Etapa 1: Tenta atualizar em massa todos os itens que encontram correspondência
    -- limpando os nomes (sem acentos, minúsculas, sem espaços extras).
    WITH updates AS (
        UPDATE pedidos_compra_itens pci
        SET material_id = m.id
        FROM materiais m
        JOIN pedidos_compra pc ON pci.pedido_compra_id = pc.id
        WHERE 
            pci.material_id IS NULL 
            AND pc.organizacao_id = m.organizacao_id
            AND unaccent(lower(trim(pci.descricao_item))) = unaccent(lower(trim(m.nome)))
        RETURNING pci.id, pci.descricao_item, pci.pedido_compra_id, m.id as novo_material_id, m.nome as material_nome
    )
    SELECT array_agg(id) INTO updated_ids FROM updates;

    -- Cria a tabela de resultados temporária para o relatório
    CREATE TEMP TABLE IF NOT EXISTS temp_results ON COMMIT DROP AS
    SELECT 
        'VINCULADO'::TEXT as acao_realizada, 
        u.id as item_pedido_id, 
        u.descricao_item,
        u.pedido_compra_id as pedido_id,
        u.novo_material_id as id_final_do_material,
        u.material_nome as nome_material_vinculado
    FROM updates u;

    -- Etapa 2: Percorre apenas os itens que NÃO foram atualizados na etapa 1 para criar novos materiais
    FOR item_rec IN
        SELECT pci.id, pci.descricao_item, pci.unidade_medida, p.organizacao_id, pci.pedido_compra_id
        FROM pedidos_compra_itens AS pci
        JOIN pedidos_compra AS p ON pci.pedido_compra_id = p.id
        WHERE pci.material_id IS NULL 
          AND pci.descricao_item IS NOT NULL 
          AND trim(pci.descricao_item) <> ''
          AND (updated_ids IS NULL OR NOT (pci.id = ANY(updated_ids)))
    LOOP
        v_organizacao_id := item_rec.organizacao_id;
        material_id_encontrado := NULL;

        -- Cria um novo material
        INSERT INTO materiais (nome, descricao, unidade_medida, classificacao, organizacao_id)
        VALUES (
            trim(item_rec.descricao_item),
            trim(item_rec.descricao_item),
            COALESCE(item_rec.unidade_medida, 'unid.'),
            'Insumo',
            v_organizacao_id
        )
        RETURNING id INTO material_id_encontrado;

        -- Atualiza o item do pedido com o ID do material recém-criado
        UPDATE pedidos_compra_itens
        SET material_id = material_id_encontrado
        WHERE id = item_rec.id;

        -- Adiciona a informação ao relatório
        INSERT INTO temp_results (acao_realizada, item_pedido_id, descricao_item, pedido_id, id_final_do_material, nome_material_vinculado)
        VALUES ('CRIADO', item_rec.id, item_rec.descricao_item, item_rec.pedido_compra_id, material_id_encontrado, trim(item_rec.descricao_item));

    END LOOP;

    -- Retorna o relatório completo
    RETURN QUERY SELECT * FROM temp_results ORDER BY acao_realizada, pedido_id, item_pedido_id;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_performance_por_periodo(p_organizacao_id bigint, p_start_date date, p_end_date date)
 RETURNS TABLE(ad_id text, ad_name text, campaign_name text, adset_name text, period_spend numeric, period_impressions bigint, period_clicks bigint, period_reach bigint, period_leads bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH end_values AS (
        SELECT DISTINCT ON (h.ad_id)
            h.ad_id,
            h.ad_name,
            h.campaign_name,
            h.adset_name,
            h.spend,
            h.impressions,
            h.clicks,
            h.reach,
            h.leads
        FROM public.meta_ads_historico h
        WHERE h.organizacao_id = p_organizacao_id AND h.created_at < (p_end_date + INTERVAL '1 day')
        ORDER BY h.ad_id, h.created_at DESC
    ),
    start_values AS (
        SELECT DISTINCT ON (ad_id)
            ad_id,
            spend,
            impressions,
            clicks,
            reach,
            leads
        FROM public.meta_ads_historico
        WHERE organizacao_id = p_organizacao_id AND created_at < p_start_date::timestamp
        ORDER BY ad_id, created_at DESC
    )
    SELECT
        ev.ad_id,
        ev.ad_name,
        ev.campaign_name,
        ev.adset_name,
        COALESCE(ev.spend, 0) - COALESCE(sv.spend, 0) AS period_spend,
        (COALESCE(ev.impressions, 0) - COALESCE(sv.impressions, 0))::BIGINT AS period_impressions,
        (COALESCE(ev.clicks, 0) - COALESCE(sv.clicks, 0))::BIGINT AS period_clicks,
        (COALESCE(ev.reach, 0) - COALESCE(sv.reach, 0))::BIGINT AS period_reach,
        (COALESCE(ev.leads, 0) - COALESCE(sv.leads, 0))::BIGINT AS period_leads
    FROM end_values ev
    LEFT JOIN start_values sv ON ev.ad_id = sv.ad_id
    WHERE ev.ad_id IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atribuir_numero_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    ultimo_numero INTEGER;
BEGIN
    IF NEW.status_contrato = 'Assinado' AND NEW.numero_contrato IS NULL THEN
        LOCK TABLE public.contratos IN EXCLUSIVE MODE;

        SELECT COALESCE(MAX(numero_contrato), 0) -- Simplificado, pois a coluna agora é INTEGER
        INTO ultimo_numero
        FROM public.contratos
        WHERE organizacao_id = NEW.organizacao_id;

        -- =================================================================================
        -- MUDANÇA AQUI: Removemos a conversão para TEXTO (::TEXT)
        -- Agora, ele salva como um número inteiro de verdade.
        -- =================================================================================
        NEW.numero_contrato := ultimo_numero + 1;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_organizacao_do_usuario_atual()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT organizacao_id
  FROM public.usuarios
  WHERE id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_valor_comissao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Usa COALESCE para tratar valores NULOS como 0, prevenindo erros de cálculo.
    IF COALESCE(NEW.valor_final_venda, 0) > 0 AND COALESCE(NEW.percentual_comissao_corretagem, 0) > 0 THEN
        -- Calcula o valor da comissão.
        NEW.valor_comissao_corretagem := NEW.valor_final_venda * (NEW.percentual_comissao_corretagem / 100.0);
    ELSE
        -- Se as condições não forem atendidas, define explicitamente a comissão como 0.
        NEW.valor_comissao_corretagem := 0;
    END IF;

    -- ESSA É A LINHA MAIS CRÍTICA!
    -- Ela garante que a operação (INSERT ou UPDATE) SEMPRE continue, retornando a
    -- linha de dados que deve ser salva (NEW). Se esta função retornar NULL,
    -- a operação é cancelada silenciosamente.
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_data_entrega_real()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- A condição NEW.status = 'Entregue' verifica se o novo estado é 'Entregue'.
    -- A condição OLD.status <> 'Entregue' garante que isso só aconteça na transição para 'Entregue',
    -- e não em outras atualizações de um pedido que já estava entregue.
    IF NEW.status = 'Entregue' AND OLD.status <> 'Entregue' AND NEW.data_entrega_real IS NULL THEN
        -- Define a data de entrega real como a data atual.
        NEW.data_entrega_real := CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preencher_nomes_historico_anuncios()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    updated_rows_count INTEGER;
BEGIN
    -- Usamos um CTE (Common Table Expression) com a cláusula RETURNING
    -- para contar de forma eficiente quantas linhas foram realmente atualizadas.
    WITH updated_rows AS (
        UPDATE public.meta_ads_historico h
        SET
            ad_name = a.name,
            campaign_name = c.name,
            adset_name = s.name
        FROM
            public.meta_ads a
        JOIN
            public.meta_campaigns c ON a.campaign_id = c.id
        JOIN
            public.meta_adsets s ON a.adset_id = s.id
        WHERE
            h.ad_id = a.id
        AND (
            h.ad_name IS NULL OR
            h.campaign_name IS NULL OR
            h.adset_name IS NULL
        )
        RETURNING h.id
    )
    SELECT count(*) INTO updated_rows_count FROM updated_rows;

    -- Retorna uma mensagem amigável com a contagem de registros atualizados.
    RETURN 'Preenchimento concluído. ' || updated_rows_count || ' registros do histórico foram atualizados.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_activity_status_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- REGRA 1: Ao iniciar uma atividade
    -- Se o status for alterado para 'Em Andamento' e o início real estiver vazio,
    -- preenche o início real com a data de HOJE.
    IF NEW.status = 'Em Andamento' AND OLD.data_inicio_real IS NULL THEN
        NEW.data_inicio_real := timezone('America/Sao_Paulo', now())::date;
    END IF;

    -- REGRA 2: Ao concluir uma atividade
    -- Se o status for alterado para 'Concluído' e o fim real estiver vazio,
    -- preenche o fim real com a data de HOJE.
    IF NEW.status = 'Concluído' AND OLD.data_fim_real IS NULL THEN
        NEW.data_fim_real := timezone('America/Sao_Paulo', now())::date;
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_ou_atualizar_contracheque(p_funcionario_id bigint, p_mes_referencia text, p_organizacao_id bigint)
 RETURNS SETOF contracheques
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- Variáveis para os cálculos
    v_salario_base numeric;
    v_valor_diaria_base numeric;
    v_dias_trabalhados integer;
    v_valor_total_diarias numeric;
    v_bonus numeric;
    v_salario_bruto numeric;
    v_faixa_inss numeric;
    v_desconto_inss numeric;
    v_base_calculo_fgts numeric;
    v_valor_fgts numeric;
    v_base_calculo_irrf numeric;
    v_outros_descontos numeric;
    v_adicionais numeric;
    v_custo_inss_patronal numeric;
    v_custo_rat numeric;
    v_custo_terceiros numeric;
BEGIN
    -- 1. Buscar Salário
    SELECT salario_base, valor_diaria INTO v_salario_base, v_valor_diaria_base
    FROM public.historico_salarial
    WHERE funcionario_id = p_funcionario_id
      AND organizacao_id = p_organizacao_id
      AND data_inicio_vigencia <= (p_mes_referencia || '-01')::date
    ORDER BY data_inicio_vigencia DESC
    LIMIT 1;

    IF v_salario_base IS NULL THEN
        SELECT base_salary, daily_value INTO v_salario_base, v_valor_diaria_base
        FROM public.funcionarios
        WHERE id = p_funcionario_id AND organizacao_id = p_organizacao_id;
    END IF;

    v_salario_base := COALESCE(v_salario_base, 0);
    v_valor_diaria_base := COALESCE(v_valor_diaria_base, 0);

    -- 2. Calcular Dias e Diárias a partir da tabela 'pontos'
    SELECT 
        COUNT(DISTINCT data_hora::date),
        COUNT(DISTINCT data_hora::date) * v_valor_diaria_base
    INTO v_dias_trabalhados, v_valor_total_diarias
    FROM public.pontos
    WHERE funcionario_id = p_funcionario_id
      AND organizacao_id = p_organizacao_id
      AND DATE_TRUNC('month', data_hora) = (p_mes_referencia || '-01')::date;
      
    v_dias_trabalhados := COALESCE(v_dias_trabalhados, 0);
    v_valor_total_diarias := COALESCE(v_valor_total_diarias, 0);

    -- 3. Fazer todos os outros cálculos
    v_bonus := GREATEST(0, v_valor_total_diarias - v_salario_base);
    v_salario_bruto := GREATEST(v_salario_base, v_valor_total_diarias);
    v_desconto_inss := calcular_inss(v_salario_base);
    v_faixa_inss := obter_faixa_inss(v_salario_base);
    v_base_calculo_fgts := v_salario_base;
    v_valor_fgts := v_base_calculo_fgts * 0.08;
    v_base_calculo_irrf := v_salario_base - v_desconto_inss;
    v_outros_descontos := 0;
    v_adicionais := 0;
    v_custo_inss_patronal := v_salario_base * 0.20;
    v_custo_rat := v_salario_base * 0.03;
    v_custo_terceiros := v_salario_base * 0.058;

    -- =================================================================================
    -- INÍCIO DA CORREÇÃO (UPSERT)
    -- O PORQUÊ: Substituímos o bloco IF/ELSE por um único comando INSERT ... ON CONFLICT.
    -- Ele tenta inserir. Se a constraint 'contracheques_funcionario_mes_unico' (que verifica
    -- a combinação de funcionário, mês e organização) for violada, em vez de dar erro,
    -- ele executa o bloco DO UPDATE, atualizando os campos do registro que já existe.
    -- Isso é atômico, mais rápido e resolve o erro de chave duplicada.
    -- =================================================================================
    INSERT INTO public.contracheques (
        funcionario_id, mes_referencia, organizacao_id, salario_base, valor_diaria_base, 
        dias_trabalhados, valor_total_diarias, bonus, salario_bruto, faixa_inss, 
        desconto_inss, base_calculo_fgts, valor_fgts, base_calculo_irrf, 
        outros_descontos, adicionais, custo_inss_patronal, custo_rat, 
        custo_terceiros, status
    ) VALUES (
        p_funcionario_id, (p_mes_referencia || '-01')::date, p_organizacao_id, v_salario_base, v_valor_diaria_base,
        v_dias_trabalhados, v_valor_total_diarias, v_bonus, v_salario_bruto, v_faixa_inss,
        v_desconto_inss, v_base_calculo_fgts, v_valor_fgts, v_base_calculo_irrf,
        v_outros_descontos, v_adicionais, v_custo_inss_patronal, v_custo_rat,
        v_custo_terceiros, 'Pendente'
    )
    ON CONFLICT (funcionario_id, mes_referencia, organizacao_id) DO UPDATE SET
        salario_base = EXCLUDED.salario_base,
        valor_diaria_base = EXCLUDED.valor_diaria_base,
        dias_trabalhados = EXCLUDED.dias_trabalhados,
        valor_total_diarias = EXCLUDED.valor_total_diarias,
        bonus = EXCLUDED.bonus,
        salario_bruto = EXCLUDED.salario_bruto,
        faixa_inss = EXCLUDED.faixa_inss,
        desconto_inss = EXCLUDED.desconto_inss,
        base_calculo_fgts = EXCLUDED.base_calculo_fgts,
        valor_fgts = EXCLUDED.valor_fgts,
        base_calculo_irrf = EXCLUDED.base_calculo_irrf,
        outros_descontos = EXCLUDED.outros_descontos,
        adicionais = EXCLUDED.adicionais,
        custo_inss_patronal = EXCLUDED.custo_inss_patronal,
        custo_rat = EXCLUDED.custo_rat,
        custo_terceiros = EXCLUDED.custo_terceiros;
    -- =================================================================================
    -- FIM DA CORREÇÃO
    -- =================================================================================

    -- Retorna o contracheque que foi inserido ou atualizado
    RETURN QUERY
    SELECT *
    FROM public.contracheques
    WHERE funcionario_id = p_funcionario_id
      AND mes_referencia = (p_mes_referencia || '-01')::date
      AND organizacao_id = p_organizacao_id;
      
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dar_baixa_estoque_por_uso(p_estoque_id bigint, p_quantidade numeric, p_observacao text, p_usuario_id uuid, p_funcionario_id bigint, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_nova_quantidade_atual numeric;
    v_estoque_organizacao_id bigint;
BEGIN
    -- Busca a quantidade atual e o ID da organização do item de estoque
    SELECT quantidade_atual, organizacao_id INTO v_nova_quantidade_atual, v_estoque_organizacao_id
    FROM public.estoque
    WHERE id = p_estoque_id;

    -- Verifica se o item de estoque existe
    IF v_estoque_organizacao_id IS NULL THEN
        RAISE EXCEPTION 'Item de estoque não encontrado com o ID fornecido.';
    END IF;

    -- Verifica se o item pertence à organização correta
    IF v_estoque_organizacao_id != p_organizacao_id THEN
        RAISE EXCEPTION 'Permissão negada: este item de estoque pertence a outra organização.';
    END IF;

    -- Calcula a nova quantidade
    v_nova_quantidade_atual := v_nova_quantidade_atual - p_quantidade;

    -- Impede que o estoque fique negativo
    IF v_nova_quantidade_atual < 0 THEN
        RAISE EXCEPTION 'Quantidade de baixa excede o estoque disponível.';
    END IF;

    -- Passo 1: Atualiza a quantidade no estoque
    UPDATE public.estoque
    SET 
        quantidade_atual = v_nova_quantidade_atual,
        ultima_atualizacao = now()
    WHERE id = p_estoque_id;

    -- Passo 2: Insere o registro da movimentação
    INSERT INTO public.movimentacoes_estoque(
        estoque_id,
        tipo,
        quantidade,
        usuario_id,
        observacao,
        funcionario_id,
        organizacao_id
    ) VALUES (
        p_estoque_id,
        'Saída por Uso', -- Tipo correto
        p_quantidade,
        p_usuario_id,
        p_observacao,
        p_funcionario_id,
        p_organizacao_id
    );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.corrigir_e_criar_materiais_faltantes()
 RETURNS TABLE(item_pedido_id bigint, descricao_item text, pedido_id bigint, material_foi_criado boolean, id_final_do_material bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_rec RECORD;
    material_id_encontrado BIGINT;
    v_organizacao_id BIGINT;
BEGIN
    -- Percorre cada item de pedido que precisa de correção
    FOR item_rec IN
        SELECT pci.id, pci.descricao_item, pci.unidade_medida, p.organizacao_id, pci.pedido_compra_id
        FROM pedidos_compra_itens AS pci
        JOIN pedidos_compra AS p ON pci.pedido_compra_id = p.id
        WHERE pci.material_id IS NULL AND pci.descricao_item IS NOT NULL AND pci.descricao_item <> ''
    LOOP
        v_organizacao_id := item_rec.organizacao_id;
        material_id_encontrado := NULL;

        -- Tenta encontrar um material existente com base na descrição e organização
        SELECT m.id INTO material_id_encontrado
        FROM materiais AS m
        WHERE 
            (m.nome = item_rec.descricao_item OR m.descricao = item_rec.descricao_item)
            AND m.organizacao_id = v_organizacao_id
        LIMIT 1;

        -- Se não encontrou, cria um novo
        IF material_id_encontrado IS NULL THEN
            INSERT INTO materiais (nome, descricao, unidade_medida, classificacao, organizacao_id)
            VALUES (
                item_rec.descricao_item,      -- nome
                item_rec.descricao_item,      -- descricao
                COALESCE(item_rec.unidade_medida, 'unid.'), -- unidade_medida (usa a do item ou 'unid.')
                'Insumo',                     -- classificacao (valor padrão)
                v_organizacao_id              -- organizacao_id
            )
            RETURNING id INTO material_id_encontrado;

            -- Prepara a linha de relatório para este item
            item_pedido_id := item_rec.id;
            descricao_item := item_rec.descricao_item;
            pedido_id := item_rec.pedido_compra_id;
            material_foi_criado := TRUE;
            id_final_do_material := material_id_encontrado;
            RETURN NEXT;

        ELSE
            -- Prepara a linha de relatório para o item que encontrou correspondência
            item_pedido_id := item_rec.id;
            descricao_item := item_rec.descricao_item;
            pedido_id := item_rec.pedido_compra_id;
            material_foi_criado := FALSE;
            id_final_do_material := material_id_encontrado;
            RETURN NEXT;
        END IF;
        
        -- Atualiza o item do pedido com o ID do material (encontrado ou criado)
        UPDATE pedidos_compra_itens
        SET material_id = material_id_encontrado
        WHERE id = item_rec.id;

    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_empreendimentos_com_anexos_corretor(org_id bigint)
 RETURNS TABLE(id bigint, nome text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    e.id,
    e.nome
  FROM
    public.empreendimentos e
  JOIN
    public.empreendimento_anexos ea ON e.id = ea.empreendimento_id
  WHERE
    ea.organizacao_id = org_id AND
    ea.disponivel_corretor = true
  ORDER BY
    e.nome;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_all_contact_meta_names_v3()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    contact_record RECORD;
    ad_name_val TEXT;
    campaign_id_val TEXT;
    campaign_name_val TEXT;
    updated_count INTEGER := 0;
BEGIN
    -- Percorre cada contato que tem um ID de anúncio mas não tem o nome preenchido.
    FOR contact_record IN
        SELECT id, meta_ad_id, meta_campaign_id
        FROM public.contatos
        WHERE meta_ad_id IS NOT NULL AND (meta_ad_name IS NULL OR meta_campaign_name IS NULL)
    LOOP
        -- Reseta as variáveis para cada loop
        ad_name_val := NULL;
        campaign_id_val := contact_record.meta_campaign_id;
        campaign_name_val := NULL;

        -- 1. Busca o nome do anúncio e o ID da campanha a partir da tabela de anúncios.
        SELECT "name", campaign_id
        INTO ad_name_val, campaign_id_val
        FROM public.meta_ads
        WHERE id = contact_record.meta_ad_id;

        -- 2. Se encontrou um ID de campanha, busca o nome da campanha.
        IF campaign_id_val IS NOT NULL THEN
            SELECT "name"
            INTO campaign_name_val
            FROM public.meta_campaigns
            WHERE id = campaign_id_val;
        END IF;

        -- 3. Se encontrou algum nome para atualizar, executa o UPDATE no contato específico.
        IF ad_name_val IS NOT NULL OR campaign_name_val IS NOT NULL THEN
            UPDATE public.contatos
            SET
                meta_ad_name = COALESCE(ad_name_val, meta_ad_name), -- Só atualiza se encontrou um nome novo
                meta_campaign_name = COALESCE(campaign_name_val, meta_campaign_name),
                meta_campaign_id = COALESCE(campaign_id_val, meta_campaign_id) -- Garante que o ID também seja salvo
            WHERE id = contact_record.id;

            updated_count := updated_count + 1;
        END IF;
    END LOOP;

    RETURN 'Atualização V3 concluída. ' || updated_count || ' contatos foram processados e atualizados.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_pedidos_cancelados(pedido_ids bigint[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- 1. Deleta os filhos diretos
    DELETE FROM public.pedidos_compra_itens
    WHERE pedido_compra_id = ANY(pedido_ids);
    
    DELETE FROM public.pedidos_compra_anexos
    WHERE pedido_compra_id = ANY(pedido_ids);
    
    DELETE FROM public.pedidos_compra_status_historico
    WHERE pedido_compra_id = ANY(pedido_ids);
    
    DELETE FROM public.pedidos_compra_notas
    WHERE pedido_id = ANY(pedido_ids);

    -- 2. Remove as ligações (FKs) em outras tabelas
    
    -- Link dos Lançamentos Financeiros
    UPDATE public.lancamentos
    SET pedido_compra_id = NULL
    WHERE pedido_compra_id = ANY(pedido_ids);

    /* ===================================================================
     * CORREÇÃO: ADICIONAMOS A ATUALIZAÇÃO NA TABELA DE ESTOQUE
     * O Porquê: Quebra o "elo" com as movimentações de estoque
     * antes de tentar deletar o pedido.
     * ===================================================================
     */
    UPDATE public.movimentacoes_estoque
    SET pedido_compra_id = NULL
    WHERE pedido_compra_id = ANY(pedido_ids);

    -- 3. Finalmente, deleta o pedido (pai)
    DELETE FROM public.pedidos_compra
    WHERE id = ANY(pedido_ids);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_conversations_with_unread_count(p_organizacao_id bigint)
 RETURNS TABLE(contato_id bigint, nome text, last_message text, last_message_sent_at timestamp with time zone, unread_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT
            wm.contato_id,
            ROW_NUMBER() OVER(PARTITION BY wm.contato_id ORDER BY wm.sent_at DESC) as rn,
            wm.content,
            wm.sent_at
        FROM
            public.whatsapp_messages wm
        WHERE
            wm.organizacao_id = p_organizacao_id AND wm.contato_id IS NOT NULL
    ),
    unread_counts AS (
        SELECT
            wm.contato_id,
            COUNT(*) as unread
        FROM
            public.whatsapp_messages wm
        WHERE
            wm.is_read = false AND wm.organizacao_id = p_organizacao_id AND wm.direction = 'inbound' AND wm.contato_id IS NOT NULL
        GROUP BY
            wm.contato_id
    )
    SELECT
        c.id as contato_id,
        c.nome,
        lm.content as last_message,
        lm.sent_at as last_message_sent_at,
        COALESCE(uc.unread, 0) as unread_count
    FROM
        public.contatos c
    JOIN
        latest_messages lm ON c.id = lm.contato_id AND lm.rn = 1
    LEFT JOIN
        unread_counts uc ON c.id = uc.contato_id
    WHERE
        c.organizacao_id = p_organizacao_id
    ORDER BY
        lm.sent_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.corrigir_itens_com_criacao_direta_v2()
 RETURNS TABLE(item_pedido_id_corrigido bigint, descricao_item text, id_do_pedido bigint, id_do_novo_material_criado bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_rec RECORD;
    novo_material_id BIGINT;
BEGIN
    -- Cria uma tabela temporária para o relatório (com a sintaxe corrigida)
    CREATE TEMP TABLE temp_reporte_final_criacao (
        item_pedido_id_corrigido BIGINT,
        descricao_item TEXT,
        id_do_pedido BIGINT,
        id_do_novo_material_criado BIGINT
    ) ON COMMIT DROP;

    -- Loop que passa por cada item de pedido com material_id nulo
    FOR item_rec IN
        SELECT pci.id, pci.descricao_item, pci.unidade_medida, p.organizacao_id, pci.pedido_compra_id
        FROM pedidos_compra_itens AS pci
        JOIN pedidos_compra AS p ON pci.pedido_compra_id = p.id
        WHERE pci.material_id IS NULL AND pci.descricao_item IS NOT NULL AND trim(pci.descricao_item) <> ''
    LOOP
        -- Cria o novo material e captura o ID gerado
        INSERT INTO materiais (nome, descricao, unidade_medida, classificacao, organizacao_id)
        VALUES (
            trim(item_rec.descricao_item),
            trim(item_rec.descricao_item),
            COALESCE(item_rec.unidade_medida, 'unid.'),
            'Insumo',
            item_rec.organizacao_id
        )
        RETURNING id INTO novo_material_id;

        -- Atualiza o item do pedido com o novo ID
        UPDATE pedidos_compra_itens
        SET material_id = novo_material_id
        WHERE id = item_rec.id;

        -- Adiciona a ação ao relatório
        INSERT INTO temp_reporte_final_criacao (item_pedido_id_corrigido, descricao_item, id_do_pedido, id_do_novo_material_criado)
        VALUES (item_rec.id, item_rec.descricao_item, item_rec.pedido_compra_id, novo_material_id);

    END LOOP;

    -- Retorna o relatório completo
    RETURN QUERY SELECT * FROM temp_reporte_final_criacao;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_pedido_entregue_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_pedido RECORD; -- Variável para guardar cada item do pedido no loop
    v_estoque_id bigint; -- Variável para guardar o ID do estoque (existente ou novo)
    v_usuario_id uuid; -- Variável para guardar o ID do usuário que alterou o status (se disponível)
BEGIN
    -- Verifica se a atualização foi para o status 'Entregue'
    -- E se o status antigo era diferente de 'Entregue' (para não rodar de novo se já estava entregue)
    IF NEW.status = 'Entregue' AND OLD.status IS DISTINCT FROM 'Entregue' THEN

        -- Tenta pegar o ID do usuário que fez a alteração (útil para auditoria)
        -- Se não conseguir, usa NULL (ajuste conforme sua necessidade de auditoria)
        BEGIN
            v_usuario_id := auth.uid();
        EXCEPTION WHEN OTHERS THEN
            v_usuario_id := NULL; -- Ou algum usuário padrão do sistema
        END;

        -- Loop através de cada item do pedido que foi atualizado (NEW.id)
        FOR item_pedido IN
            SELECT *
            FROM public.pedidos_compra_itens pci
            WHERE pci.pedido_compra_id = NEW.id
        LOOP
            -- Verifica se o item tem material_id e quantidade válida
            IF item_pedido.material_id IS NOT NULL AND item_pedido.quantidade_solicitada IS NOT NULL AND item_pedido.quantidade_solicitada > 0 THEN

                -- Tenta inserir no estoque. Se já existir, atualiza a quantidade. (UPSERT)
                INSERT INTO public.estoque (
                    empreendimento_id,
                    material_id,
                    quantidade_atual,
                    unidade_medida,
                    organizacao_id,
                    ultima_atualizacao
                )
                VALUES (
                    NEW.empreendimento_id, -- Pega o empreendimento do pedido
                    item_pedido.material_id,
                    item_pedido.quantidade_solicitada,
                    item_pedido.unidade_medida,
                    NEW.organizacao_id, -- Pega a organização do pedido
                    now() -- Data/Hora atual
                )
                ON CONFLICT (empreendimento_id, material_id) -- Chave única para detectar conflito
                DO UPDATE SET
                    quantidade_atual = public.estoque.quantidade_atual + EXCLUDED.quantidade_atual, -- Soma a quantidade nova à existente
                    ultima_atualizacao = now()
                RETURNING id INTO v_estoque_id; -- Salva o ID do estoque (novo ou atualizado) na variável

                -- Registra a movimentação de entrada no estoque
                INSERT INTO public.movimentacoes_estoque (
                    estoque_id,
                    tipo,
                    quantidade,
                    pedido_compra_id,
                    usuario_id, -- ID do usuário que alterou o status do pedido
                    observacao,
                    organizacao_id
                )
                VALUES (
                    v_estoque_id, -- O ID que pegamos do UPSERT acima
                    'Entrada por Compra', -- Tipo válido
                    item_pedido.quantidade_solicitada,
                    NEW.id, -- ID do pedido de compra
                    v_usuario_id, -- Usuário que disparou a ação (pode ser NULL)
                    'Entrada automática via Pedido #' || NEW.id || ' (' || item_pedido.descricao_item || ')',
                    NEW.organizacao_id -- Organização do pedido
                );

            END IF; -- Fim da verificação do item_pedido

        END LOOP; -- Fim do loop pelos itens

    END IF; -- Fim da verificação do status 'Entregue'

    RETURN NEW; -- Necessário para triggers AFTER UPDATE
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preencher_nomes_meta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_ad_name TEXT;
    v_adset_name TEXT;
    v_campaign_name TEXT;
BEGIN
    -- O 'NEW' é uma variável especial que representa a nova linha que está sendo inserida.
    -- Vamos usar os IDs dessa nova linha para buscar os nomes.

    -- 1. Busca o nome do Anúncio (se o ID existir)
    IF NEW.meta_ad_id IS NOT NULL THEN
        SELECT name INTO v_ad_name FROM public.meta_ads WHERE id = NEW.meta_ad_id;
    END IF;

    -- 2. Busca o nome do Conjunto de Anúncios (se o ID existir)
    IF NEW.meta_adgroup_id IS NOT NULL THEN
        SELECT name INTO v_adset_name FROM public.meta_adsets WHERE id = NEW.meta_adgroup_id;
    END IF;
    
    -- 3. Busca o nome da Campanha (se o ID existir)
    IF NEW.meta_campaign_id IS NOT NULL THEN
        SELECT name INTO v_campaign_name FROM public.meta_campaigns WHERE id = NEW.meta_campaign_id;
    END IF;

    -- 4. Atualiza a nova linha com os nomes encontrados ANTES de ela ser salva.
    NEW.meta_ad_name := v_ad_name;
    NEW.meta_adset_name := v_adset_name;
    NEW.meta_campaign_name := v_campaign_name;

    -- 5. Retorna a linha modificada para que o banco de dados possa salvá-la.
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.filtrar_ids_contatos(p_organizacao_id bigint, p_search_term text, p_type_filter text)
 RETURNS TABLE(id bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM public.contatos c
    LEFT JOIN public.telefones t ON c.id = t.contato_id
    WHERE c.organizacao_id = p_organizacao_id
    AND (
        p_type_filter IS NULL 
        OR p_type_filter = 'Todos' 
        OR c.tipo_contato::text = p_type_filter
    )
    AND (
        p_search_term IS NULL 
        OR p_search_term = ''
        -- Busca no Nome e Razão Social
        OR c.nome ILIKE '%' || p_search_term || '%'
        OR c.razao_social ILIKE '%' || p_search_term || '%'
        OR c.nome_fantasia ILIKE '%' || p_search_term || '%'
        -- Busca no Documento (CPF/CNPJ)
        OR c.cpf ILIKE '%' || p_search_term || '%'
        OR c.cnpj ILIKE '%' || p_search_term || '%'
        -- Busca no Telefone (A grande novidade!)
        OR t.telefone ILIKE '%' || p_search_term || '%'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_vgv_possivel(p_organizacao_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    valor_vendido NUMERIC;
    valor_disponivel NUMERIC;
BEGIN
    -- 1. Soma o valor dos contratos JÁ ASSINADOS de empreendimentos listados para venda
    SELECT COALESCE(SUM(c.valor_final_venda), 0)
    INTO valor_vendido
    FROM contratos c
    JOIN empreendimentos e ON c.empreendimento_id = e.id
    WHERE c.organizacao_id = p_organizacao_id
      AND e.listado_para_venda = TRUE
      AND c.status_contrato = 'Assinado';

    -- 2. Soma o valor das unidades AINDA DISPONÍVEIS de empreendimentos listados para venda
    -- =================================================================================
    -- CORREÇÃO APLICADA AQUI
    -- O PORQUÊ: Trocamos "p.valor_venda" por "p.valor_venda_calculado", que é o nome
    -- correto da coluna na sua tabela "produtos_empreendimento".
    -- =================================================================================
    SELECT COALESCE(SUM(p.valor_venda_calculado), 0)
    INTO valor_disponivel
    FROM produtos_empreendimento p
    JOIN empreendimentos e ON p.empreendimento_id = e.id
    WHERE p.organizacao_id = p_organizacao_id
      AND e.listado_para_venda = TRUE
      AND p.status = 'Disponível';

    -- 3. Retorna a soma dos dois valores
    RETURN valor_vendido + valor_disponivel;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_auto_assign_contact()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Se o contato_id não veio preenchido, o vigia entra em ação
  IF NEW.contato_id IS NULL THEN
     NEW.contato_id := find_contact_by_phone(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_contact_by_phone(phone_input text)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
  clean_phone text;
  found_id bigint;
BEGIN
  -- Limpa o número de entrada
  clean_phone := regexp_replace(phone_input, '\D', '', 'g');
  
  SELECT c.id INTO found_id
  FROM telefones t
  JOIN contatos c ON c.id = t.contato_id
  WHERE 
    -- Mesma lógica de busca flexível de antes
    regexp_replace(t.telefone, '\D', '', 'g') = clean_phone
    OR (length(clean_phone) > 11 AND regexp_replace(t.telefone, '\D', '', 'g') = right(clean_phone, -2))
    OR (length(clean_phone) <= 11 AND regexp_replace(t.telefone, '\D', '', 'g') = '55' || clean_phone)
  ORDER BY 
    -- AQUI ESTÁ A MÁGICA:
    -- Prioridade 1: Nome existe e NÃO começa com 'Lead' (Ex: "Raul")
    CASE WHEN c.nome IS NOT NULL AND c.nome NOT ILIKE 'Lead%' THEN 0 ELSE 1 END,
    -- Prioridade 2: Se ambos forem Leads (ou ambos reais), pega o mais recente
    c.created_at DESC 
  LIMIT 1;

  RETURN found_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_latest_ad_snapshots_with_details(p_organizacao_id bigint)
 RETURNS TABLE(ad_id text, ad_name text, campaign_name text, adset_name text, status text, thumbnail_url text, spend numeric, reach integer, impressions integer, leads integer, campaign_id text, adset_id text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    -- Primeiro, encontramos o último "snapshot" de performance para cada anúncio.
    WITH latest_snapshots AS (
        SELECT
            h.ad_id,
            h.spend,
            h.impressions,
            h.reach,
            h.leads,
            -- Esta função mágica classifica os registros de cada anúncio do mais novo para o mais antigo.
            ROW_NUMBER() OVER(PARTITION BY h.ad_id ORDER BY h.data_snapshot DESC) as rn
        FROM
            public.meta_ads_historico h
        WHERE
            h.organizacao_id = p_organizacao_id
    )
    -- Agora, montamos o "dossiê" completo.
    SELECT
        a.id AS ad_id,
        a.name AS ad_name,          -- Nome do anúncio (da tabela meta_ads)
        camp.name AS campaign_name, -- Nome da campanha (da tabela meta_campaigns)
        aset.name AS adset_name,    -- Nome do conjunto (da tabela meta_adsets)
        a.status,                   -- Status atual (da tabela meta_ads)
        a.thumbnail_url,            -- Imagem (da tabela meta_ads)
        ls.spend,                   -- Performance do último dia (do histórico)
        ls.reach,                   -- Performance do último dia (do histórico)
        ls.impressions,             -- Performance do último dia (do histórico)
        ls.leads,                   -- Performance do último dia (do histórico)
        a.campaign_id,              -- ID da campanha para o filtro
        a.adset_id                  -- ID do conjunto para o filtro
    FROM
        public.meta_ads a
    -- Juntamos com o histórico para pegar a performance
    JOIN latest_snapshots ls ON a.id = ls.ad_id
    -- Juntamos com os conjuntos para pegar o nome
    JOIN public.meta_adsets aset ON a.adset_id = aset.id
    -- Juntamos com as campanhas para pegar o nome
    JOIN public.meta_campaigns camp ON a.campaign_id = camp.id
    WHERE
        -- A condição final: só queremos o registro mais recente (o número 1 do ranking)
        ls.rn = 1 AND a.organizacao_id = p_organizacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_activity_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    r RECORD;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        FOR r IN 
            SELECT external_id, projeto_bim_id, organizacao_id 
            FROM public.atividades_elementos
            WHERE atividade_id = NEW.id
        LOOP
            PERFORM public.recalculate_bim_element_status(r.external_id, r.projeto_bim_id, r.organizacao_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_inbox_conversations(p_organizacao_id bigint)
 RETURNS TABLE(id bigint, contato_id bigint, phone_number text, nome text, avatar_url text, unread_count bigint, last_message text, last_message_time timestamp with time zone, message_type text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH grouped_convs AS (
    SELECT 
      COALESCE(wc.contato_id, -wc.id) as group_key,
      MAX(wc.id) as representative_id,
      MAX(wc.updated_at) as last_update
    FROM whatsapp_conversations wc
    GROUP BY 1
  ),
  latest_msg AS (
    SELECT 
      m.contato_id,
      COUNT(*) FILTER (WHERE m.is_read = false AND m.direction = 'inbound') as unread
    FROM whatsapp_messages m
    WHERE m.organizacao_id = p_organizacao_id
    GROUP BY 1
  )
  SELECT 
    gc.representative_id as id,
    c.id as contato_id,
    COALESCE((SELECT t.telefone FROM telefones t WHERE t.contato_id = c.id LIMIT 1), wc.phone_number) as phone_number,
    -- Prioriza o nome do contato. Se for nulo, usa o número formatado
    COALESCE(NULLIF(c.nome, ''), 'Lead (' || wc.phone_number || ')') as nome,
    c.foto_url as avatar_url,
    COALESCE(lm.unread, 0) as unread_count,
    (SELECT content FROM whatsapp_messages wm 
     WHERE (wm.contato_id = c.id AND c.id IS NOT NULL) 
        OR (wm.sender_id = wc.phone_number OR wm.receiver_id = wc.phone_number)
     ORDER BY sent_at DESC LIMIT 1) as last_message,
    gc.last_update as last_message_time,
    'text' as message_type
  FROM grouped_convs gc
  JOIN whatsapp_conversations wc ON wc.id = gc.representative_id
  LEFT JOIN contatos c ON c.id = wc.contato_id
  LEFT JOIN latest_msg lm ON lm.contato_id = c.id
  ORDER BY gc.last_update DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_whatsapp_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_owner_id uuid;
  v_contact_name text;
  v_message_preview text;
BEGIN
  -- Busca o dono
  SELECT criado_por_usuario_id, nome
  INTO v_owner_id, v_contact_name
  FROM public.contatos
  WHERE id = NEW.contato_id;

  -- Só tenta criar notificação se achou um ID válido (UUID)
  IF v_owner_id IS NOT NULL THEN
    
    v_message_preview := substring(NEW.content from 1 for 100);
    IF length(NEW.content) > 100 THEN
        v_message_preview := v_message_preview || '...';
    END IF;

    INSERT INTO public.notificacoes (
      user_id,
      organizacao_id,
      titulo,
      mensagem,
      link,
      lida,
      tipo,
      enviar_push,
      icone,
      created_at
    ) VALUES (
      v_owner_id,  -- Aqui entra o UUID certinho
      NEW.organizacao_id,
      'Nova mensagem de ' || COALESCE(v_contact_name, 'Lead'),
      COALESCE(v_message_preview, 'Mídia recebida'),
      '/chat',                 
      false,
      'whatsapp',
      true,                    
      'fa-brands fa-whatsapp',
      now()
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- BLINDAGEM: Se der qualquer erro na notificação, IGNORA e deixa a mensagem entrar
    RAISE WARNING 'Erro ao criar notificação ignorado para salvar mensagem: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_merge_contacts_and_relink(p_contact_ids bigint[], p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    winner_id bigint;
    loser_id bigint;
    id_iter bigint;
BEGIN
    -- 1. Identificar o Vencedor (O contato mais antigo criado)
    SELECT id INTO winner_id
    FROM public.contatos
    WHERE id = ANY(p_contact_ids)
    AND organizacao_id = p_organizacao_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF winner_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum contato válido encontrado para fusão.';
    END IF;

    -- 2. Loop para processar os "Perdedores"
    FOREACH id_iter IN ARRAY p_contact_ids
    LOOP
        IF id_iter <> winner_id THEN
            loser_id := id_iter;

            -- =========================================================
            -- 1. LISTAS DO WHATSAPP (Lógica Cirúrgica) 🧠
            -- =========================================================
            -- Passo A: Copiar o Vencedor para as listas do Perdedor
            -- O segredo é o "WHERE NOT EXISTS": só insere se o Vencedor AINDA NÃO ESTIVER na lista.
            INSERT INTO public.whatsapp_list_members (lista_id, contato_id, created_at)
            SELECT lista_id, winner_id, created_at
            FROM public.whatsapp_list_members
            WHERE contato_id = loser_id
            AND lista_id NOT IN (
                SELECT lista_id FROM public.whatsapp_list_members WHERE contato_id = winner_id
            );

            -- Passo B: Agora podemos apagar o perdedor de TODAS as listas sem medo
            DELETE FROM public.whatsapp_list_members WHERE contato_id = loser_id;


            -- =========================================================
            -- 2. FUNIL DE VENDAS (Mesma lógica segura)
            -- =========================================================
            -- Se o vencedor NÃO está no funil, trazemos o card do perdedor para ele.
            IF NOT EXISTS (SELECT 1 FROM public.contatos_no_funil WHERE contato_id = winner_id) THEN
                UPDATE public.contatos_no_funil SET contato_id = winner_id WHERE contato_id = loser_id;
            END IF;
            
            -- Se o vencedor JÁ ESTÁ (ou acabamos de mover), o registro do perdedor é lixo. Tchau!
            DELETE FROM public.contatos_no_funil WHERE contato_id = loser_id;


            -- =========================================================
            -- 3. FUNCIONÁRIOS (Vínculo Único)
            -- =========================================================
            IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE contato_id = winner_id) THEN
                 UPDATE public.funcionarios SET contato_id = winner_id WHERE contato_id = loser_id;
            ELSE
                 -- Se já tem vínculo, removemos do perdedor para liberar a exclusão
                 UPDATE public.funcionarios SET contato_id = NULL WHERE contato_id = loser_id;
            END IF;


            -- =========================================================
            -- 4. CONVERSAS DO WHATSAPP (Unique Constraint no Telefone)
            -- =========================================================
            IF NOT EXISTS (SELECT 1 FROM public.whatsapp_conversations WHERE contato_id = winner_id) THEN
                 UPDATE public.whatsapp_conversations SET contato_id = winner_id WHERE contato_id = loser_id;
            ELSE
                 -- Se o vencedor já tem conversa, soltamos o perdedor
                 UPDATE public.whatsapp_conversations SET contato_id = NULL WHERE contato_id = loser_id;
            END IF;
            
            -- Mensagens não tem conflito, pode mover tudo
            UPDATE public.whatsapp_messages SET contato_id = winner_id WHERE contato_id = loser_id;


            -- =========================================================
            -- 5. RELINKAGEM GERAL (Tabelas sem restrição única crítica)
            -- =========================================================
            UPDATE public.telefones SET contato_id = winner_id WHERE contato_id = loser_id;
            UPDATE public.emails SET contato_id = winner_id WHERE contato_id = loser_id;
            UPDATE public.whatsapp_attachments SET contato_id = winner_id WHERE contato_id = loser_id;

            -- Contratos e Comercial
            UPDATE public.contratos SET contato_id = winner_id WHERE contato_id = loser_id;
            UPDATE public.contratos SET corretor_id = winner_id WHERE corretor_id = loser_id;
            UPDATE public.contratos SET conjuge_id = winner_id WHERE conjuge_id = loser_id;
            UPDATE public.contratos SET representante_id = winner_id WHERE representante_id = loser_id;
            
            -- CRM e Atividades
            UPDATE public.crm_notas SET contato_id = winner_id WHERE contato_id = loser_id;
            UPDATE public.simulacoes SET contato_id = winner_id WHERE contato_id = loser_id;
            UPDATE public.activities SET contato_id = winner_id WHERE contato_id = loser_id;
            
            -- Financeiro
            UPDATE public.lancamentos SET favorecido_contato_id = winner_id WHERE favorecido_contato_id = loser_id;
            UPDATE public.pedidos_compra_itens SET fornecedor_id = winner_id WHERE fornecedor_id = loser_id;

            -- Empreendimentos
            UPDATE public.empreendimentos SET incorporadora_id = winner_id WHERE incorporadora_id = loser_id;
            UPDATE public.empreendimentos SET construtora_id = winner_id WHERE construtora_id = loser_id;

            -- Referências Cruzadas
            UPDATE public.contatos SET conjuge_id = winner_id WHERE conjuge_id = loser_id;

            -- =========================================================
            -- 6. O FINAL: EXCLUIR O PERDEDOR
            -- =========================================================
            DELETE FROM public.contatos WHERE id = loser_id;
            
        END IF;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.vincular_conversas_orfas(p_contato_id uuid, p_telefone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_telefone_variacao TEXT;
BEGIN
    -- 1. Tenta vincular pelo número EXATO
    -- Verifica tanto na coluna 'customer_phone' quanto 'phone_number' (dependendo da sua estrutura)
    UPDATE whatsapp_conversations
    SET contato_id = p_contato_id
    WHERE contato_id IS NULL
    AND (
        phone_number = p_telefone 
        OR customer_phone = p_telefone
        OR id::text = p_telefone -- Caso o ID da tabela seja o próprio número
    );

    -- 2. Calcula a Variação do 9º Dígito
    v_telefone_variacao := NULL;

    IF LENGTH(p_telefone) = 13 THEN
        -- Se salvou '55 33 9 8888 8888' (13 dígitos), tenta achar a versão antiga SEM o 9
        -- Remove o 9 que está na 5ª posição (após o 55 + DDD)
        v_telefone_variacao := LEFT(p_telefone, 4) || SUBSTRING(p_telefone FROM 6);
        
    ELSIF LENGTH(p_telefone) = 12 THEN
        -- Se salvou '55 33 8888 8888' (12 dígitos), tenta achar a versão nova COM o 9
        -- Adiciona o 9 na 5ª posição
        v_telefone_variacao := LEFT(p_telefone, 4) || '9' || SUBSTRING(p_telefone FROM 5);
    END IF;

    -- 3. Se existe uma variação, tenta vincular também
    IF v_telefone_variacao IS NOT NULL THEN
        UPDATE whatsapp_conversations
        SET contato_id = p_contato_id
        WHERE contato_id IS NULL
        AND (
            phone_number = v_telefone_variacao 
            OR customer_phone = v_telefone_variacao
            OR id::text = v_telefone_variacao
        );
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_termino_atividade(p_data_inicio date, p_dias_uteis numeric, p_organizacao_id bigint)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_data_atual date;
    v_dias_restantes integer;
    v_eh_fim_de_semana boolean;
    v_eh_feriado boolean;
BEGIN
    -- Se a data ou duração forem inválidas, retorna a própria data ou NULL
    IF p_data_inicio IS NULL OR p_dias_uteis IS NULL THEN
        RETURN NULL;
    END IF;

    -- Se duração for menor ou igual a 1, termina no mesmo dia
    IF p_dias_uteis <= 1 THEN
        RETURN p_data_inicio;
    END IF;

    v_data_atual := p_data_inicio;
    -- Arredonda para cima (ex: 2.5 dias vira 3 dias de calendário de trabalho)
    -- Subtrai 1 porque o dia de início já conta como o primeiro dia
    v_dias_restantes := CEIL(p_dias_uteis) - 1;

    WHILE v_dias_restantes > 0 LOOP
        -- Avança um dia no calendário
        v_data_atual := v_data_atual + 1;

        -- Verifica se é Sábado (6) ou Domingo (0)
        -- EXTRACT(DOW) retorna 0=Dom, 6=Sáb
        v_eh_fim_de_semana := EXTRACT(DOW FROM v_data_atual) IN (0, 6);

        -- Verifica se é Feriado na organização
        SELECT EXISTS (
            SELECT 1 
            FROM public.feriados 
            WHERE data_feriado = v_data_atual 
              AND organizacao_id = p_organizacao_id
        ) INTO v_eh_feriado;

        -- Se for dia útil (não é fds e não é feriado), descontamos do saldo
        IF NOT v_eh_fim_de_semana AND NOT v_eh_feriado THEN
            v_dias_restantes := v_dias_restantes - 1;
        END IF;
    END LOOP;

    RETURN v_data_atual;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_atividades_elementos_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        PERFORM public.recalculate_bim_element_status(NEW.external_id, NEW.projeto_bim_id, NEW.organizacao_id);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_bim_element_status(OLD.external_id, OLD.projeto_bim_id, OLD.organizacao_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_previsao_folha_detalhada(p_organizacao_id bigint, p_mes_ref text)
 RETURNS TABLE(funcionario_id bigint, nome text, cargo text, modelo_contratacao text, salario_base numeric, valor_diaria numeric, dias_considerados numeric, custo_calculado numeric, observacao text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_inicio_mes date;
  v_fim_mes date;
  
  -- Variáveis de Loop
  r_func record;
  v_inicio_efetivo date;
  v_fim_efetivo date;
  
  -- Variáveis de Cálculo
  v_dias_corridos_trab int;
  v_dias_uteis_trab numeric;
  v_custo_individual numeric;
  v_modelo text;
  v_dias_final numeric;
  v_obs text;
  
  -- Auxiliares
  v_dia_loop date;
  v_tipo_feriado text;
BEGIN
  v_inicio_mes := to_date(p_mes_ref, 'YYYY-MM-DD');
  v_fim_mes := (v_inicio_mes + interval '1 month' - interval '1 day')::date;

  FOR r_func IN
    SELECT 
      f.id, 
      f.full_name,
      COALESCE(c.nome, f.contract_role, 'Não definido') as cargo_nome,
      f.admission_date, 
      f.demission_date,
      h.salario_base, 
      h.valor_diaria
    FROM funcionarios f
    LEFT JOIN cargos c ON f.cargo_id = c.id
    LEFT JOIN LATERAL (
      SELECT salario_base, valor_diaria 
      FROM historico_salarial 
      WHERE funcionario_id = f.id 
      ORDER BY data_inicio_vigencia DESC 
      LIMIT 1
    ) h ON true
    WHERE f.organizacao_id = p_organizacao_id
      AND f.status = 'Ativo'
      AND f.admission_date <= v_fim_mes::text
      AND (f.demission_date IS NULL OR f.demission_date >= v_inicio_mes)
    ORDER BY f.full_name
  LOOP
    
    -- 1. Definir Período Efetivo
    v_inicio_efetivo := GREATEST(v_inicio_mes, r_func.admission_date::date);
    IF r_func.demission_date IS NOT NULL THEN
       v_fim_efetivo := LEAST(v_fim_mes, r_func.demission_date::date);
    ELSE
       v_fim_efetivo := v_fim_mes;
    END IF;

    v_obs := '';
    
    -- Verifica se entrou ou saiu no mês para avisar na observação
    IF v_inicio_efetivo > v_inicio_mes THEN v_obs := v_obs || 'Admissão no mês. '; END IF;
    IF v_fim_efetivo < v_fim_mes THEN v_obs := v_obs || 'Demissão no mês. '; END IF;

    -- 2. Calcular conforme Modelo
    IF COALESCE(r_func.salario_base, 0) > 0 THEN
      -- MENSALISTA
      v_modelo := 'Mensalista';
      
      -- Regra 30 dias (Proporcionalidade)
      v_dias_corridos_trab := (v_fim_efetivo - v_inicio_efetivo) + 1;
      
      -- Se trabalhou o mês todo (mesmo que seja Fev com 28 ou Mar com 31), considera 30
      IF v_inicio_efetivo = v_inicio_mes AND v_fim_efetivo = v_fim_mes THEN
         v_dias_final := 30;
         v_custo_individual := r_func.salario_base;
      ELSE
         -- Proporcional: Se trabalhou 31 dias num mês de 31, trava em 30? Geralmente sim.
         IF v_dias_corridos_trab > 30 THEN v_dias_corridos_trab := 30; END IF;
         v_dias_final := v_dias_corridos_trab;
         v_custo_individual := (r_func.salario_base / 30.0) * v_dias_corridos_trab;
      END IF;

    ELSE
      -- DIARISTA
      v_modelo := 'Diarista';
      v_dias_uteis_trab := 0;
      v_dia_loop := v_inicio_efetivo;
      
      WHILE v_dia_loop <= v_fim_efetivo LOOP
        IF EXTRACT(DOW FROM v_dia_loop) NOT IN (0, 6) THEN
          SELECT tipo INTO v_tipo_feriado FROM feriados WHERE organizacao_id = p_organizacao_id AND data_feriado = v_dia_loop;
          IF v_tipo_feriado IS NULL THEN
            v_dias_uteis_trab := v_dias_uteis_trab + 1;
          ELSIF v_tipo_feriado = 'Meio Período' THEN
             v_dias_uteis_trab := v_dias_uteis_trab + 0.5;
          END IF;
        END IF;
        v_dia_loop := v_dia_loop + 1;
      END LOOP;
      
      v_dias_final := v_dias_uteis_trab;
      v_custo_individual := (COALESCE(r_func.valor_diaria, 0) * v_dias_uteis_trab);
    END IF;

    -- 3. Preencher a linha da tabela
    funcionario_id := r_func.id;
    nome := r_func.full_name;
    cargo := r_func.cargo_nome;
    modelo_contratacao := v_modelo;
    salario_base := COALESCE(r_func.salario_base, 0);
    valor_diaria := COALESCE(r_func.valor_diaria, 0);
    dias_considerados := v_dias_final;
    custo_calculado := ROUND(v_custo_individual, 2);
    observacao := TRIM(v_obs);
    
    RETURN NEXT;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_broadcast_stats(p_broadcast_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_msgs integer;
    sent_msgs integer;
    delivered_msgs integer;
    read_msgs integer;
    failed_msgs integer;
BEGIN
    -- Conta mensagens vinculadas a este disparo
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'sent'),
        COUNT(*) FILTER (WHERE status = 'delivered' OR status = 'read'), -- Entregue inclui Lida
        COUNT(*) FILTER (WHERE status = 'read'),
        COUNT(*) FILTER (WHERE status = 'failed')
    INTO 
        total_msgs,
        sent_msgs,
        delivered_msgs,
        read_msgs,
        failed_msgs
    FROM whatsapp_messages
    WHERE broadcast_id = p_broadcast_id;

    -- Retorna um JSON bonitinho
    RETURN json_build_object(
        'total', total_msgs,
        'sent', sent_msgs,
        'delivered', delivered_msgs,
        'read', read_msgs,
        'failed', failed_msgs
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consultar_lancamentos_filtrados(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS SETOF lancamentos
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_query text;
BEGIN
    v_query := '
        SELECT l.* FROM lancamentos l
        LEFT JOIN categorias_financeiras c ON l.categoria_id = c.id
        LEFT JOIN contatos fav ON l.favorecido_contato_id = fav.id
        WHERE l.organizacao_id = ' || p_organizacao_id;

    -- 1. Texto (Busca)
    IF p_filtros->>'searchTerm' IS NOT NULL AND p_filtros->>'searchTerm' <> '' THEN
        v_query := v_query || ' AND (
            l.descricao ILIKE ''%' || (p_filtros->>'searchTerm') || '%'' OR
            fav.nome ILIKE ''%' || (p_filtros->>'searchTerm') || '%'' OR
            c.nome ILIKE ''%' || (p_filtros->>'searchTerm') || '%''
        )';
    END IF;

    -- 2. Datas
    IF p_filtros->>'startDate' IS NOT NULL AND p_filtros->>'startDate' <> '' THEN
        v_query := v_query || ' AND l.data_vencimento >= ''' || (p_filtros->>'startDate') || '''';
    END IF;
    IF p_filtros->>'endDate' IS NOT NULL AND p_filtros->>'endDate' <> '' THEN
        v_query := v_query || ' AND l.data_vencimento <= ''' || (p_filtros->>'endDate') || '''';
    END IF;

    -- 3. Múltipla Escolha
    IF jsonb_array_length(p_filtros->'status') > 0 THEN
        v_query := v_query || ' AND l.status IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'status') || '''))';
    END IF;
    IF jsonb_array_length(p_filtros->'tipo') > 0 THEN
        v_query := v_query || ' AND l.tipo IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'tipo') || '''))';
    END IF;
    IF jsonb_array_length(p_filtros->'contaIds') > 0 THEN
        v_query := v_query || ' AND l.conta_id IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'contaIds') || ''')::bigint)';
    END IF;
    IF jsonb_array_length(p_filtros->'categoriaIds') > 0 THEN
        v_query := v_query || ' AND l.categoria_id IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'categoriaIds') || ''')::bigint)';
    END IF;
    IF jsonb_array_length(p_filtros->'empresaIds') > 0 THEN
        v_query := v_query || ' AND l.empresa_id IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'empresaIds') || ''')::bigint)';
    END IF;
    IF jsonb_array_length(p_filtros->'empreendimentoIds') > 0 THEN
        v_query := v_query || ' AND l.empreendimento_id IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'empreendimentoIds') || ''')::bigint)';
    END IF;
    IF jsonb_array_length(p_filtros->'etapaIds') > 0 THEN
        v_query := v_query || ' AND l.etapa_id IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'etapaIds') || ''')::bigint)';
    END IF;

    -- 4. Filtro de Favorecido
    IF p_filtros->>'favorecidoId' IS NOT NULL THEN
        v_query := v_query || ' AND l.favorecido_contato_id = ' || (p_filtros->>'favorecidoId');
    END IF;

    -- === 5. ATUALIZADO: IGNORAR TRANSFERÊNCIAS E ESTORNOS ===
    -- Oculta se a categoria começar com "Transferência" OU "Estorno"
    IF (p_filtros->>'ignoreTransfers')::boolean IS TRUE THEN
        v_query := v_query || ' AND (c.nome IS NULL OR NOT (
            UNACCENT(c.nome) ILIKE UNACCENT(''Transferência%'') OR 
            UNACCENT(c.nome) ILIKE UNACCENT(''Estorno%'')
        ))';
    END IF;

    RETURN QUERY EXECUTE v_query;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.excluir_categoria_e_migrar(p_categoria_id bigint, p_nova_categoria_id bigint, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- A. Migra ou 'Orfaniza' os lançamentos
  UPDATE lancamentos
  SET categoria_id = p_nova_categoria_id
  WHERE categoria_id = p_categoria_id
  AND organizacao_id = p_organizacao_id;

  -- B. Deleta a categoria antiga
  DELETE FROM categorias_financeiras
  WHERE id = p_categoria_id
  AND organizacao_id = p_organizacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.safe_cast_date(p_text text)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    BEGIN
        RETURN p_text::date; -- Tenta formato padrão (YYYY-MM-DD)
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            RETURN to_date(p_text, 'DD/MM/YYYY'); -- Tenta formato BR
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL; -- Se falhar, devolve NULL (não trava)
        END;
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.safe_cast_money(p_text text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    v_clean_text text;
BEGIN
    IF p_text IS NULL OR p_text = '' THEN RETURN 0; END IF;
    -- Remove tudo que não é número, ponto ou vírgula
    v_clean_text := REGEXP_REPLACE(p_text, '[^0-9,.]', '', 'g');
    -- Se tem vírgula, trata como decimal brasileiro
    IF position(',' in v_clean_text) > 0 THEN
        v_clean_text := REPLACE(v_clean_text, '.', ''); -- Tira ponto de milhar
        v_clean_text := REPLACE(v_clean_text, ',', '.'); -- Vira ponto decimal
    END IF;
    RETURN v_clean_text::numeric;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_contact_smart(phone_input text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  clean_phone text;
  phone_suffix text;
  phone_ddd text;
  is_brazil boolean;
  found_id uuid;
BEGIN
  -- 1. Limpeza: deixa só números
  clean_phone := regexp_replace(phone_input, '[^0-9]', '', 'g');

  -- 2. É Brasil? (Começa com 55 E tem tamanho de celular BR 12/13 digitos)
  is_brazil := (left(clean_phone, 2) = '55' AND length(clean_phone) >= 12);

  -- 🌎 CAMINHO INTERNACIONAL (EUA, etc)
  IF NOT is_brazil THEN
    -- Busca EXATA. Se o webhook salvou 1774..., busca 1774...
    SELECT contato_id INTO found_id
    FROM telefones
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = clean_phone
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN found_id;
  END IF;

  -- 🇧🇷 CAMINHO BRASILEIRO (Lógica flexível do 9º Dígito)
  phone_suffix := right(clean_phone, 8);
  phone_ddd := substring(clean_phone from 3 for 2);

  SELECT contato_id INTO found_id
  FROM telefones
  WHERE 
    (telefone LIKE '%' || phone_ddd || '%') 
    AND
    right(regexp_replace(telefone, '[^0-9]', '', 'g'), 8) = phone_suffix
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN found_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_gerenciar_triggers_notificacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_tabela_alvo TEXT;
    v_nome_trigger TEXT;
    v_existe BOOLEAN;
BEGIN
    v_tabela_alvo := NEW.tabela_alvo;
    v_nome_trigger := 'trg_auto_notificacao_' || v_tabela_alvo;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_alvo) THEN 
        RETURN NEW; 
    END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_table = v_tabela_alvo AND trigger_name = v_nome_trigger) INTO v_existe;

    IF NOT v_existe THEN
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.processar_regras_notificacao();', v_nome_trigger, v_tabela_alvo);
        RAISE NOTICE 'Gatilho automático criado na tabela: %', v_tabela_alvo;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_aggregated_bim_properties(p_external_ids text[], p_projeto_id bigint)
 RETURNS TABLE(categoria_final text, familia_final text, tipo_final text, nivel_final text, status_final text, quantidade_selecionada integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN COUNT(DISTINCT categoria) = 1 THEN MAX(categoria) ELSE '< Vários >' END,
        CASE WHEN COUNT(DISTINCT familia) = 1 THEN MAX(familia) ELSE '< Vários >' END,
        CASE WHEN COUNT(DISTINCT tipo) = 1 THEN MAX(tipo) ELSE '< Vários >' END,
        CASE WHEN COUNT(DISTINCT nivel) = 1 THEN MAX(nivel) ELSE '< Vários >' END,
        CASE WHEN COUNT(DISTINCT status_execucao) = 1 THEN MAX(status_execucao) ELSE '< Vários >' END,
        COUNT(*)::int
    FROM public.elementos_bim
    WHERE external_id = ANY(p_external_ids)
      AND projeto_bim_id = p_projeto_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_merge_contacts_and_relink(p_contact_ids uuid[], p_organizacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    winner_id uuid;
    loser_id uuid;
    id_iter uuid;
BEGIN
    -- 1. O Vencedor é o mais antigo (ou o primeiro da lista)
    SELECT id INTO winner_id
    FROM contatos
    WHERE id = ANY(p_contact_ids)
    ORDER BY created_at ASC
    LIMIT 1;

    -- Loop para processar cada duplicata
    FOREACH id_iter IN ARRAY p_contact_ids LOOP
        IF id_iter <> winner_id THEN
            loser_id := id_iter;

            -- =================================================================
            -- 1. TABELA DE LISTAS (whatsapp_list_members)
            -- Lógica: Apagar do perdedor as listas que o vencedor JÁ TEM.
            --         Depois, substituir o ID nas que sobrarem.
            -- =================================================================
            BEGIN
                -- Apaga intersecção (evita o erro unique_contato_na_lista)
                DELETE FROM whatsapp_list_members
                WHERE contato_id = loser_id
                AND lista_id IN (
                    SELECT lista_id FROM whatsapp_list_members WHERE contato_id = winner_id
                );
                
                -- Substitui o ID nas restantes (UPDATE Simples)
                UPDATE whatsapp_list_members 
                SET contato_id = winner_id 
                WHERE contato_id = loser_id;
            EXCEPTION WHEN OTHERS THEN NULL; END;

            -- =================================================================
            -- 2. TABELA DE FUNIL (contatos_no_funil)
            -- Lógica: Um contato só pode estar em UM lugar do funil.
            -- =================================================================
            IF EXISTS (SELECT 1 FROM contatos_no_funil WHERE contato_id = winner_id) THEN
                -- Se o vencedor já está no funil, removemos o perdedor do funil
                DELETE FROM contatos_no_funil WHERE contato_id = loser_id;
            ELSE
                -- Se o vencedor não está, ele herda a posição do perdedor
                UPDATE contatos_no_funil SET contato_id = winner_id WHERE contato_id = loser_id;
            END IF;

            -- =================================================================
            -- 3. TABELA DE TELEFONES
            -- Lógica: Apaga telefones repetidos, move os novos.
            -- =================================================================
            DELETE FROM telefones
            WHERE contato_id = loser_id
            AND telefone IN (
                SELECT telefone FROM telefones WHERE contato_id = winner_id
            );
            UPDATE telefones SET contato_id = winner_id WHERE contato_id = loser_id;

            -- =================================================================
            -- 4. ATUALIZAR TODO O RESTANTE (Substituição de ID Direta)
            -- =================================================================
            
            -- WhatsApp
            UPDATE whatsapp_conversations SET contato_id = winner_id WHERE contato_id = loser_id;
            UPDATE whatsapp_messages SET contato_id = winner_id WHERE contato_id = loser_id;
            BEGIN UPDATE whatsapp_attachments SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;

            -- Notas e E-mails
            BEGIN UPDATE crm_notas SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            BEGIN UPDATE emails SET contato_id = winner_id WHERE contato_id = loser_id; EXCEPTION WHEN OTHERS THEN NULL; END;
            
            -- Outros vínculos possíveis (adicione se necessário)
            -- UPDATE tarefas SET contato_id = winner_id WHERE contato_id = loser_id;

            -- =================================================================
            -- 5. EXCLUIR O CONTATO ANTIGO
            -- =================================================================
            DELETE FROM contatos WHERE id = loser_id;
            
        END IF;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_rh_dashboard_stats(p_organizacao_id bigint, p_mes_ref date)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_ativos integer;
    v_admissoes integer;
    v_demissoes integer;
    v_aniversariantes integer;
    v_tempo_medio numeric;
    v_custo_folha numeric;
    v_distribuicao_cargos jsonb;
    v_inicio_mes date := date_trunc('month', p_mes_ref);
    v_fim_mes date := (date_trunc('month', p_mes_ref) + interval '1 month' - interval '1 day')::date;
BEGIN
    -- Contagens Básicas
    SELECT COUNT(*) INTO v_total_ativos 
    FROM funcionarios 
    WHERE status = 'Ativo' AND organizacao_id = p_organizacao_id;
    
    SELECT COUNT(*) INTO v_admissoes 
    FROM funcionarios 
    WHERE admission_date::date BETWEEN v_inicio_mes AND v_fim_mes AND organizacao_id = p_organizacao_id;
    
    SELECT COUNT(*) INTO v_demissoes 
    FROM funcionarios 
    WHERE demission_date BETWEEN v_inicio_mes AND v_fim_mes AND organizacao_id = p_organizacao_id;

    -- Aniversariantes
    SELECT COUNT(*) INTO v_aniversariantes 
    FROM funcionarios 
    WHERE EXTRACT(MONTH FROM birth_date::date) = EXTRACT(MONTH FROM p_mes_ref) 
    AND status = 'Ativo' AND organizacao_id = p_organizacao_id;

    -- Tempo Médio
    SELECT COALESCE(AVG(
        EXTRACT(YEAR FROM age(CURRENT_DATE, admission_date::date)) * 12 + 
        EXTRACT(MONTH FROM age(CURRENT_DATE, admission_date::date))
    ), 0) INTO v_tempo_medio
    FROM funcionarios WHERE status = 'Ativo' AND organizacao_id = p_organizacao_id;

    -- Custo Folha (CORREÇÃO DE FORMATO: Troca vírgula por ponto)
    SELECT COALESCE(SUM(
        CASE 
            WHEN base_salary IS NULL OR base_salary = '' THEN 0
            ELSE 
                COALESCE(
                    CAST(
                        NULLIF(
                            REPLACE(
                                REGEXP_REPLACE(base_salary, '[^0-9,]', '', 'g'), -- Remove "R$", pontos de milhar e espaços
                                ',', '.' -- Troca a vírgula decimal por ponto
                            ), 
                            ''
                        ) 
                    AS numeric),
                    0
                )
        END
    ), 0) INTO v_custo_folha
    FROM funcionarios WHERE status = 'Ativo' AND organizacao_id = p_organizacao_id;

    -- Distribuição por Cargo
    SELECT jsonb_agg(t) INTO v_distribuicao_cargos FROM (
        SELECT 
            COALESCE(c.nome, 'Cargo não definido') as nome, 
            COUNT(f.id) as valor
        FROM funcionarios f
        LEFT JOIN cargos c ON f.cargo_id = c.id
        WHERE f.status = 'Ativo' AND f.organizacao_id = p_organizacao_id
        GROUP BY c.nome
        ORDER BY valor DESC
    ) t;

    RETURN jsonb_build_object(
        'total_ativos', v_total_ativos,
        'admissoes', v_admissoes,
        'demissoes', v_demissoes,
        'aniversariantes', v_aniversariantes,
        'tempo_medio_meses', ROUND(v_tempo_medio, 1),
        'custo_folha', v_custo_folha,
        'distribuicao_cargos', COALESCE(v_distribuicao_cargos, '[]'::jsonb),
        'dias_uteis_mes', 22
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_resumo_financeiro(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS TABLE(tipo_lancamento text, status_lancamento text, valor_total numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_query text;
BEGIN
    -- Começa a query base filtrando pela organização
    v_query := 'SELECT tipo, status, SUM(valor) as valor_total FROM lancamentos WHERE organizacao_id = ' || p_organizacao_id;

    -- 1. Filtro de Transferências (Ignorar)
    IF (p_filtros->>'ignoreTransfers')::boolean IS TRUE THEN
        v_query := v_query || ' AND transferencia_id IS NULL';
    END IF;

    -- 2. Filtro de Busca Textual (Descrição)
    IF (p_filtros->>'searchTerm') IS NOT NULL AND (p_filtros->>'searchTerm') <> '' THEN
        v_query := v_query || ' AND descricao ILIKE ''%' || (p_filtros->>'searchTerm') || '%''';
    END IF;

    -- 3. Filtro de Datas (Vencimento)
    IF (p_filtros->>'startDate') IS NOT NULL AND (p_filtros->>'startDate') <> '' THEN
        v_query := v_query || ' AND data_vencimento >= ''' || (p_filtros->>'startDate') || '''::date';
    END IF;
    IF (p_filtros->>'endDate') IS NOT NULL AND (p_filtros->>'endDate') <> '' THEN
        v_query := v_query || ' AND data_vencimento <= ''' || (p_filtros->>'endDate') || '''::date';
    END IF;

    -- 4. Filtros de Múltipla Seleção (Arrays)
    -- Contas
    IF jsonb_array_length(p_filtros->'contaIds') > 0 THEN
        v_query := v_query || ' AND conta_id IN (SELECT (jsonb_array_elements_text(''' || (p_filtros->'contaIds') || '''::jsonb))::bigint)';
    END IF;
    -- Categorias
    IF jsonb_array_length(p_filtros->'categoriaIds') > 0 THEN
        v_query := v_query || ' AND categoria_id IN (SELECT (jsonb_array_elements_text(''' || (p_filtros->'categoriaIds') || '''::jsonb))::bigint)';
    END IF;
    -- Empresas
    IF jsonb_array_length(p_filtros->'empresaIds') > 0 THEN
        v_query := v_query || ' AND empresa_id IN (SELECT (jsonb_array_elements_text(''' || (p_filtros->'empresaIds') || '''::jsonb))::bigint)';
    END IF;
    -- Empreendimentos
    IF jsonb_array_length(p_filtros->'empreendimentoIds') > 0 THEN
        v_query := v_query || ' AND empreendimento_id IN (SELECT (jsonb_array_elements_text(''' || (p_filtros->'empreendimentoIds') || '''::jsonb))::bigint)';
    END IF;
    -- Favorecido
    IF (p_filtros->>'favorecidoId') IS NOT NULL THEN
        v_query := v_query || ' AND favorecido_contato_id = ' || (p_filtros->>'favorecidoId');
    END IF;

    -- 5. Filtro de Status (A Lógica Poderosa aqui!)
    IF jsonb_array_length(p_filtros->'status') > 0 THEN
        v_query := v_query || ' AND (';
        
        -- Lógica para 'Pago'
        IF p_filtros->'status' @> '"Pago"'::jsonb OR p_filtros->'status' @> '"Conciliado"'::jsonb THEN
             v_query := v_query || ' status IN (''Pago'', ''Conciliado'')';
        END IF;

        -- Conector OR se tiver multiplos status selecionados
        IF (p_filtros->'status' @> '"Pago"'::jsonb OR p_filtros->'status' @> '"Conciliado"'::jsonb) 
           AND (p_filtros->'status' @> '"Pendente"'::jsonb OR p_filtros->'status' @> '"Atrasada"'::jsonb) THEN
            v_query := v_query || ' OR ';
        END IF;

        -- Lógica para 'Pendente' (Geral)
        IF p_filtros->'status' @> '"Pendente"'::jsonb THEN
             v_query := v_query || ' status = ''Pendente''';
        
        -- Lógica para 'Atrasada' (Específico: Pendente E Vencido)
        ELSIF p_filtros->'status' @> '"Atrasada"'::jsonb THEN
             v_query := v_query || ' (status = ''Pendente'' AND data_vencimento < CURRENT_DATE)';
        END IF;

        v_query := v_query || ')';
    END IF;
    
    -- 6. Filtro de Tipo (Receita/Despesa)
    IF jsonb_array_length(p_filtros->'tipo') > 0 THEN
        v_query := v_query || ' AND tipo IN (SELECT jsonb_array_elements_text(''' || (p_filtros->'tipo') || '''::jsonb))';
    END IF;

    -- Agrupamento Final
    v_query := v_query || ' GROUP BY tipo, status';

    RETURN QUERY EXECUTE v_query;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_message_update_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_phone_raw text;
    v_phone_clean text;
    v_direction text;
    v_status text;
    v_existing_conv_id bigint;
BEGIN
    -- 1. Quem é o número alvo?
    IF NEW.direction = 'outbound' THEN
        v_phone_raw := NEW.receiver_id;
        v_direction := 'outbound';
        v_status := NEW.status;
    ELSE
        v_phone_raw := NEW.sender_id;
        v_direction := 'inbound';
        v_status := 'received';
    END IF;

    -- 2. Normaliza para busca (Remove + e caracteres)
    v_phone_clean := regexp_replace(v_phone_raw, '[^0-9]', '', 'g');

    -- 3. Tenta encontrar conversa existente (Busca Flexível)
    -- Isso impede que 5533... crie uma nova se 33... já existir
    SELECT id INTO v_existing_conv_id
    FROM public.whatsapp_conversations
    WHERE 
        regexp_replace(phone_number, '[^0-9]', '', 'g') = v_phone_clean
        AND organizacao_id = NEW.organizacao_id
    LIMIT 1;

    -- 4. Atualiza ou Cria
    IF v_existing_conv_id IS NOT NULL THEN
        UPDATE public.whatsapp_conversations
        SET 
            updated_at = NEW.created_at,
            last_message_id = NEW.id,
            last_message_direction = v_direction,
            last_status = v_status,
            contato_id = COALESCE(contato_id, NEW.contato_id),
            unread_count = CASE WHEN v_direction = 'inbound' THEN unread_count + 1 ELSE unread_count END,
            is_archived = false -- Traz a conversa de volta se estiver arquivada
        WHERE id = v_existing_conv_id;
        
        NEW.conversation_record_id := v_existing_conv_id;
    ELSE
        -- Criação Blindada
        INSERT INTO public.whatsapp_conversations (
            phone_number, contato_id, organizacao_id, created_at, updated_at, 
            last_message_id, last_direction, last_status, unread_count, is_archived
        )
        VALUES (
            v_phone_raw, NEW.contato_id, NEW.organizacao_id, NEW.created_at, NEW.created_at, 
            NEW.id, v_direction, v_status, CASE WHEN v_direction = 'inbound' THEN 1 ELSE 0 END, false
        )
        RETURNING id INTO v_existing_conv_id;

        NEW.conversation_record_id := v_existing_conv_id;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.faxina_nuclear_por_dono()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    r_grupo RECORD;
    v_vencedor_id bigint;
    v_ids_perdedores bigint[];
    v_total_grupos int := 0;
    v_total_deletados int := 0;
BEGIN
    -- 1. Encontra contatos que possuem mais de uma conversa aberta
    FOR r_grupo IN
        SELECT 
            contato_id,
            -- O Vencedor é a conversa atualizada mais recentemente (a última que teve ação)
            ARRAY_AGG(id ORDER BY updated_at DESC) as ids
        FROM public.whatsapp_conversations
        WHERE contato_id IS NOT NULL
        GROUP BY contato_id
        HAVING COUNT(*) > 1
    LOOP
        -- O primeiro da lista (mais recente) vence e fica vivo
        v_vencedor_id := r_grupo.ids[1];
        
        -- O resto (antigos) serão sacrificados
        v_ids_perdedores := r_grupo.ids[2:array_length(r_grupo.ids, 1)];

        -- 2. Move as mensagens órfãs para a conversa vencedora
        UPDATE public.whatsapp_messages
        SET conversation_record_id = v_vencedor_id
        WHERE conversation_record_id = ANY(v_ids_perdedores);

        -- 3. Exclui as conversas duplicadas
        DELETE FROM public.whatsapp_conversations
        WHERE id = ANY(v_ids_perdedores);

        v_total_grupos := v_total_grupos + 1;
        v_total_deletados := v_total_deletados + array_length(v_ids_perdedores, 1);
    END LOOP;

    RETURN 'Faxina Nuclear Concluída: ' || v_total_grupos || ' contatos unificados. ' || v_total_deletados || ' conversas duplicadas foram excluídas.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_rh_yearly_stats(p_organizacao_id bigint, p_ano integer)
 RETURNS TABLE(mes integer, admissoes bigint, demissoes bigint, ativos bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(1, 12) AS m
  ),
  funcionarios_tratados AS (
    SELECT 
      id,
      organizacao_id,
      demission_date,
      -- Tenta converter a admissão (texto) para Data real
      CASE 
        WHEN admission_date LIKE '%/%' THEN to_date(admission_date, 'DD/MM/YYYY') -- Formato BR
        WHEN admission_date LIKE '%-%' THEN to_date(admission_date, 'YYYY-MM-DD') -- Formato ISO
        ELSE NULL -- Se for lixo, ignora
      END AS data_admissao_real
    FROM funcionarios
    WHERE organizacao_id = p_organizacao_id
  )
  SELECT 
    ms.m AS mes,
    
    -- 1. ADMISSÕES
    (SELECT count(*) FROM funcionarios_tratados f 
     WHERE f.data_admissao_real IS NOT NULL 
     AND extract(year FROM f.data_admissao_real) = p_ano 
     AND extract(month FROM f.data_admissao_real) = ms.m) AS admissoes,
     
    -- 2. DEMISSÕES (Esse já é date, mais fácil)
    (SELECT count(*) FROM funcionarios_tratados f 
     WHERE f.demission_date IS NOT NULL
     AND extract(year FROM f.demission_date) = p_ano 
     AND extract(month FROM f.demission_date) = ms.m) AS demissoes,

    -- 3. ATIVOS (Saldo)
    (SELECT count(*) FROM funcionarios_tratados f 
     WHERE f.data_admissao_real IS NOT NULL
     -- Entrou até o fim deste mês
     AND f.data_admissao_real <= (make_date(p_ano, ms.m, 1) + interval '1 month' - interval '1 day')
     -- E (NÃO saiu OU saiu DEPOIS desse mês)
     AND (f.demission_date IS NULL OR f.demission_date > (make_date(p_ano, ms.m, 1) + interval '1 month' - interval '1 day'))
    ) AS ativos
  FROM meses ms;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_auditoria_kanban(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_where text;
  v_result jsonb;
BEGIN
  -- 1. O Cérebro: Usa a função central para montar o filtro (Lei de Fernanda)
  v_where := financeiro_montar_where(p_organizacao_id, p_filtros);

  -- 2. Executa a query dinâmica
  EXECUTE '
    WITH dados_brutos AS (
      SELECT 
        l.*,
        
        -- AQUI: Calculamos a data efetiva APENAS PARA EXIBIÇÃO
        -- (A filtragem já foi feita pelo v_where abaixo)
        CASE 
            WHEN l.data_pagamento IS NOT NULL THEN l.data_pagamento 
            WHEN l.data_vencimento IS NOT NULL THEN l.data_vencimento 
            ELSE l.data_transacao 
        END as data_efetiva,

        (select jsonb_build_object(''id'', c.id, ''nome'', c.nome) from contas_financeiras c where c.id = l.conta_id) as conta,
        (select jsonb_build_object(''id'', cat.id, ''nome'', cat.nome) from categorias_financeiras cat where cat.id = l.categoria_id) as categoria,
        (select jsonb_build_object(''id'', fav.id, ''nome'', fav.nome, ''razao_social'', fav.razao_social) from contatos fav where fav.id = l.favorecido_contato_id) as favorecido,
        
        -- Verifica se tem anexos
        EXISTS(SELECT 1 FROM lancamentos_anexos an WHERE an.lancamento_id = l.id) as tem_anexo,
        
        -- Traz os anexos
        (select json_agg(jsonb_build_object(''id'', an.id, ''caminho_arquivo'', an.caminho_arquivo, ''nome_arquivo'', an.nome_arquivo)) from lancamentos_anexos an where an.lancamento_id = l.id) as anexos_detalhes
      FROM lancamentos l
      ' || v_where || '
    )
    SELECT jsonb_build_object(
      ''sem_anexo'', COALESCE(jsonb_agg(d.*) FILTER (WHERE d.tipo = ''Despesa'' AND d.tem_anexo = false AND d.status_auditoria_ia NOT IN (''Aprovado'')), ''[]''::jsonb),
      ''fila_ia'', COALESCE(jsonb_agg(d.*) FILTER (WHERE d.tem_anexo = true AND d.status_auditoria_ia IN (''Nao Auditado'', ''Pendente'')), ''[]''::jsonb),
      ''divergente'', COALESCE(jsonb_agg(d.*) FILTER (WHERE d.status_auditoria_ia IN (''Divergente'', ''Erro'')), ''[]''::jsonb),
      ''aprovado'', COALESCE(jsonb_agg(d.*) FILTER (WHERE d.status_auditoria_ia = ''Aprovado''), ''[]''::jsonb)
    )
    FROM dados_brutos d;
  ' INTO v_result;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_populate_meta_names()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.meta_campaign_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.meta_campaign_id IS DISTINCT FROM OLD.meta_campaign_id) THEN
        NEW.meta_campaign_name := (SELECT nome FROM public.meta_ativos WHERE id = NEW.meta_campaign_id LIMIT 1);
    END IF;

    IF NEW.meta_ad_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.meta_ad_id IS DISTINCT FROM OLD.meta_ad_id) THEN
        NEW.meta_ad_name := (SELECT nome FROM public.meta_ativos WHERE id = NEW.meta_ad_id LIMIT 1);
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contatos_columns()
 RETURNS TABLE(column_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return query
  select c.column_name::text
  from information_schema.columns c
  where c.table_schema = 'public'
  and c.table_name = 'contatos'
  -- Esconde colunas técnicas que não servem para mapeamento
  and c.column_name not in (
    'id', 'created_at', 'organizacao_id', 'empresa_id', 'search_vector', 
    'meta_form_data', 'meta_lead_id', 'meta_page_id', 'meta_form_id',
    'meta_ad_id', 'meta_adgroup_id', 'meta_campaign_id', 'meta_created_time',
    'meta_ad_name', 'meta_campaign_name', 'meta_adset_name',
    'criado_por', 'criado_por_usuario_id', 'lixeira', 'telefones', 'emails',
    'search_text', 'search_index'
  )
  order by c.column_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_ranking_faltas(p_organizacao_id bigint, p_mes_ref text)
 RETURNS TABLE(nome text, cargo text, qtd bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_inicio_mes date;
    v_fim_mes date;
    v_ontem date;
    v_timezone text := 'America/Sao_Paulo';
BEGIN
    v_inicio_mes := (p_mes_ref || '-01')::date;
    v_fim_mes := (v_inicio_mes + interval '1 month' - interval '1 day')::date;
    v_ontem := (NOW() AT TIME ZONE v_timezone)::date - 1;

    RETURN QUERY
    WITH calendario_mes AS (
        -- Gera dias até ONTEM
        SELECT generate_series(v_inicio_mes, LEAST(v_fim_mes, v_ontem), '1 day'::interval)::date AS data_dia
    )
    SELECT 
        f.full_name::text,
        COALESCE(c.nome, 'Cargo n/d')::text,
        COUNT(*)::bigint
    FROM calendario_mes cm
    CROSS JOIN funcionarios f
    LEFT JOIN cargos c ON f.cargo_id = c.id
    
    -- Filtra apenas dias de trabalho configurados na jornada
    INNER JOIN jornada_detalhes jd ON f.jornada_id = jd.jornada_id 
         AND jd.dia_semana = EXTRACT(DOW FROM cm.data_dia)::integer
         AND jd.horario_entrada IS NOT NULL -- Se for NULL, é folga
         
    -- Verificações de Imunidade
    LEFT JOIN feriados fer ON fer.data_feriado = cm.data_dia AND fer.organizacao_id = p_organizacao_id
    LEFT JOIN abonos a ON a.funcionario_id = f.id AND a.data_abono = cm.data_dia
    LEFT JOIN pontos p ON p.funcionario_id = f.id AND (p.data_hora AT TIME ZONE v_timezone)::date = cm.data_dia
    
    WHERE f.status = 'Ativo' 
      AND f.organizacao_id = p_organizacao_id
      -- Filtro de contrato
      AND (CASE WHEN f.admission_date IS NULL OR TRIM(f.admission_date::text) = '' THEN NULL ELSE f.admission_date::date END) <= cm.data_dia
      AND ((CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) IS NULL 
           OR (CASE WHEN f.demission_date IS NULL OR TRIM(f.demission_date::text) = '' THEN NULL ELSE f.demission_date::date END) >= cm.data_dia)
      -- Condições da Falta
      AND fer.id IS NULL 
      AND a.id IS NULL   
      AND p.id IS NULL   
      
    GROUP BY f.full_name, c.nome
    ORDER BY COUNT(*) DESC
    LIMIT 5;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_whatsapp_conversations_v2(p_organizacao_id bigint)
 RETURNS TABLE(conversation_id bigint, phone_number text, contato_id bigint, nome text, avatar_url text, unread_count integer, last_message_content text, last_message_at timestamp with time zone, last_direction text, last_status text, tipo_contato text, etapa_funil text, is_archived boolean, last_inbound_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        wc.id as conversation_id,
        wc.phone_number,
        wc.contato_id,
        c.nome,
        c.foto_url as avatar_url,
        wc.unread_count,
        wm.content as last_message_content,
        wc.updated_at as last_message_at,
        wc.last_direction, -- 'inbound' ou 'outbound'
        wc.last_status,
        c.tipo_contato::text,
        col.nome as etapa_funil,
        wc.is_archived,
        -- Busca a data da última mensagem recebida para o timer de 24h
        (SELECT MAX(sent_at) FROM whatsapp_messages m WHERE m.conversation_record_id = wc.id AND m.direction = 'inbound') as last_inbound_at
    FROM 
        public.whatsapp_conversations wc
    LEFT JOIN 
        public.contatos c ON wc.contato_id = c.id
    LEFT JOIN 
        public.whatsapp_messages wm ON wc.last_message_id = wm.id
    LEFT JOIN
        public.contatos_no_funil cnf ON c.id = cnf.contato_id
    LEFT JOIN
        public.colunas_funil col ON cnf.coluna_id = col.id
    WHERE 
        wc.organizacao_id = p_organizacao_id
    ORDER BY 
        wc.updated_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ai_context_data(p_organizacao_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_empreendimentos json;
  v_funcionarios json;
  v_etapas json;
  v_tipos_atividade json;
  v_contatos_recentes json;
begin

  -- 1. Busca Empreendimentos Ativos (ID e Nome)
  select json_agg(t) into v_empreendimentos
  from (
    select id, nome 
    from empreendimentos 
    where organizacao_id = p_organizacao_id 
    and status not in ('Concluído', 'Entregue', 'Cancelado')
    order by nome
  ) t;

  -- 2. Busca Funcionários Ativos (ID, Nome e Cargo)
  select json_agg(t) into v_funcionarios
  from (
    select f.id, f.full_name as nome, c.nome as cargo
    from funcionarios f
    left join cargos c on f.cargo_id = c.id
    where f.organizacao_id = p_organizacao_id 
    and f.status = 'Ativo'
    order by f.full_name
  ) t;

  -- 3. Busca Etapas de Obra (ID e Nome) - Essencial para categorizar
  select json_agg(t) into v_etapas
  from (
    select id, nome_etapa as nome 
    from etapa_obra 
    where organizacao_id = p_organizacao_id 
    order by nome_etapa
  ) t;

  -- 4. Busca Contatos Recentes (Para reuniões comerciais)
  -- Limitamos aos 50 últimos para não estourar o contexto, focando nos "quentes"
  select json_agg(t) into v_contatos_recentes
  from (
    select id, nome, razao_social
    from contatos 
    where organizacao_id = p_organizacao_id 
    and status = 'Ativo'
    order by created_at desc
    limit 50
  ) t;

  -- 5. Tipos de Atividade (Hardcoded ou busca se tiver tabela, aqui simulamos os comuns)
  -- Isso ajuda a IA a escolher o tipo certo do enum/campo
  v_tipos_atividade := '[
    "Reunião", 
    "Visita Técnica", 
    "Serviço", 
    "Ligação", 
    "Email", 
    "Documentação", 
    "Prospecção", 
    "Outros"
  ]'::json;

  -- Retorna tudo num pacotão JSON
  return json_build_object(
    'empreendimentos', coalesce(v_empreendimentos, '[]'::json),
    'funcionarios', coalesce(v_funcionarios, '[]'::json),
    'etapas', coalesce(v_etapas, '[]'::json),
    'contatos_recentes', coalesce(v_contatos_recentes, '[]'::json),
    'tipos_atividade', v_tipos_atividade
  );

end;
$function$
;

CREATE OR REPLACE FUNCTION public.extrair_objetivo_meta(meta_data jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    chave text;
    valor text;
BEGIN
    -- Se não tiver dados, retorna nulo
    IF meta_data IS NULL THEN 
        RETURN NULL; 
    END IF;

    -- Passa por todas as chaves (perguntas) do formulário
    FOR chave IN SELECT jsonb_object_keys(meta_data)
    LOOP
        -- Se a chave contiver a palavra "objetivo" (maiúscula ou minúscula)
        IF lower(chave) LIKE '%objetivo%' THEN
            -- Pega o valor da resposta limpo (sem aspas de JSON)
            valor := meta_data ->> chave;
            RETURN valor;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_saldo_anterior(p_conta_id bigint, p_data_inicio date, p_organizacao_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    saldo_inicial_conta numeric;
    total_receitas numeric;
    total_despesas numeric;
BEGIN
    SELECT COALESCE(saldo_inicial, 0)
    INTO saldo_inicial_conta
    FROM public.contas_financeiras
    WHERE id = p_conta_id AND organizacao_id = p_organizacao_id;

    SELECT COALESCE(SUM(ABS(valor)), 0)
    INTO total_receitas
    FROM public.lancamentos
    WHERE conta_id = p_conta_id
      AND organizacao_id = p_organizacao_id
      AND data_pagamento < p_data_inicio
      AND tipo = 'Receita'
      AND status IN ('Pago', 'Conciliado');

    SELECT COALESCE(SUM(ABS(valor)), 0)
    INTO total_despesas
    FROM public.lancamentos
    WHERE conta_id = p_conta_id
      AND organizacao_id = p_organizacao_id
      AND data_pagamento < p_data_inicio
      AND tipo = 'Despesa'
      AND status IN ('Pago', 'Conciliado');

    RETURN saldo_inicial_conta + total_receitas - total_despesas;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_preco_ultima_compra()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verifica se existe um preço real preenchido e se é maior que zero
    IF NEW.preco_unitario_real IS NOT NULL AND NEW.preco_unitario_real > 0 THEN
        
        -- Atualiza a tabela MESTRA de materiais com esse novo preço
        UPDATE public.materiais
        SET 
            preco_unitario = NEW.preco_unitario_real,
            -- Podemos aproveitar para atualizar a descrição se ela vier vazia no cadastro original?
            -- (Opcional, deixei comentado)
            -- descricao = COALESCE(descricao, NEW.descricao_item),
            updated_at = NOW()
        WHERE id = NEW.material_id;
        
        -- (Opcional) Se quiser atualizar também o SINAPI (caso você compre itens SINAPI)
        -- UPDATE public.sinapi
        -- SET preco_unitario = NEW.preco_unitario_real
        -- WHERE id = NEW.sinapi_id; 
        
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_unread_counts(p_account_id uuid)
 RETURNS TABLE(path text, count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT folder_path as path, COUNT(*) as count
    FROM email_messages_cache
    WHERE account_id = p_account_id
    AND is_read = false
    GROUP BY folder_path;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_contact_funnel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_funil_id uuid;
    v_coluna_id uuid;
BEGIN
    -- Só processa se for da mesma organização
    -- (Opcional: Você pode filtrar por tipo se quiser, ex: IF NEW.tipo_contato = 'Lead' THEN...)

    -- 2. Busca o Funil Principal da Organização (o primeiro criado)
    SELECT id INTO v_funil_id
    FROM public.funis
    WHERE organizacao_id = NEW.organizacao_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- 3. Busca a Primeira Coluna desse Funil (onde tem ordem menor, ex: 0 ou 1)
    SELECT id INTO v_coluna_id
    FROM public.colunas_funil
    WHERE funil_id = v_funil_id
    ORDER BY ordem ASC
    LIMIT 1;

    -- 4. Insere o Contato no Funil (Se achou funil e coluna)
    IF v_coluna_id IS NOT NULL THEN
        INSERT INTO public.contatos_no_funil (
            contato_id, 
            coluna_id, 
            organizacao_id, 
            created_at
        )
        VALUES (
            NEW.id, 
            v_coluna_id, 
            NEW.organizacao_id, 
            now()
        )
        ON CONFLICT (contato_id) DO NOTHING; -- Se já estiver lá, tudo bem, segue a vida
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Segurança: Se der erro no funil, NÃO impede a criação do contato. 
        -- Apenas avisa no log e deixa passar.
        RAISE WARNING 'Erro ao adicionar contato % ao funil: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_contact_objetivo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Só preenche se o objetivo estiver vazio E tivermos dados do Meta
    IF NEW.objetivo IS NULL AND NEW.meta_form_data IS NOT NULL THEN
        NEW.objetivo := public.extrair_objetivo_meta(NEW.meta_form_data);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_kpi_financeiro(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total numeric;
    -- Variáveis para os filtros
    v_filtro_contas jsonb;
    v_filtro_categorias jsonb;
    v_filtro_status jsonb;
    v_filtro_tipo jsonb;
    v_filtro_empresa jsonb;
    v_filtro_empreendimento jsonb;
    v_filtro_etapa jsonb;
    v_data_inicio text;
    v_data_fim text;
    v_favorecido_id bigint;
    v_ignorar_transferencias boolean;
BEGIN
    -- 1. Extração dos dados do JSON
    v_filtro_contas := p_filtros->'contaIds';
    v_filtro_categorias := p_filtros->'categoriaIds';
    v_filtro_status := p_filtros->'status';
    v_filtro_tipo := p_filtros->'tipo';
    v_filtro_empresa := p_filtros->'empresaIds';
    v_filtro_empreendimento := p_filtros->'empreendimentoIds';
    v_filtro_etapa := p_filtros->'etapaIds';
    
    v_data_inicio := NULLIF(TRIM(p_filtros->>'startDate'), '');
    v_data_fim := NULLIF(TRIM(p_filtros->>'endDate'), '');
    
    -- Tratamento para favorecido
    IF (p_filtros->>'favorecidoId') IS NOT NULL AND (p_filtros->>'favorecidoId') <> 'null' THEN
        v_favorecido_id := (p_filtros->>'favorecidoId')::bigint;
    ELSE
        v_favorecido_id := NULL;
    END IF;

    -- Tratamento para Ignorar Transferências
    v_ignorar_transferencias := COALESCE((p_filtros->>'ignoreTransfers')::boolean, false);

    -- 2. A Query de Cálculo
    -- IMPORTANTE: Usamos CASE para subtrair despesas, garantindo que o saldo bata com o painel principal
    SELECT COALESCE(SUM(valor), 0)
    INTO v_total
    FROM lancamentos
    WHERE organizacao_id = p_organizacao_id
    
    -- Filtro de DATA
    AND (
        CASE 
            WHEN v_data_inicio IS NOT NULL THEN 
                COALESCE(data_pagamento, data_transacao, data_vencimento) >= v_data_inicio::date
            ELSE TRUE 
        END
    )
    AND (
        CASE 
            WHEN v_data_fim IS NOT NULL THEN 
                COALESCE(data_pagamento, data_transacao, data_vencimento) <= v_data_fim::date
            ELSE TRUE 
        END
    )

    -- Filtro: Ignorar Transferências
    AND (
        CASE 
            WHEN v_ignorar_transferencias IS TRUE THEN transferencia_id IS NULL
            ELSE TRUE 
        END
    )

    -- Filtro: Favorecido
    AND (
        CASE 
            WHEN v_favorecido_id IS NOT NULL THEN favorecido_contato_id = v_favorecido_id
            ELSE TRUE 
        END
    )

    -- Filtro Inteligente de STATUS (A CORREÇÃO PRINCIPAL 🌟)
    AND (
        CASE WHEN jsonb_array_length(v_filtro_status) > 0 THEN
            (
                -- Se o status exato estiver na lista
                status = ANY(SELECT jsonb_array_elements_text(v_filtro_status))
                OR
                -- SE "Pago" foi selecionado, TAMBÉM trazemos "Conciliado"
                (v_filtro_status @> '["Pago"]'::jsonb AND status = 'Conciliado')
            )
        ELSE TRUE END
    )

    -- Outros Filtros de Arrays
    AND (
        CASE WHEN jsonb_array_length(v_filtro_contas) > 0 
        THEN conta_id = ANY(SELECT jsonb_array_elements_text(v_filtro_contas)::bigint)
        ELSE TRUE END
    )
    AND (
        CASE WHEN jsonb_array_length(v_filtro_categorias) > 0 
        THEN categoria_id = ANY(SELECT jsonb_array_elements_text(v_filtro_categorias)::bigint)
        ELSE TRUE END
    )
    AND (
        CASE WHEN jsonb_array_length(v_filtro_tipo) > 0 
        THEN tipo = ANY(SELECT jsonb_array_elements_text(v_filtro_tipo))
        ELSE TRUE END
    )
    AND (
        CASE WHEN jsonb_array_length(v_filtro_empresa) > 0 
        THEN empresa_id = ANY(SELECT jsonb_array_elements_text(v_filtro_empresa)::bigint)
        ELSE TRUE END
    )
    AND (
        CASE WHEN jsonb_array_length(v_filtro_empreendimento) > 0 
        THEN empreendimento_id = ANY(SELECT jsonb_array_elements_text(v_filtro_empreendimento)::bigint)
        ELSE TRUE END
    )
    AND (
        CASE WHEN jsonb_array_length(v_filtro_etapa) > 0 
        THEN etapa_id = ANY(SELECT jsonb_array_elements_text(v_filtro_etapa)::bigint)
        ELSE TRUE END
    );

    RETURN v_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_whatsapp_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_contato_id bigint;
    v_phone_clean text;
    v_conversation_id bigint;
BEGIN
    -- Só processa mensagens que estão entrando (inbound)
    IF NEW.direction = 'inbound' THEN
        
        -- A. TENTA ACHAR O CONTATO (Se já não veio preenchido)
        IF NEW.contato_id IS NULL THEN
            -- Limpa o número para buscar (remove + e espaços)
            v_phone_clean := regexp_replace(NEW.sender_id, '\D', '', 'g');
            
            -- Busca na tabela de telefones (Tenta com e sem o 9 se for BR)
            SELECT contato_id INTO v_contato_id
            FROM public.telefones
            WHERE regexp_replace(telefone, '\D', '', 'g') = v_phone_clean
               OR regexp_replace(telefone, '\D', '', 'g') = RIGHT(v_phone_clean, 11) -- Caso sem 55
            LIMIT 1;
            
            -- Se achou, atualiza a variável e a própria mensagem
            IF v_contato_id IS NOT NULL THEN
                NEW.contato_id := v_contato_id;
            END IF;
        ELSE
            v_contato_id := NEW.contato_id;
        END IF;

        -- B. GERENCIA A CONVERSA (Cria ou Atualiza)
        INSERT INTO public.whatsapp_conversations (
            phone_number, 
            contato_id, 
            organizacao_id, 
            updated_at, 
            last_message_direction,
            unread_count
        )
        VALUES (
            NEW.sender_id, 
            v_contato_id, 
            NEW.organizacao_id, 
            NEW.sent_at, 
            'inbound',
            1
        )
        ON CONFLICT (phone_number) 
        DO UPDATE SET 
            updated_at = EXCLUDED.updated_at,
            last_message_direction = 'inbound',
            contato_id = COALESCE(whatsapp_conversations.contato_id, EXCLUDED.contato_id),
            unread_count = whatsapp_conversations.unread_count + 1
        RETURNING id INTO v_conversation_id;

        -- Vincula a mensagem à conversa criada/atualizada
        NEW.conversation_record_id := v_conversation_id;

    END IF;

    -- Se for mensagem enviada (outbound), também atualiza a conversa para zerar contador ou mudar data
    IF NEW.direction = 'outbound' THEN
         INSERT INTO public.whatsapp_conversations (phone_number, organizacao_id, updated_at, last_message_direction)
         VALUES (NEW.receiver_id, NEW.organizacao_id, NEW.sent_at, 'outbound')
         ON CONFLICT (phone_number)
         DO UPDATE SET 
            updated_at = EXCLUDED.updated_at,
            last_message_direction = 'outbound';
            -- Não altera unread_count aqui (ou zera se quiser ler automaticamente)
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unificar_materiais(old_material_id bigint, new_material_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- ===================================================
  -- 1. TRATAMENTO DA TABELA ESTOQUE (A Parte Matemática)
  -- ===================================================

  -- PASSO A: Atualizar o destino (novo) somando as quantidades da origem (velho)
  -- Apenas quando JÁ EXISTE o destino naquele empreendimento
  UPDATE public.estoque AS dest
  SET 
    -- Soma as quantidades
    quantidade_atual = dest.quantidade_atual + src.quantidade_atual,
    quantidade_em_uso = dest.quantidade_em_uso + src.quantidade_em_uso,
    
    -- Recalcula o Custo Médio Ponderado: ((QtdA * CustoA) + (QtdB * CustoB)) / (QtdTotal)
    custo_medio = CASE 
        WHEN (dest.quantidade_atual + src.quantidade_atual) > 0 THEN
            ((dest.quantidade_atual * dest.custo_medio) + (src.quantidade_atual * src.custo_medio)) / (dest.quantidade_atual + src.quantidade_atual)
        ELSE dest.custo_medio 
    END,
    
    ultima_atualizacao = NOW()
  FROM public.estoque AS src
  WHERE dest.material_id = new_material_id
    AND src.material_id = old_material_id
    AND dest.empreendimento_id = src.empreendimento_id;

  -- PASSO B: Apagar os registros antigos que acabaram de ser somados no passo acima
  DELETE FROM public.estoque
  WHERE material_id = old_material_id
    AND empreendimento_id IN (
        SELECT empreendimento_id 
        FROM public.estoque 
        WHERE material_id = new_material_id
    );

  -- PASSO C: O que sobrou (casos onde o material novo NÃO existia no empreendimento),
  -- nós apenas renomeamos o ID. Agora não vai dar conflito de Unique Key.
  UPDATE public.estoque
  SET material_id = new_material_id
  WHERE material_id = old_material_id;


  -- ===================================================
  -- 2. TRATAMENTO DA TABELA ESTOQUE_OBRA (Mesma lógica)
  -- ===================================================
  
  -- PASSO A: Soma onde já existe
  UPDATE public.estoque_obra AS dest
  SET 
    quantidade = dest.quantidade + src.quantidade,
    ultima_atualizacao = NOW()
  FROM public.estoque_obra AS src
  WHERE dest.material_id = new_material_id
    AND src.material_id = old_material_id
    AND dest.empreendimento_id = src.empreendimento_id;

  -- PASSO B: Apaga os somados
  DELETE FROM public.estoque_obra
  WHERE material_id = old_material_id
    AND empreendimento_id IN (
        SELECT empreendimento_id 
        FROM public.estoque_obra 
        WHERE material_id = new_material_id
    );

  -- PASSO C: Renomeia o restante
  UPDATE public.estoque_obra
  SET material_id = new_material_id
  WHERE material_id = old_material_id;


  -- ===================================================
  -- 3. ATUALIZAÇÃO DE REGISTROS SIMPLES (Links)
  -- ===================================================

  -- Orçamentos
  UPDATE public.orcamento_itens
  SET material_id = new_material_id
  WHERE material_id = old_material_id;

  -- Pedidos de Compra
  UPDATE public.pedidos_compra_itens
  SET material_id = new_material_id
  WHERE material_id = old_material_id;

  -- (Opcional) Movimentações de Estoque (Histórico)
  -- Se houver link direto com material, atualizamos para manter histórico
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'movimentacoes_estoque') THEN
      -- Nota: Movimentações geralmente não têm restrição Unique, então update direto funciona
      -- Mas aqui o certo seria atualizar o 'estoque_id', porém como estamos mexendo no material_id...
      -- Vamos assumir que se houver coluna material_id lá, atualizamos.
      NULL; -- (Deixei placeholder pois sua tabela de movimentação usa estoque_id, não material_id direto, então está seguro)
  END IF;

  -- ===================================================
  -- 4. FAXINA FINAL
  -- ===================================================
  
  -- Apagar o material antigo da tabela de cadastro
  DELETE FROM public.materiais
  WHERE id = old_material_id;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard(p_organizacao_id bigint, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_kpis jsonb;
    v_grafico_fluxo jsonb;
    v_grafico_pizza jsonb;
    v_retorno jsonb;
BEGIN
    -- 1. CALCULAR KPIs (Totais do Período - Isso continua igual)
    SELECT jsonb_build_object(
        'receita', COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE 0 END), 0),
        'despesa', COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor ELSE 0 END), 0),
        'saldo',   COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE -valor END), 0)
    ) INTO v_kpis
    FROM lancamentos
    WHERE organizacao_id = p_organizacao_id
      AND COALESCE(data_pagamento, data_transacao, data_vencimento) >= p_data_inicio 
      AND COALESCE(data_pagamento, data_transacao, data_vencimento) <= p_data_fim
      AND status IN ('Pago', 'Conciliado', 'Pendente', 'Agendado');

    -- 2. DADOS PARA O GRÁFICO DE FLUXO (AGORA POR DIA! 📅)
    SELECT jsonb_agg(t) INTO v_grafico_fluxo
    FROM (
        SELECT 
            -- Nome exibe o Dia/Mês (Ex: 05/06)
            TO_CHAR(COALESCE(data_pagamento, data_transacao, data_vencimento), 'DD/MM') as name,
            -- Ordenação usa a data exata
            COALESCE(data_pagamento, data_transacao, data_vencimento)::date as data_ordem,
            COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE 0 END), 0) as "Receita",
            COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor ELSE 0 END), 0) as "Despesa"
        FROM lancamentos
        WHERE organizacao_id = p_organizacao_id
          AND COALESCE(data_pagamento, data_transacao, data_vencimento) >= p_data_inicio 
          AND COALESCE(data_pagamento, data_transacao, data_vencimento) <= p_data_fim
          AND status IN ('Pago', 'Conciliado', 'Pendente', 'Agendado')
        -- MUDANÇA AQUI: Agrupa pela data exata, não pelo mês truncado
        GROUP BY 
            TO_CHAR(COALESCE(data_pagamento, data_transacao, data_vencimento), 'DD/MM'),
            COALESCE(data_pagamento, data_transacao, data_vencimento)::date
        ORDER BY 
            COALESCE(data_pagamento, data_transacao, data_vencimento)::date ASC
    ) t;

    -- 3. DADOS PARA O GRÁFICO DE PIZZA (Top Despesas - Continua igual)
    SELECT jsonb_agg(t) INTO v_grafico_pizza
    FROM (
        SELECT 
            c.nome as name,
            SUM(l.valor) as value
        FROM lancamentos l
        JOIN categorias_financeiras c ON l.categoria_id = c.id
        WHERE l.organizacao_id = p_organizacao_id
          AND COALESCE(l.data_pagamento, l.data_transacao, l.data_vencimento) >= p_data_inicio 
          AND COALESCE(l.data_pagamento, l.data_transacao, l.data_vencimento) <= p_data_fim
          AND l.status IN ('Pago', 'Conciliado', 'Pendente', 'Agendado')
          AND l.tipo = 'Despesa'
        GROUP BY c.nome
        ORDER BY value DESC
        LIMIT 5
    ) t;

    -- 4. MONTAR O PACOTE FINAL
    v_retorno := jsonb_build_object(
        'kpis', COALESCE(v_kpis, '{"receita": 0, "despesa": 0, "saldo": 0}'::jsonb),
        'graficoFluxo', COALESCE(v_grafico_fluxo, '[]'::jsonb),
        'graficoPizza', COALESCE(v_grafico_pizza, '[]'::jsonb)
    );

    RETURN v_retorno;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_ranking_atrasos(p_organizacao_id bigint, p_mes_ref text)
 RETURNS TABLE(nome text, cargo text, qtd bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH batidas_vencedoras AS (
    SELECT DISTINCT ON (p.funcionario_id, p.data_hora::date)
      p.funcionario_id,
      p.data_hora::date as data_dia,
      p.data_hora::time as hora_chegada,
      EXTRACT(DOW FROM p.data_hora)::integer as dia_semana
    FROM pontos p
    WHERE p.organizacao_id = p_organizacao_id
      AND to_char(p.data_hora, 'YYYY-MM') = p_mes_ref
      AND p.tipo_registro = 'Entrada'
    -- A MUDANÇA MÁGICA ESTÁ AQUI EMBAIXO:
    -- 1º Prioridade: Editado Manualmente (TRUE vem antes de FALSE)
    -- 2º Prioridade: Data de Criação (Mais recente ganha)
    ORDER BY p.funcionario_id, p.data_hora::date, p.editado_manualmente DESC, p.created_at DESC
  )
  SELECT 
    f.full_name as nome,
    COALESCE(c.nome, 'Cargo não definido') as cargo,
    COUNT(*) as qtd
  FROM batidas_vencedoras bv
  JOIN funcionarios f ON f.id = bv.funcionario_id
  LEFT JOIN cargos c ON f.cargo_id = c.id
  JOIN jornadas j ON f.jornada_id = j.id
  JOIN jornada_detalhes jd ON j.id = jd.jornada_id AND jd.dia_semana = bv.dia_semana
  WHERE 
    jd.horario_entrada IS NOT NULL
    -- Compara: Chegada > (Entrada + Tolerância)
    AND bv.hora_chegada > (jd.horario_entrada + (COALESCE(j.tolerancia_minutos, 0) || ' minutes')::interval)
  GROUP BY f.full_name, c.nome
  ORDER BY qtd DESC
  LIMIT 5;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_bim_field_values(p_organizacao_id bigint, p_campo text, p_search text DEFAULT ''::text)
 RETURNS TABLE(valor text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_query text;
  -- Lista de colunas que existem fisicamente na tabela
  v_standard_cols text[] := ARRAY['familia', 'tipo', 'categoria', 'nivel', 'status_execucao', 'sistema'];
BEGIN
  -- 1. Verifica se o campo pedido é uma coluna padrão da tabela
  IF p_campo = ANY(v_standard_cols) THEN
    -- Monta query para coluna padrão usando %I para evitar SQL Injection no nome da coluna
    v_query := format(
      'SELECT DISTINCT %I::text 
       FROM public.elementos_bim 
       WHERE organizacao_id = $1 
       AND %I::text ILIKE $2 
       AND %I IS NOT NULL 
       ORDER BY 1 
       LIMIT 50', 
      p_campo, p_campo, p_campo
    );
  ELSE
    -- 2. Se não for coluna padrão, assume que é uma chave dentro do JSONB 'propriedades'
    -- Usa o operador ->> para extrair o valor como texto
    v_query := format(
      'SELECT DISTINCT (propriedades->>%L)::text 
       FROM public.elementos_bim 
       WHERE organizacao_id = $1 
       AND (propriedades->>%L)::text ILIKE $2 
       AND (propriedades->>%L) IS NOT NULL 
       ORDER BY 1 
       LIMIT 50', 
      p_campo, p_campo, p_campo
    );
  END IF;

  -- 3. Executa a query dinâmica passando os parâmetros
  RETURN QUERY EXECUTE v_query USING p_organizacao_id, '%' || p_search || '%';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dados_grafico_kpi(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS TABLE(data_ref text, receita numeric, despesa numeric)
 LANGUAGE plpgsql
AS $function$
declare
  v_where text;
  v_use_competencia boolean;
begin
  -- Pega o filtro montado pelo Cérebro Central (já blindado)
  v_where := financeiro_montar_where(p_organizacao_id, p_filtros);
  v_use_competencia := coalesce((p_filtros->>'useCompetencia')::boolean, false);

  return query execute '
    select 
      to_char(
        CASE 
          WHEN ' || v_use_competencia || ' THEN coalesce(l.mes_competencia, l.data_transacao)
          ELSE coalesce(l.data_pagamento, l.data_vencimento) 
        END, 
        ''YYYY-MM-DD''
      ) as data_ref,
      coalesce(sum(case when l.tipo = ''Receita'' then l.valor else 0 end), 0) as receita,
      coalesce(sum(case when l.tipo = ''Despesa'' then l.valor else 0 end), 0) as despesa
    from lancamentos l
    ' || v_where || '
    group by 1
    order by 1
  ';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_financeiro_grafico_pizza(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS TABLE(name text, value numeric)
 LANGUAGE plpgsql
AS $function$
declare
  v_where text;
begin
  v_where := financeiro_montar_where(p_organizacao_id, p_filtros);
  
  -- Adiciona filtro extra para pegar só Despesas no gráfico de pizza (opcional, mas comum)
  -- Se quiser ver Receitas também na pizza dependendo do filtro, remova a linha abaixo.
  -- Mas geralmente pizza mistura tudo fica confuso, então focamos em onde o dinheiro sai.
  v_where := v_where || ' and l.tipo = ''Despesa'''; 
  
  return query execute '
    select 
      coalesce(c.nome, ''Sem Categoria'') as name,
      sum(l.valor) as value
    from lancamentos l
    left join categorias_financeiras c on l.categoria_id = c.id
    ' || v_where || '
    group by c.nome
    having sum(l.valor) > 0
    order by value desc
    limit 6
  ';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.jsonb_to_bigint_array(p_json jsonb)
 RETURNS bigint[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select array_agg(elem::text::bigint)
  from jsonb_array_elements(p_json) as elem
  where elem::text <> '"IS_NULL"' and elem::text <> 'IS_NULL';
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_tabelas_do_banco()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- 1. SINCRONIZA TABELAS (O que já fizemos antes)
    INSERT INTO public.tabelas_sistema (nome_tabela, nome_exibicao, modulo)
    SELECT 
        table_name, 
        INITCAP(REPLACE(table_name, '_', ' ')), 
        'Sistema'
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('tabelas_sistema', 'campos_sistema', 'schema_migrations', '_prisma_migrations')
    ON CONFLICT (nome_tabela) DO NOTHING;

    -- 2. SINCRONIZA CAMPOS (A novidade!)
    INSERT INTO public.campos_sistema (tabela_id, nome_coluna, nome_exibicao, tipo_dado)
    SELECT 
        ts.id,                     -- ID da tabela pai (buscado via JOIN)
        c.column_name,             -- Nome técnico
        INITCAP(REPLACE(c.column_name, '_', ' ')), -- Nome bonito automático
        c.data_type                -- Tipo (text, bool, etc)
    FROM information_schema.columns c
    JOIN public.tabelas_sistema ts ON ts.nome_tabela = c.table_name
    WHERE c.table_schema = 'public'
    ON CONFLICT (tabela_id, nome_coluna) DO NOTHING; -- Se já existe, ignora
    
    -- 3. AJUSTES FINOS AUTOMÁTICOS (Opcional: Esconder colunas técnicas)
    -- Por exemplo: Ninguém precisa ver 'id' ou 'organizacao_id' em filtros visuais
    UPDATE public.campos_sistema 
    SET visivel_listagem = false, visivel_filtro = false 
    WHERE nome_coluna IN ('id', 'organizacao_id', 'senha', 'password', 'deleted_at');

END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_previsao_folha(p_organizacao_id bigint, p_mes_ref text)
 RETURNS TABLE(custo_total numeric, dias_uteis integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_inicio_mes date;
  v_fim_mes date;
  
  -- Variáveis de Loop e Cálculo
  r_func record;
  v_inicio_efetivo date;
  v_fim_efetivo date;
  v_dias_corridos_trab int;
  v_dias_uteis_trab numeric; -- Usando numeric para aceitar 0.5 (meio período)
  v_custo_individual numeric;
  v_custo_total_acumulado numeric := 0;
  
  -- Auxiliares para Dias Úteis do Mês (Referência)
  v_dia_loop date;
  v_is_feriado boolean;
  v_tipo_feriado text;
  v_dias_uteis_mes_cheio int := 0;
BEGIN
  -- 1. Definir o intervalo do mês
  v_inicio_mes := to_date(p_mes_ref, 'YYYY-MM-DD');
  v_fim_mes := (v_inicio_mes + interval '1 month' - interval '1 day')::date;

  -- 2. Calcular Dias Úteis do Mês Cheio (para exibir no widget)
  v_dia_loop := v_inicio_mes;
  WHILE v_dia_loop <= v_fim_mes LOOP
    IF EXTRACT(DOW FROM v_dia_loop) NOT IN (0, 6) THEN -- 0=Dom, 6=Sáb
      SELECT tipo INTO v_tipo_feriado FROM feriados WHERE organizacao_id = p_organizacao_id AND data_feriado = v_dia_loop;
      
      IF v_tipo_feriado IS NULL THEN
        v_dias_uteis_mes_cheio := v_dias_uteis_mes_cheio + 1;
      ELSIF v_tipo_feriado = 'Meio Período' THEN
         -- Para referência visual, meio período conta como dia de trabalho? Vamos contar como 1 dia útil na agenda.
         v_dias_uteis_mes_cheio := v_dias_uteis_mes_cheio + 1; 
      END IF;
    END IF;
    v_dia_loop := v_dia_loop + 1;
  END LOOP;

  -- 3. Loop por Funcionário (Cálculo Financeiro Individual)
  FOR r_func IN
    SELECT 
      f.id, 
      f.admission_date, 
      f.demission_date,
      h.salario_base, 
      h.valor_diaria
    FROM funcionarios f
    LEFT JOIN LATERAL (
      SELECT salario_base, valor_diaria 
      FROM historico_salarial 
      WHERE funcionario_id = f.id 
      ORDER BY data_inicio_vigencia DESC 
      LIMIT 1
    ) h ON true
    WHERE f.organizacao_id = p_organizacao_id
      AND f.status = 'Ativo'
      AND f.admission_date <= v_fim_mes::text
      AND (f.demission_date IS NULL OR f.demission_date >= v_inicio_mes)
  LOOP
    
    -- A. Define início e fim efetivos deste funcionário
    v_inicio_efetivo := GREATEST(v_inicio_mes, r_func.admission_date::date);
    
    IF r_func.demission_date IS NOT NULL THEN
       v_fim_efetivo := LEAST(v_fim_mes, r_func.demission_date::date);
    ELSE
       v_fim_efetivo := v_fim_mes;
    END IF;

    -- B. Cálculo Mensalista (Regra 30 dias - Proporcional)
    v_dias_corridos_trab := (v_fim_efetivo - v_inicio_efetivo) + 1;
    IF v_dias_corridos_trab > 30 THEN v_dias_corridos_trab := 30; END IF; -- Trava teto 30

    -- C. Cálculo Diarista (Dias Úteis Exatos)
    v_dias_uteis_trab := 0;
    v_dia_loop := v_inicio_efetivo;
    
    WHILE v_dia_loop <= v_fim_efetivo LOOP
      IF EXTRACT(DOW FROM v_dia_loop) NOT IN (0, 6) THEN
        SELECT tipo INTO v_tipo_feriado FROM feriados WHERE organizacao_id = p_organizacao_id AND data_feriado = v_dia_loop;
        
        IF v_tipo_feriado IS NULL THEN
          v_dias_uteis_trab := v_dias_uteis_trab + 1;
        ELSIF v_tipo_feriado = 'Meio Período' THEN
           v_dias_uteis_trab := v_dias_uteis_trab + 0.5; -- Paga meia diária
        END IF;
      END IF;
      v_dia_loop := v_dia_loop + 1;
    END LOOP;

    -- D. Soma Valor
    v_custo_individual := 0;

    IF r_func.salario_base > 0 THEN
      -- Mensalista
      IF v_dias_corridos_trab >= 30 THEN
         v_custo_individual := r_func.salario_base;
      ELSE
         v_custo_individual := (r_func.salario_base / 30.0) * v_dias_corridos_trab;
      END IF;
    ELSE
      -- Diarista
      v_custo_individual := (COALESCE(r_func.valor_diaria, 0) * v_dias_uteis_trab);
    END IF;

    v_custo_total_acumulado := v_custo_total_acumulado + v_custo_individual;
    
  END LOOP;

  -- 4. Retorno Final
  custo_total := ROUND(v_custo_total_acumulado, 2);
  dias_uteis := v_dias_uteis_mes_cheio;
  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.jsonb_to_text_array(p_json jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select array_agg(elem::text)
  from jsonb_array_elements_text(p_json) as elem;
$function$
;

CREATE OR REPLACE FUNCTION public.get_radar_stats(dias_atras integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    config_venda RECORD;
    permuta_total NUMERIC;
    valor_base NUMERIC;
    valor_entrada NUMERIC;
    valor_obra NUMERIC;
    valor_adicionais NUMERIC;
    valor_remanescente NUMERIC;
    valor_parcela_entrada NUMERIC;
    valor_parcela_obra NUMERIC;
    primeira_data_entrada DATE;
    primeira_data_obra DATE;
    i INTEGER;
BEGIN
    SELECT * INTO config_venda
    FROM public.configuracoes_venda
    WHERE empreendimento_id = NEW.empreendimento_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(valor), 0) INTO permuta_total
    FROM public.contrato_permutas
    WHERE contrato_id = NEW.id;

    valor_base := NEW.valor_final_venda;

    valor_entrada := valor_base * (config_venda.entrada_percentual / 100.0);
    valor_obra := valor_base * (config_venda.parcelas_obra_percentual / 100.0);
    
    primeira_data_entrada := COALESCE(config_venda.data_primeira_parcela_entrada, NEW.data_venda + INTERVAL '30 days');
    IF config_venda.num_parcelas_entrada > 0 THEN
        valor_parcela_entrada := valor_entrada / config_venda.num_parcelas_entrada;
        FOR i IN 1..config_venda.num_parcelas_entrada LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
            VALUES (NEW.id, 'Entrada ' || i || '/' || config_venda.num_parcelas_entrada, 'Entrada', primeira_data_entrada + (INTERVAL '1 month' * (i-1)), valor_parcela_entrada, NEW.organizacao_id);
        END LOOP;
    END IF;

    primeira_data_obra := COALESCE(config_venda.data_primeira_parcela_obra, primeira_data_entrada + (INTERVAL '1 month' * config_venda.num_parcelas_entrada));
    IF config_venda.num_parcelas_obra > 0 THEN
        valor_parcela_obra := valor_obra / config_venda.num_parcelas_obra;
        FOR i IN 1..config_venda.num_parcelas_obra LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
            VALUES (NEW.id, 'Parcela Obra ' || i || '/' || config_venda.num_parcelas_obra, 'Obra', primeira_data_obra + (INTERVAL '1 month' * (i-1)), valor_parcela_obra, NEW.organizacao_id);
        END LOOP;
    END IF;

    SELECT COALESCE(SUM(valor), 0) INTO valor_adicionais
    FROM public.parcelas_adicionais
    WHERE configuracao_venda_id = config_venda.id;

    INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
    SELECT NEW.id, 'Parcela Adicional', 'Adicional', pa.data_pagamento, pa.valor, NEW.organizacao_id
    FROM public.parcelas_adicionais pa
    WHERE pa.configuracao_venda_id = config_venda.id;

    valor_remanescente := valor_base - valor_entrada - valor_obra - valor_adicionais - permuta_total;
    IF valor_remanescente > 0 THEN
        INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
        VALUES (NEW.id, 'Saldo Remanescente (Financiamento)', 'Financiamento', primeira_data_obra + (INTERVAL '1 month' * config_venda.num_parcelas_obra), valor_remanescente, NEW.organizacao_id);
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_recursive_categories(p_ids_json jsonb)
 RETURNS TABLE(id bigint)
 LANGUAGE plpgsql
AS $function$
begin
  return query
  with recursive cat_tree as (
    -- Pega os IDs selecionados (base)
    select c.id from categorias_financeiras c 
    where c.id in (
        select (elem::text)::bigint 
        from jsonb_array_elements(p_ids_json) as elem 
        where (elem::text) <> '"IS_NULL"' and (elem::text) <> 'IS_NULL'
    )
    
    union
    
    -- Pega os filhos (recursão)
    select c.id from categorias_financeiras c
    inner join cat_tree t on c.parent_id = t.id
  )
  select * from cat_tree;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_rh_financial_evolution(p_organizacao_id bigint, p_ano integer)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_mes int;
  v_data_ref text;
  v_resultado_calc record; -- Variável para guardar o retorno da calculadora
  v_historico jsonB := '[]'::jsonB;
  v_total_anual numeric := 0;
  v_media_anual numeric := 0;
  v_meses_com_dados int := 0;
BEGIN
  -- Loop de Janeiro (1) a Dezembro (12)
  FOR v_mes IN 1..12 LOOP
    -- Cria a data de referência: '2025-01-01', '2025-02-01'...
    v_data_ref := to_char(make_date(p_ano, v_mes, 1), 'YYYY-MM-DD');

    -- AQUI ESTÁ O SEGREDO:
    -- Chamamos a MESMA função que alimenta o KPI (calcular_previsao_folha)
    -- Assim garantimos que a lógica é idêntica (dias úteis, feriados, pro-rata)
    SELECT custo_total 
    INTO v_resultado_calc
    FROM calcular_previsao_folha(p_organizacao_id, v_data_ref);

    -- Monta o objeto para o gráfico
    v_historico := v_historico || jsonb_build_object(
      'mes', v_mes,
      'total', COALESCE(v_resultado_calc.custo_total, 0)
    );

    -- Acumula para média anual (se tiver valor > 0)
    IF COALESCE(v_resultado_calc.custo_total, 0) > 0 THEN
      v_total_anual := v_total_anual + v_resultado_calc.custo_total;
      v_meses_com_dados := v_meses_com_dados + 1;
    END IF;
    
  END LOOP;

  -- Calcula média simples dos meses que tiveram movimento
  IF v_meses_com_dados > 0 THEN
    v_media_anual := ROUND(v_total_anual / v_meses_com_dados, 2);
  END IF;

  RETURN json_build_object(
    'historico', v_historico,
    'media_anual', v_media_anual,
    'total_anual', v_total_anual
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard(p_organizacao_id bigint, p_data_inicio date, p_data_fim date, p_conta_ids bigint[] DEFAULT NULL::bigint[], p_categoria_ids bigint[] DEFAULT NULL::bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_kpis jsonb;
    v_grafico_fluxo jsonb;
    v_grafico_pizza jsonb;
    v_retorno jsonb;
BEGIN
    -- 1. CALCULAR KPIs
    SELECT jsonb_build_object(
        'receita', COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE 0 END), 0),
        'despesa', COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor ELSE 0 END), 0),
        'saldo',   COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE -valor END), 0)
    ) INTO v_kpis
    FROM lancamentos
    WHERE organizacao_id = p_organizacao_id
      AND COALESCE(data_pagamento, data_transacao, data_vencimento) >= p_data_inicio 
      AND COALESCE(data_pagamento, data_transacao, data_vencimento) <= p_data_fim
      AND status IN ('Pago', 'Conciliado', 'Pendente', 'Agendado')
      -- Filtros Dinâmicos
      AND (p_conta_ids IS NULL OR conta_id = ANY(p_conta_ids))
      AND (p_categoria_ids IS NULL OR categoria_id = ANY(p_categoria_ids));

    -- 2. DADOS PARA O GRÁFICO DE FLUXO (Por Dia)
    SELECT jsonb_agg(t) INTO v_grafico_fluxo
    FROM (
        SELECT 
            TO_CHAR(COALESCE(data_pagamento, data_transacao, data_vencimento), 'DD/MM') as name,
            COALESCE(data_pagamento, data_transacao, data_vencimento)::date as data_ordem,
            COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE 0 END), 0) as "Receita",
            COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor ELSE 0 END), 0) as "Despesa"
        FROM lancamentos
        WHERE organizacao_id = p_organizacao_id
          AND COALESCE(data_pagamento, data_transacao, data_vencimento) >= p_data_inicio 
          AND COALESCE(data_pagamento, data_transacao, data_vencimento) <= p_data_fim
          AND status IN ('Pago', 'Conciliado', 'Pendente', 'Agendado')
          -- Filtros Dinâmicos
          AND (p_conta_ids IS NULL OR conta_id = ANY(p_conta_ids))
          AND (p_categoria_ids IS NULL OR categoria_id = ANY(p_categoria_ids))
        GROUP BY 
            TO_CHAR(COALESCE(data_pagamento, data_transacao, data_vencimento), 'DD/MM'),
            COALESCE(data_pagamento, data_transacao, data_vencimento)::date
        ORDER BY 
            COALESCE(data_pagamento, data_transacao, data_vencimento)::date ASC
    ) t;

    -- 3. DADOS PARA O GRÁFICO DE PIZZA
    SELECT jsonb_agg(t) INTO v_grafico_pizza
    FROM (
        SELECT 
            c.nome as name,
            SUM(l.valor) as value
        FROM lancamentos l
        JOIN categorias_financeiras c ON l.categoria_id = c.id
        WHERE l.organizacao_id = p_organizacao_id
          AND COALESCE(l.data_pagamento, l.data_transacao, l.data_vencimento) >= p_data_inicio 
          AND COALESCE(l.data_pagamento, l.data_transacao, l.data_vencimento) <= p_data_fim
          AND l.status IN ('Pago', 'Conciliado', 'Pendente', 'Agendado')
          -- Filtros Dinâmicos
          AND (p_conta_ids IS NULL OR conta_id = ANY(p_conta_ids))
          AND (p_categoria_ids IS NULL OR categoria_id = ANY(p_categoria_ids))
          AND l.tipo = 'Despesa'
        GROUP BY c.nome
        ORDER BY value DESC
        LIMIT 5
    ) t;

    -- 4. RETORNO
    v_retorno := jsonb_build_object(
        'kpis', COALESCE(v_kpis, '{"receita": 0, "despesa": 0, "saldo": 0}'::jsonb),
        'graficoFluxo', COALESCE(v_grafico_fluxo, '[]'::jsonb),
        'graficoPizza', COALESCE(v_grafico_pizza, '[]'::jsonb)
    );

    RETURN v_retorno;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.corrigir_numeros_pela_agenda()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    r_conv RECORD;
    v_telefone_correto text;
    v_atualizados int := 0;
BEGIN
    -- Percorre todas as conversas que já têm um dono (contato_id)
    FOR r_conv IN 
        SELECT id, phone_number, contato_id, organizacao_id
        FROM public.whatsapp_conversations
        WHERE contato_id IS NOT NULL
    LOOP
        -- Tenta achar o telefone oficial na tabela 'telefones'
        -- Critério: Mesmo contato_id E últimos 8 dígitos iguais
        SELECT telefone INTO v_telefone_correto
        FROM public.telefones
        WHERE contato_id = r_conv.contato_id
          AND RIGHT(REGEXP_REPLACE(telefone, '\D', '', 'g'), 8) = RIGHT(REGEXP_REPLACE(r_conv.phone_number, '\D', '', 'g'), 8)
        LIMIT 1; -- Pega o primeiro que der match (caso tenha fixo e celular com final igual, raro mas possível)

        -- Se achou um número oficial e ele é diferente do que está na conversa...
        IF v_telefone_correto IS NOT NULL AND v_telefone_correto <> r_conv.phone_number THEN
            
            -- ATUALIZA O NÚMERO NA CONVERSA
            -- Nota: Usamos um bloco BEGIN/EXCEPTION para o caso de já existir uma conversa com o número correto
            BEGIN
                UPDATE public.whatsapp_conversations
                SET phone_number = v_telefone_correto
                WHERE id = r_conv.id;
                
                v_atualizados := v_atualizados + 1;
            EXCEPTION WHEN unique_violation THEN
                -- Se der erro de duplicidade, significa que já existe a conversa certa.
                -- Nesse caso, ignoramos o update aqui, pois a função de limpeza (faxina) vai resolver depois.
                RAISE NOTICE 'Conversa % já existe com o número correto. Pulando atualização.', r_conv.id;
            END;
            
        END IF;
    END LOOP;

    RETURN 'Correção finalizada! ' || v_atualizados || ' conversas tiveram seus números corrigidos pela agenda.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_relatorio_financeiro(p_organizacao_id bigint, p_filtros jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_where text;
  v_kpis jsonb;
  v_fluxo jsonb;
  v_pizza jsonb;
  v_use_competencia boolean;
  v_coluna_data text;
begin
  -- 1. Ler preferência
  v_use_competencia := coalesce((p_filtros->>'useCompetencia')::boolean, false);

  -- 2. Definir qual coluna de data usar para o GRÁFICO (Agrupamento)
  if v_use_competencia then
      v_coluna_data := 'l.data_transacao';
  else
      v_coluna_data := 'CASE WHEN l.data_pagamento IS NOT NULL THEN l.data_pagamento WHEN l.data_vencimento IS NOT NULL THEN l.data_vencimento ELSE l.data_transacao END';
  end if;

  -- 3. CHAMA O CÉREBRO COMPARTILHADO (Garante que o filtro WHERE é idêntico à lista)
  v_where := financeiro_montar_where(p_organizacao_id, p_filtros);

  -- 4. Calcular KPIs (Totais Gerais - A mesma matemática da lista)
  execute '
    select jsonb_build_object(
      ''receita'', coalesce(sum(case when tipo = ''Receita'' then valor else 0 end), 0),
      ''despesa'', coalesce(sum(case when tipo = ''Despesa'' then valor else 0 end), 0),
      ''saldo'', coalesce(sum(case when tipo = ''Receita'' then valor else -valor end), 0)
    )
    from lancamentos l
    ' || v_where 
  into v_kpis;

  -- 5. Calcular Gráfico de Fluxo (Agora DINÂMICO conforme a visão)
  execute '
    select json_agg(t) from (
      select 
        to_char(' || v_coluna_data || ', ''YYYY-MM-DD'') as data_ordem,
        sum(case when tipo = ''Receita'' then valor else 0 end) as "Receita",
        sum(case when tipo = ''Despesa'' then valor else 0 end) as "Despesa"
      from lancamentos l
      ' || v_where || '
      group by 1
      order by 1
    ) t'
  into v_fluxo;

  -- 6. Calcular Gráfico de Pizza (Top 5 Despesas)
  execute '
    select json_agg(t) from (
      select 
        coalesce(c.nome, ''Sem Categoria'') as name,
        sum(l.valor) as value
      from lancamentos l
      left join categorias_financeiras c on c.id = l.categoria_id
      ' || v_where || '
      and l.tipo = ''Despesa''
      group by 1
      order by 2 desc
      limit 5
    ) t'
  into v_pizza;

  return jsonb_build_object(
    'kpis', coalesce(v_kpis, '{}'::jsonb),
    'graficoFluxo', coalesce(v_fluxo, '[]'::jsonb),
    'graficoPizza', coalesce(v_pizza, '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_status_historico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Só salva se o ID da fase mudou
  IF (OLD.fase_id IS DISTINCT FROM NEW.fase_id) THEN
    INSERT INTO public.pedidos_compra_historico_fases (
      pedido_compra_id,
      fase_anterior_id,
      fase_nova_id,
      usuario_id,
      organizacao_id,
      data_movimentacao
    )
    VALUES (
      NEW.id,
      OLD.fase_id,
      NEW.fase_id,
      auth.uid(),      -- Tenta pegar o ID do usuário logado
      NEW.organizacao_id,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_bim_element_status(p_external_id text, p_projeto_bim_id bigint, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total int;
    v_concluidas int;
    v_andamento int;
    v_atrasadas int;
    v_novo_status text;
BEGIN
    -- Utilizando Regex (~ e !~) para evitar que "Não Iniciado" seja lido como "Iniciado"
    SELECT 
        count(*),
        count(*) FILTER (WHERE lower(a.status) ~ 'conclu|execut'),
        count(*) FILTER (WHERE lower(a.status) ~ 'anda|inici' AND lower(a.status) !~ 'n[aã]o\s*inici'),
        count(*) FILTER (WHERE lower(a.status) ~ 'atras|bloq')
    INTO 
        v_total, v_concluidas, v_andamento, v_atrasadas
    FROM public.atividades_elementos ae
    JOIN public.activities a ON a.id = ae.atividade_id
    WHERE ae.external_id = p_external_id 
      AND ae.projeto_bim_id = p_projeto_bim_id
      AND ae.organizacao_id = p_organizacao_id;

    IF v_total = 0 THEN
        v_novo_status := 'Planejado';
    ELSIF v_concluidas = v_total THEN
        v_novo_status := 'Concluído';
    ELSIF v_atrasadas > 0 THEN
        v_novo_status := 'Atrasado';
    ELSIF v_andamento > 0 OR v_concluidas > 0 THEN
        v_novo_status := 'Em Andamento';
    ELSE
        v_novo_status := 'Planejado';
    END IF;

    UPDATE public.elementos_bim
    SET status_execucao = v_novo_status
    WHERE external_id = p_external_id
      AND projeto_bim_id = p_projeto_bim_id
      AND organizacao_id = p_organizacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.excluir_material_forca_bruta(p_material_id bigint, p_senha text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_senha_correta text := 'admin123'; -- DEFINA SUA SENHA DE SEGURANÇA AQUI
BEGIN
    -- 1. Verificar a Senha
    IF p_senha <> v_senha_correta THEN
        RAISE EXCEPTION 'Senha administrativa incorreta. Acesso negado.';
    END IF;

    -- 2. Varrer e deletar das tabelas filhas (Ordem importa!)
    
    -- Orçamentos
    DELETE FROM public.orcamento_itens WHERE material_id = p_material_id;
    
    -- Pedidos de Compra
    DELETE FROM public.pedidos_compra_itens WHERE material_id = p_material_id;
    
    -- Estoque Central
    DELETE FROM public.estoque WHERE material_id = p_material_id;
    
    -- Estoque de Obras
    DELETE FROM public.estoque_obra WHERE material_id = p_material_id;

    -- Movimentações de Estoque (Se houver link direto)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'movimentacoes_estoque') THEN
       -- Assumindo que pode haver um link direto ou limpar referências órfãs
       -- Dependendo da estrutura exata, pode precisar deletar pelo estoque_id antes.
       -- Mas como o foco é o material, se a movimentação depender do estoque e o estoque sumiu, o CASCADE do banco cuidaria.
       -- Se não, forçamos aqui se houver coluna material_id:
       -- DELETE FROM public.movimentacoes_estoque WHERE material_id = p_material_id;
       NULL; 
    END IF;

    -- 3. Finalmente, deletar o Material
    DELETE FROM public.materiais WHERE id = p_material_id;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_lancamentos_avancado(p_organizacao_id bigint, p_filtros jsonb, p_page integer, p_items_per_page integer, p_sort_field text, p_sort_direction text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_where text;
  v_offset integer;
  v_total_count bigint;
  v_data jsonb;
  v_stats jsonb; -- 1. Criamos a variável para guardar os totais
begin
  v_offset := (p_page - 1) * p_items_per_page;

  -- Chama o cérebro central (Isso garante que o filtro é IDÊNTICO para lista e stats)
  v_where := financeiro_montar_where(p_organizacao_id, p_filtros);

  -- 2. Calcula os Totais (KPIs) usando o MESMO filtro
  -- Reutilizamos a função que já existe para garantir consistência matemática
  v_stats := get_financeiro_consolidado(p_organizacao_id, p_filtros);

  -- 3. Conta Total de itens da lista
  execute 'select count(*) from lancamentos l' || v_where into v_total_count;

  -- 4. Busca os Dados da Lista (Paginação)
  execute '
    select json_agg(t) from (
      select 
        l.*,
        (select jsonb_build_object(''id'', c.id, ''nome'', c.nome, ''tipo'', c.tipo, ''empresa'', (select jsonb_build_object(''nome_fantasia'', ce.nome_fantasia, ''razao_social'', ce.razao_social) from cadastro_empresa ce where ce.id = c.empresa_id)) from contas_financeiras c where c.id = l.conta_id) as conta,
        (select jsonb_build_object(''id'', cat.id, ''nome'', cat.nome) from categorias_financeiras cat where cat.id = l.categoria_id) as categoria,
        (select jsonb_build_object(''id'', emp.id, ''nome'', emp.nome) from empreendimentos emp where emp.id = l.empreendimento_id) as empreendimento,
        (select jsonb_build_object(''id'', fav.id, ''nome'', fav.nome, ''razao_social'', fav.razao_social) from contatos fav where fav.id = l.favorecido_contato_id) as favorecido
      from lancamentos l
      ' || v_where || '
      order by l.' || p_sort_field || ' ' || p_sort_direction || '
      limit ' || p_items_per_page || ' offset ' || v_offset || '
    ) t'
  into v_data;

  -- 5. O Grande Retorno Unificado
  return jsonb_build_object(
    'data', coalesce(v_data, '[]'::jsonb),
    'count', v_total_count,
    'stats', v_stats -- <--- AGORA SIM! O "Motor Único" entrega tudo!
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_bim_elements(p_organizacao_id bigint, p_projeto_id bigint, p_urn text, p_elementos jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sync_time timestamp with time zone;
BEGIN
  -- Marca a hora do inicio da transação
  v_sync_time := now();

  -- 1. UPSERT (Inserir novos ou Atualizar existentes)
  -- Transformamos o JSON recebido em uma tabela temporária virtual e jogamos na tabela real
  INSERT INTO public.elementos_bim (
    organizacao_id,
    projeto_bim_id,
    external_id,
    categoria,
    familia,
    tipo,
    nivel,
    propriedades,
    urn_autodesk,
    is_active,
    atualizado_em
  )
  SELECT 
    p_organizacao_id,
    p_projeto_id,
    item->>'external_id',
    item->>'categoria',
    item->>'familia',
    item->>'tipo',
    item->>'nivel',
    (item->>'propriedades')::jsonb,
    p_urn,
    true, -- Garante que itens que vieram no JSON fiquem ativos
    v_sync_time -- Atualiza a data para AGORA
  FROM jsonb_array_elements(p_elementos) AS item
  ON CONFLICT (projeto_bim_id, external_id) 
  DO UPDATE SET
    categoria = EXCLUDED.categoria,
    familia = EXCLUDED.familia,
    tipo = EXCLUDED.tipo,
    nivel = EXCLUDED.nivel,
    propriedades = EXCLUDED.propriedades,
    urn_autodesk = EXCLUDED.urn_autodesk,
    is_active = true, -- Reativa caso estivesse excluído antes
    atualizado_em = v_sync_time;

  -- 2. SOFT DELETE (O Pulo do Gato)
  -- Se o elemento pertence a este projeto, MAS a data de atualização é MENOR que o inicio desta função,
  -- significa que ele NÃO veio no JSON (foi excluído no Revit).
  UPDATE public.elementos_bim
  SET is_active = false
  WHERE projeto_bim_id = p_projeto_id
    AND atualizado_em < v_sync_time;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.realizar_estorno_movimentacao(p_movimentacao_id bigint, p_quantidade_estorno numeric, p_motivo text, p_usuario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_mov_original RECORD;
BEGIN
  -- 1. Buscar dados da movimentação original
  SELECT * INTO v_mov_original
  FROM public.movimentacoes_estoque
  WHERE id = p_movimentacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação original não encontrada.';
  END IF;

  -- 2. Validações de Segurança
  IF p_quantidade_estorno <= 0 THEN
    RAISE EXCEPTION 'A quantidade para estorno deve ser maior que zero.';
  END IF;

  IF p_quantidade_estorno > v_mov_original.quantidade THEN
    RAISE EXCEPTION 'Não é possível estornar mais do que foi retirado originalmente.';
  END IF;

  -- 3. Atualizar o Estoque (Devolver o item)
  UPDATE public.estoque
  SET 
    quantidade_atual = quantidade_atual + p_quantidade_estorno,
    -- Se foi retirada de funcionário (Equipamento), reduz o "Em Uso". 
    quantidade_em_uso = CASE 
      WHEN v_mov_original.tipo = 'Retirada por Funcionário' THEN quantidade_em_uso - p_quantidade_estorno 
      ELSE quantidade_em_uso 
    END,
    ultima_atualizacao = NOW()
  WHERE id = v_mov_original.estoque_id;

  -- 4. Criar o registro do Estorno (USANDO O TIPO PERMITIDO)
  INSERT INTO public.movimentacoes_estoque (
    estoque_id,
    tipo, -- <--- AQUI ESTAVA O ERRO, AGORA ESTÁ CORRIGIDO
    quantidade,
    data_movimentacao,
    usuario_id,
    funcionario_id,
    organizacao_id,
    observacao
  ) VALUES (
    v_mov_original.estoque_id,
    'Devolução ao Estoque', -- Usamos este termo que o banco já aceita!
    p_quantidade_estorno,
    NOW(),
    p_usuario_id,
    v_mov_original.funcionario_id,
    v_mov_original.organizacao_id,
    p_motivo || ' (Estorno da Movimentação #' || p_movimentacao_id || ')'
  );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_devolucao_estoque(p_estoque_id bigint, p_quantidade numeric, p_observacao text, p_usuario_id uuid, p_organizacao_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_estoque RECORD;
BEGIN
  -- 1. Buscar dados atuais do item no estoque
  SELECT * INTO v_estoque
  FROM public.estoque
  WHERE id = p_estoque_id AND organizacao_id = p_organizacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado ou não pertence à sua organização.';
  END IF;

  -- 2. Validações de Segurança
  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade devolvida deve ser maior que zero.';
  END IF;

  IF p_quantidade > v_estoque.quantidade_em_uso THEN
    RAISE EXCEPTION 'Erro: Tentativa de devolver % itens, mas constam apenas % em uso.', p_quantidade, v_estoque.quantidade_em_uso;
  END IF;

  -- 3. Atualizar o Estoque (A Mágica da Devolução)
  UPDATE public.estoque
  SET 
    quantidade_atual = quantidade_atual + p_quantidade,    -- Volta para a prateleira
    quantidade_em_uso = quantidade_em_uso - p_quantidade,  -- Sai da mão do pessoal
    ultima_atualizacao = NOW()
  WHERE id = p_estoque_id;

  -- 4. Registrar no Histórico (Movimentações)
  INSERT INTO public.movimentacoes_estoque (
    estoque_id,
    tipo,
    quantidade,
    data_movimentacao,
    usuario_id,
    organizacao_id,
    observacao
  ) VALUES (
    p_estoque_id,
    'Devolução ao Estoque', -- Tipo oficial permitido
    p_quantidade,
    NOW(),
    p_usuario_id,
    p_organizacao_id,
    p_observacao
  );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_rotear_lead(p_contato_no_funil_id bigint)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
            DECLARE
                v_org_id      BIGINT;
                v_campaign_id TEXT;
                v_ad_id       TEXT;
                v_page_id     TEXT;
                v_funil_id    TEXT;
                v_coluna_id   BIGINT;
                v_regra_nome  TEXT;
            BEGIN
                SELECT cnf.organizacao_id, c.meta_campaign_id, c.meta_ad_id, c.meta_page_id
                INTO v_org_id, v_campaign_id, v_ad_id, v_page_id
                FROM contatos_no_funil cnf
                JOIN contatos c ON c.id = cnf.contato_id
                WHERE cnf.id = p_contato_no_funil_id;

                IF NOT FOUND THEN
                    RETURN 'ERRO: contato_no_funil nao encontrado';
                END IF;

                SELECT r.funil_destino_id, r.nome
                INTO v_funil_id, v_regra_nome
                FROM regras_roteamento_funil r
                WHERE r.organizacao_id = v_org_id
                  AND r.ativo = TRUE
                  AND (r.campaign_id IS NULL OR r.campaign_id = v_campaign_id)
                  AND (r.ad_id IS NULL OR r.ad_id = v_ad_id)
                  AND (r.page_id IS NULL OR r.page_id = v_page_id)
                ORDER BY
                    (CASE WHEN r.ad_id IS NOT NULL THEN 4 ELSE 0 END +
                     CASE WHEN r.campaign_id IS NOT NULL THEN 2 ELSE 0 END +
                     CASE WHEN r.page_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                    r.ordem ASC
                LIMIT 1;

                IF v_funil_id IS NULL THEN
                    RETURN 'SEM_REGRA';
                END IF;

                -- Busca coluna ENTRADA do funil destino (cast funil_id para text para comparar)
                SELECT id INTO v_coluna_id
                FROM colunas_funil
                WHERE funil_id::TEXT = v_funil_id
                  AND tipo_coluna = 'entrada'
                LIMIT 1;

                IF v_coluna_id IS NULL THEN
                    RETURN 'ERRO: funil destino sem coluna ENTRADA';
                END IF;

                UPDATE contatos_no_funil
                SET coluna_id = v_coluna_id
                WHERE id = p_contato_no_funil_id;

                RETURN 'ROTEADO:' || v_regra_nome;
            END;
            $function$
;

CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid, p_org_id bigint)
 RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_user_nome text, other_user_sobrenome text, other_user_avatar text, last_message_content text, last_message_created_at timestamp with time zone, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as conversation_id,
        u.id as other_user_id,
        u.nome as other_user_nome,
        u.sobrenome as other_user_sobrenome,
        u.avatar_url as other_user_avatar,
        m.conteudo as last_message_content,
        m.created_at as last_message_created_at,
        (SELECT count(*) FROM sys_chat_messages m2 WHERE m2.conversation_id = c.id AND m2.sender_id != p_user_id AND m2.read_at IS NULL)::bigint as unread_count
    FROM sys_chat_conversations c
    JOIN sys_chat_participants p1 ON c.id = p1.conversation_id AND p1.user_id = p_user_id
    JOIN sys_chat_participants p2 ON c.id = p2.conversation_id AND p2.user_id != p_user_id
    JOIN usuarios u ON p2.user_id = u.id
    LEFT JOIN LATERAL (
        SELECT conteudo, created_at
        FROM sys_chat_messages
        WHERE sys_chat_messages.conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
    ) m ON true
    WHERE c.organizacao_id = p_org_id AND m.conteudo IS NOT NULL
    ORDER BY m.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_atividades_ai(p_organizacao_id bigint, p_termo text DEFAULT NULL::text, p_funcionario_id bigint DEFAULT NULL::bigint, p_empreendimento_id bigint DEFAULT NULL::bigint, p_status text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, nome text, descricao text, tipo_atividade text, data_inicio_prevista date, hora_inicio time without time zone, duracao_dias numeric, duracao_horas numeric, status text, funcionario_id bigint, responsavel_texto text, empreendimento_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        a.id, a.nome, a.descricao, a.tipo_atividade, 
        a.data_inicio_prevista, a.hora_inicio, 
        a.duracao_dias, a.duracao_horas, 
        a.status, a.funcionario_id, a.responsavel_texto, a.empreendimento_id
    FROM public.activities a
    WHERE a.organizacao_id = p_organizacao_id
      AND (p_status IS NULL AND a.status != 'Concluído' OR a.status = p_status)
      AND (p_termo IS NULL OR a.nome ILIKE '%' || p_termo || '%' OR a.descricao ILIKE '%' || p_termo || '%')
      AND (p_funcionario_id IS NULL OR a.funcionario_id = p_funcionario_id)
      AND (p_empreendimento_id IS NULL OR a.empreendimento_id = p_empreendimento_id)
    ORDER BY a.data_inicio_prevista DESC, a.created_at DESC
    LIMIT 20;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_notificacao_automatica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    r_regra RECORD;
    r_user RECORD;
    v_titulo_final text;
    v_mensagem_final text;
    v_link_final text;
    v_nome_empreendimento text := '';
    v_nome_contato text := '';
    v_unidade text := '';
    v_pref_sistema boolean;
    v_pref_push boolean;
BEGIN
    IF (TG_TABLE_NAME = 'produtos_empreendimento') THEN
        v_unidade := COALESCE(NEW.unidade, 'N/A');
        IF (NEW.empreendimento_id IS NOT NULL) THEN
            SELECT nome INTO v_nome_empreendimento
            FROM public.empreendimentos 
            WHERE id = NEW.empreendimento_id;
        END IF;
    END IF;

    IF (TG_TABLE_NAME = 'whatsapp_messages') THEN
        IF (NEW.contato_id IS NOT NULL) THEN
            SELECT nome INTO v_nome_contato
            FROM public.contatos 
            WHERE id = NEW.contato_id;
        END IF;
    END IF;

    v_nome_empreendimento := COALESCE(v_nome_empreendimento, 'Empreendimento');
    v_nome_contato := COALESCE(v_nome_contato, 'Contato Desconhecido');
    v_unidade := COALESCE(v_unidade, '');

    FOR r_regra IN 
        SELECT 
            t.id, t.coluna_monitorada, t.valor_gatilho, t.titulo_template, t.mensagem_template, t.link_template, t.icone,
            s.funcoes_ids, s.enviar_push
        FROM public.sys_notification_templates t
        JOIN public.sys_org_notification_settings s ON s.template_id = t.id
        WHERE t.tabela_alvo = TG_TABLE_NAME 
          AND t.evento = TG_OP 
          AND s.is_active = true 
          AND s.organizacao_id = NEW.organizacao_id
    LOOP
        
        IF r_regra.coluna_monitorada IS NOT NULL AND r_regra.coluna_monitorada <> '' THEN
             IF (to_jsonb(NEW)->>r_regra.coluna_monitorada) IS DISTINCT FROM r_regra.valor_gatilho THEN
                CONTINUE; 
             END IF;
        END IF;

        FOR r_user IN 
            SELECT u.id 
            FROM public.usuarios u
            WHERE (u.funcao_id::text = ANY(r_regra.funcoes_ids::text[]) OR r_regra.funcoes_ids IS NULL) AND organizacao_id = NEW.organizacao_id
        LOOP
            SELECT canal_sistema, canal_push 
            INTO v_pref_sistema, v_pref_push
            FROM public.usuario_preferencias_notificacao
            WHERE usuario_id = r_user.id AND regra_id = r_regra.id;

            IF v_pref_sistema IS NULL THEN v_pref_sistema := true; END IF;
            IF v_pref_push IS NULL THEN v_pref_push := true; END IF;

            IF v_pref_sistema = true THEN
                v_titulo_final := r_regra.titulo_template;
                v_mensagem_final := r_regra.mensagem_template;
                v_link_final := r_regra.link_template;

                v_titulo_final := replace(v_titulo_final, '{nome_empreendimento}', v_nome_empreendimento);
                v_mensagem_final := replace(v_mensagem_final, '{nome_empreendimento}', v_nome_empreendimento);
                
                v_titulo_final := replace(v_titulo_final, '{nome_contato}', v_nome_contato);
                v_mensagem_final := replace(v_mensagem_final, '{nome_contato}', v_nome_contato);
                
                v_titulo_final := replace(v_titulo_final, '{unidade}', v_unidade);
                v_mensagem_final := replace(v_mensagem_final, '{unidade}', v_unidade);
                
                v_link_final := replace(v_link_final, '{empreendimento_id}', COALESCE(NEW.empreendimento_id::text, ''));

                INSERT INTO public.notificacoes (
                    titulo, mensagem, link, user_id, organizacao_id, lida, created_at, enviar_push, icone
                ) VALUES (
                    v_titulo_final, v_mensagem_final, v_link_final, r_user.id, NEW.organizacao_id, false, now(), 
                    (r_regra.enviar_push AND v_pref_push), r_regra.icone
                );
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
        DECLARE
            r_part RECORD;
            v_sender_name text;
            v_org_id bigint;
        BEGIN
            -- Obter nome do remetente
            SELECT nome INTO v_sender_name FROM public.usuarios WHERE id = NEW.sender_id;
            IF v_sender_name IS NULL THEN v_sender_name := 'Alguem'; END IF;
        
            -- Obter org id
            SELECT organizacao_id INTO v_org_id FROM public.sys_chat_conversations WHERE id = NEW.conversation_id;
        
            -- Iterar sobre os outros participantes (Destinatario)
            FOR r_part IN 
                SELECT p.user_id 
                FROM public.sys_chat_participants p
                WHERE p.conversation_id = NEW.conversation_id
                  AND p.user_id != NEW.sender_id
            LOOP
                -- Inserir na tabela de notificacoes do sistema
                INSERT INTO public.notificacoes (
                    user_id, 
                    organizacao_id, 
                    titulo, 
                    mensagem, 
                    link, 
                    lida, 
                    tipo, 
                    enviar_push, 
                    icone, 
                    created_at
                ) VALUES (
                    r_part.user_id, 
                    v_org_id, 
                    'Mensagem de ' || v_sender_name, 
                    NEW.conteudo, 
                    '/chat', 
                    false, 
                    'chat', 
                    true, 
                    'fa-comment-dots', 
                    now()
                );
            END LOOP;
        
            RETURN NEW;
        END;
        $function$
;

CREATE OR REPLACE FUNCTION public.processar_regras_notificacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    r_regra RECORD;
    r_user RECORD;
    r_variavel RECORD;
    r_condicao RECORD;
    
    v_titulo_final text;
    v_mensagem_final text;
    v_link_final text;
    v_atendeu_todas boolean;
    
    v_json_dados jsonb;
    v_valor_novo text;
    v_valor_antigo text;
    
    v_nome_empreendimento text := '';
    v_nome_contato text := '';
    v_unidade text := '';
    v_dono_id uuid;
    
    v_phone_clean text;
    v_query_dinamica text;
    v_valor_resolvido text;
    v_valor_num_novo numeric;
    v_valor_num_gatilho numeric;
    
BEGIN
    v_json_dados := to_jsonb(NEW);

    IF (TG_TABLE_NAME = 'whatsapp_messages') THEN
        IF (NEW.contato_id IS NOT NULL) THEN
            SELECT nome INTO v_nome_contato FROM public.contatos WHERE id = NEW.contato_id;
        END IF;
        IF (v_nome_contato IS NULL OR v_nome_contato = '') AND NEW.sender_id IS NOT NULL THEN
            v_phone_clean := regexp_replace(NEW.sender_id, '\D', '', 'g');
            SELECT c.nome INTO v_nome_contato
            FROM public.contatos c
            JOIN public.telefones t ON c.id = t.contato_id
            WHERE t.telefone LIKE '%' || right(v_phone_clean, 8) LIMIT 1;
        END IF;
        v_nome_contato := COALESCE(v_nome_contato, NEW.nome_remetente, NEW.sender_id, 'Lead');
    END IF;

    IF (TG_TABLE_NAME = 'produtos_empreendimento') THEN
        v_unidade := COALESCE(NEW.unidade, 'N/A');
        IF (NEW.empreendimento_id IS NOT NULL) THEN
            SELECT nome INTO v_nome_empreendimento FROM public.empreendimentos WHERE id = NEW.empreendimento_id;
        END IF;
    END IF;

    v_nome_empreendimento := COALESCE(v_nome_empreendimento, '');
    v_nome_contato := COALESCE(v_nome_contato, '');

    FOR r_regra IN 
        SELECT 
            t.id, t.regras_avancadas, t.coluna_monitorada, t.valor_gatilho, 
            t.titulo_template, t.mensagem_template, t.link_template, t.icone, t.enviar_para_dono,
            s.funcoes_ids, s.enviar_push
        FROM public.sys_notification_templates t
        JOIN public.sys_org_notification_settings s ON s.template_id = t.id
        WHERE t.tabela_alvo = TG_TABLE_NAME 
          AND t.evento = TG_OP 
          AND s.is_active = true 
          AND s.organizacao_id = NEW.organizacao_id
    LOOP
        BEGIN 
            v_atendeu_todas := true;

            IF r_regra.regras_avancadas IS NOT NULL AND jsonb_array_length(r_regra.regras_avancadas) > 0 THEN
                FOR r_condicao IN SELECT * FROM jsonb_to_recordset(r_regra.regras_avancadas) AS x(campo text, operador text, valor text) LOOP
                    v_valor_novo := v_json_dados->>r_condicao.campo;
                    CASE r_condicao.operador
                        WHEN 'igual' THEN 
                            IF v_valor_novo IS DISTINCT FROM r_condicao.valor THEN v_atendeu_todas := false; END IF;
                        WHEN 'diferente' THEN 
                            IF v_valor_novo IS NOT DISTINCT FROM r_condicao.valor THEN v_atendeu_todas := false; END IF;
                        WHEN 'contem' THEN 
                            IF v_valor_novo NOT ILIKE '%' || r_condicao.valor || '%' THEN v_atendeu_todas := false; END IF;
                        WHEN 'nao_contem' THEN 
                            IF v_valor_novo ILIKE '%' || r_condicao.valor || '%' THEN v_atendeu_todas := false; END IF;
                        WHEN 'vazio' THEN 
                            IF v_valor_novo IS NOT NULL AND v_valor_novo <> '' THEN v_atendeu_todas := false; END IF;
                        WHEN 'nao_vazio' THEN 
                            IF v_valor_novo IS NULL OR v_valor_novo = '' THEN v_atendeu_todas := false; END IF;
                        WHEN 'maior' THEN
                            BEGIN
                                v_valor_num_novo := v_valor_novo::numeric;
                                v_valor_num_gatilho := r_condicao.valor::numeric;
                                IF NOT (v_valor_num_novo > v_valor_num_gatilho) THEN v_atendeu_todas := false; END IF;
                            EXCEPTION WHEN OTHERS THEN v_atendeu_todas := false; END;
                        WHEN 'menor' THEN
                            BEGIN
                                v_valor_num_novo := v_valor_novo::numeric;
                                v_valor_num_gatilho := r_condicao.valor::numeric;
                                IF NOT (v_valor_num_novo < v_valor_num_gatilho) THEN v_atendeu_todas := false; END IF;
                            EXCEPTION WHEN OTHERS THEN v_atendeu_todas := false; END;
                        WHEN 'mudou' THEN
                            IF TG_OP = 'UPDATE' THEN
                                v_valor_antigo := to_jsonb(OLD)->>r_condicao.campo;
                                IF v_valor_antigo IS NOT DISTINCT FROM v_valor_novo THEN v_atendeu_todas := false; END IF;
                            END IF;
                    END CASE;
                    IF v_atendeu_todas = false THEN EXIT; END IF;
                END LOOP;
            ELSIF r_regra.coluna_monitorada IS NOT NULL AND r_regra.coluna_monitorada <> '' THEN
                 v_valor_novo := v_json_dados->>r_regra.coluna_monitorada;
                 IF v_valor_novo IS DISTINCT FROM r_regra.valor_gatilho THEN
                    v_atendeu_todas := false;
                 END IF;
                 IF TG_OP = 'UPDATE' AND v_atendeu_todas = true THEN
                    v_valor_antigo := to_jsonb(OLD)->>r_regra.coluna_monitorada;
                    IF v_valor_antigo IS NOT DISTINCT FROM v_valor_novo THEN
                        v_atendeu_todas := false;
                    END IF;
                 END IF;
            END IF;

            IF v_atendeu_todas = false THEN 
                CONTINUE; 
            END IF;

            v_titulo_final := r_regra.titulo_template;
            v_mensagem_final := r_regra.mensagem_template;
            v_link_final := r_regra.link_template;

            v_titulo_final := replace(v_titulo_final, '{nome_contato}', v_nome_contato);
            v_mensagem_final := replace(v_mensagem_final, '{nome_contato}', v_nome_contato);
            v_link_final := replace(v_link_final, '{nome_contato}', v_nome_contato);
            
            v_titulo_final := replace(v_titulo_final, '{nome_empreendimento}', v_nome_empreendimento);
            v_mensagem_final := replace(v_mensagem_final, '{nome_empreendimento}', v_nome_empreendimento);
            v_link_final := replace(v_link_final, '{nome_empreendimento}', v_nome_empreendimento);
            
            v_titulo_final := replace(v_titulo_final, '{unidade}', v_unidade);
            v_mensagem_final := replace(v_mensagem_final, '{unidade}', v_unidade);
            v_link_final := replace(v_link_final, '{unidade}', v_unidade);

            DECLARE key text; val text; BEGIN
                FOR key, val IN SELECT * FROM jsonb_each_text(v_json_dados) LOOP
                    v_titulo_final := replace(v_titulo_final, '{' || key || '}', COALESCE(val, ''));
                    v_mensagem_final := replace(v_mensagem_final, '{' || key || '}', COALESCE(val, ''));
                    v_link_final := replace(v_link_final, '{' || key || '}', COALESCE(val, ''));
                END LOOP;
            END;

            FOR r_variavel IN SELECT * FROM public.variaveis_virtuais WHERE tabela_gatilho = TG_TABLE_NAME LOOP
                IF (v_titulo_final LIKE '%{' || r_variavel.nome_variavel || '}%') 
                OR (v_mensagem_final LIKE '%{' || r_variavel.nome_variavel || '}%')
                OR (v_link_final LIKE '%{' || r_variavel.nome_variavel || '}%') THEN
                    v_valor_novo := v_json_dados->>r_variavel.coluna_origem;
                    IF v_valor_novo IS NOT NULL AND v_valor_novo <> '' THEN
                        v_query_dinamica := format('SELECT %I::text FROM public.%I WHERE %I = %L LIMIT 1', r_variavel.coluna_retorno, r_variavel.tabela_destino, r_variavel.coluna_chave_destino, v_valor_novo);
                        BEGIN EXECUTE v_query_dinamica INTO v_valor_resolvido; EXCEPTION WHEN OTHERS THEN v_valor_resolvido := NULL; END;
                        
                        v_titulo_final := replace(v_titulo_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                        v_mensagem_final := replace(v_mensagem_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                        v_link_final := replace(v_link_final, '{' || r_variavel.nome_variavel || '}', COALESCE(v_valor_resolvido, '...'));
                    END IF;
                END IF;
            END LOOP;

            IF r_regra.funcoes_ids IS NOT NULL AND array_length(r_regra.funcoes_ids, 1) > 0 THEN
                FOR r_user IN SELECT id FROM public.usuarios WHERE funcao_id::text = ANY(r_regra.funcoes_ids::text[]) AND organizacao_id = NEW.organizacao_id LOOP
                    INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                    VALUES (r_user.id, NEW.organizacao_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', r_regra.enviar_push, r_regra.icone, now())
                    ON CONFLICT DO NOTHING;
                END LOOP;
            END IF;

            IF r_regra.enviar_para_dono = true THEN
                v_dono_id := NULL;
                IF v_json_dados ? 'criado_por_usuario_id' THEN v_dono_id := (v_json_dados->>'criado_por_usuario_id')::uuid;
                ELSIF v_json_dados ? 'user_id' THEN v_dono_id := (v_json_dados->>'user_id')::uuid;
                ELSIF v_json_dados ? 'corretor_id' THEN v_dono_id := (v_json_dados->>'corretor_id')::uuid;
                END IF;

                IF v_dono_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.usuarios WHERE id = v_dono_id) THEN
                    INSERT INTO public.notificacoes (user_id, organizacao_id, titulo, mensagem, link, lida, tipo, enviar_push, icone, created_at)
                    VALUES (v_dono_id, NEW.organizacao_id, v_titulo_final, v_mensagem_final, v_link_final, false, 'sistema', r_regra.enviar_push, r_regra.icone, now());
                END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao processar regra %: %', r_regra.id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.duplicar_contrato_e_detalhes(p_contrato_id bigint)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec_contrato record;
    new_contrato_id bigint;
    rec_parcela record;
    rec_permuta record;
BEGIN
    -- 1. Encontra o contrato original para copiar os dados
    SELECT * INTO rec_contrato FROM public.contratos WHERE id = p_contrato_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Contrato original não encontrado.');
    END IF;

    -- 2. Insere um novo contrato com os dados do original, mas com status "Rascunho" e sem produto_id
    INSERT INTO public.contratos (
        contato_id,
        produto_id, -- Ficará nulo para ser preenchido depois
        empreendimento_id,
        data_venda,
        valor_final_venda,
        status_contrato, -- Definido como Rascunho
        simulacao_id, -- Ficará nulo
        corretor_id,
        indice_reajuste,
        multa_inadimplencia_percentual,
        juros_mora_inadimplencia_percentual,
        clausula_penal_percentual,
        organizacao_id
    )
    VALUES (
        rec_contrato.contato_id,
        NULL, -- Importante: a cópia não vem atrelada a uma unidade
        rec_contrato.empreendimento_id,
        CURRENT_DATE, -- Usa a data atual para a cópia
        rec_contrato.valor_final_venda,
        'Rascunho', -- Status inicial da cópia
        NULL, -- A simulação não é copiada
        rec_contrato.corretor_id,
        rec_contrato.indice_reajuste,
        rec_contrato.multa_inadimplencia_percentual,
        rec_contrato.juros_mora_inadimplencia_percentual,
        rec_contrato.clausula_penal_percentual,
        rec_contrato.organizacao_id
    )
    RETURNING id INTO new_contrato_id;

    -- 3. Copia todas as parcelas do contrato original para o novo contrato
    FOR rec_parcela IN SELECT * FROM public.contrato_parcelas WHERE contrato_id = p_contrato_id
    LOOP
        INSERT INTO public.contrato_parcelas (
            contrato_id,
            descricao,
            tipo,
            data_vencimento,
            valor_parcela,
            status_pagamento, -- Parcelas da cópia começam como Pendente
            organizacao_id
        )
        VALUES (
            new_contrato_id,
            rec_parcela.descricao,
            rec_parcela.tipo,
            rec_parcela.data_vencimento,
            rec_parcela.valor_parcela,
            'Pendente',
            rec_parcela.organizacao_id
        );
    END LOOP;

    -- 4. Copia todas as permutas do contrato original para o novo contrato
    FOR rec_permuta IN SELECT * FROM public.contrato_permutas WHERE contrato_id = p_contrato_id
    LOOP
        INSERT INTO public.contrato_permutas (
            contrato_id,
            descricao,
            valor
        )
        VALUES (
            new_contrato_id,
            rec_permuta.descricao,
            rec_permuta.valor
        );
    END LOOP;

    -- 5. Retorna uma mensagem de sucesso
    RETURN json_build_object('success', true, 'message', 'Contrato duplicado com sucesso como rascunho!');

EXCEPTION
    WHEN OTHERS THEN
        -- Em caso de qualquer erro, retorna uma mensagem de falha
        RETURN json_build_object('success', false, 'message', 'Erro ao duplicar contrato: ' || SQLERRM);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_vincular_lancamento_fatura()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_conta_id bigint;
    v_tipo_conta text;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_mes_referencia text;
    v_data_vencimento date;
    v_fatura_id bigint;
    v_data_base date;
BEGIN
    -- PROTEÇÃO PRINCIPAL (ANCORAGEM)
    -- Se for um UPDATE onde as datas e contas cruciais não mudaram, não recalcula a fatura!
    -- Isso evita que ao clicar em "Processar/Conciliar", os parcelamentos retroativos fujam da fatura correta.
    IF TG_OP = 'UPDATE' THEN
        IF NEW.data_transacao = OLD.data_transacao 
           AND NEW.data_vencimento = OLD.data_vencimento 
           AND NEW.conta_id IS NOT DISTINCT FROM OLD.conta_id 
           AND NEW.tipo = OLD.tipo THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Determinar a conta, usando conta_id (a tabela de lançamentos possui conta_id e não origem_id)
    IF NEW.tipo IN ('Despesa', 'Receita') THEN
        v_conta_id := NEW.conta_id;

        IF v_conta_id IS NOT NULL THEN
            -- Buscar informações da conta
            SELECT tipo, dia_fechamento_fatura, dia_pagamento_fatura 
            INTO v_tipo_conta, v_dia_fechamento, v_dia_pagamento
            FROM public.contas_financeiras 
            WHERE id = v_conta_id;

            IF v_tipo_conta = 'Cartão de Crédito' THEN
                
                -- Se não houver dia fechamento ou pagamento configurado, ignorar
                IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN
                    RETURN NEW;
                END IF;

                -- CONFIANÇA NO PARCELAMENTO / FRONTEND:
                -- Se a data de vencimento foi preenchida pelo sistema COM base no dia do cartão,
                -- devemos respeitar! Isso arruma o bug dos 12 parcelamentos caindo no mesmo mês.
                IF NEW.data_vencimento IS NOT NULL AND EXTRACT(DAY FROM NEW.data_vencimento) = v_dia_pagamento THEN
                    v_data_vencimento := NEW.data_vencimento;
                    
                    -- Define o mes_referencia baseado naprópria data_vencimento (ancorada)
                    IF v_dia_pagamento <= v_dia_fechamento THEN
                        v_mes_referencia := to_char(v_data_vencimento - INTERVAL '1 month', 'YYYY-MM');
                    ELSE
                        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');
                    END IF;
                ELSE
                    -- Fallback: Recalcula tudo a partir da data de transação (compra) caso os dados do frontend sejam insuficientes.
                    v_data_base := NEW.data_transacao;

                    IF EXTRACT(DAY FROM v_data_base) >= v_dia_fechamento THEN
                        v_data_base := v_data_base + INTERVAL '1 month';
                    END IF;

                    v_mes_referencia := to_char(v_data_base, 'YYYY-MM');

                    IF v_dia_pagamento <= v_dia_fechamento THEN
                       v_data_vencimento := (to_char(v_data_base + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    ELSE
                       v_data_vencimento := (v_mes_referencia || '-' || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    END IF;
                    
                    NEW.data_vencimento := v_data_vencimento;
                END IF;

                -- BUSCAR OU CRIAR A FATURA no banco
                SELECT id INTO v_fatura_id 
                FROM public.faturas_cartao 
                WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

                IF v_fatura_id IS NULL THEN
                    -- Se não existe, cria a fatura nova do cartão
                    INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
                    VALUES (v_conta_id, v_mes_referencia, v_data_vencimento, NEW.organizacao_id)
                    RETURNING id INTO v_fatura_id;
                END IF;

                -- Amarrar o lançamento à fatura correta
                NEW.fatura_id := v_fatura_id;
            ELSE
                -- Se não é cartão de crédito, garantir que fatura_id seja nulo
                NEW.fatura_id := NULL;
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.regerar_parcelas_contrato(p_contrato_id bigint)
 RETURNS TABLE(id bigint, contrato_id bigint, descricao text, tipo text, data_vencimento date, valor_parcela numeric, status_pagamento text, lancamento_id bigint, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$DECLARE
    v_simulacao RECORD;
    v_contrato RECORD;
    v_valor_base NUMERIC;
    v_valor_com_desconto NUMERIC;
    v_valor_parcela_entrada NUMERIC;
    v_valor_parcela_obra NUMERIC;
    v_data_vencimento DATE;
BEGIN
    SELECT * INTO v_contrato FROM public.contratos WHERE contratos.id = p_contrato_id;

    -- Encontrar a simulação associada ao contrato
    SELECT s.* INTO v_simulacao
    FROM public.simulacoes s
    JOIN public.contratos c ON s.id = c.simulacao_id
    WHERE c.id = p_contrato_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nenhuma simulação de pagamento individual encontrada para o contrato ID %', p_contrato_id;
    END IF;

    -- Deletar as parcelas antigas que ainda estão pendentes
    DELETE FROM public.contrato_parcelas
    WHERE public.contrato_parcelas.contrato_id = p_contrato_id 
      AND public.contrato_parcelas.status_pagamento = 'Pendente';

    -- Calcular valores base
    v_valor_base := v_simulacao.valor_venda;
    v_valor_com_desconto := v_valor_base - COALESCE(v_simulacao.desconto_valor, 0);

    -- Gerar parcelas da ENTRADA
    IF v_simulacao.num_parcelas_entrada > 0 AND v_simulacao.entrada_valor > 0 THEN
        v_valor_parcela_entrada := v_simulacao.entrada_valor / v_simulacao.num_parcelas_entrada;
        v_data_vencimento := v_simulacao.data_primeira_parcela_entrada;
        FOR i IN 1..v_simulacao.num_parcelas_entrada LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, status_pagamento, organizacao_id)
            VALUES (p_contrato_id, 'Parcela de Entrada ' || i || '/' || v_simulacao.num_parcelas_entrada, 'Entrada', v_data_vencimento, v_valor_parcela_entrada, 'Pendente', v_contrato.organizacao_id);
            v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
        END LOOP;
    END IF;

    -- Gerar parcelas da OBRA
    IF v_simulacao.num_parcelas_obra > 0 AND v_simulacao.parcelas_obra_valor > 0 THEN
        v_valor_parcela_obra := v_simulacao.parcelas_obra_valor / v_simulacao.num_parcelas_obra;
        v_data_vencimento := v_simulacao.data_primeira_parcela_obra;
        FOR i IN 1..v_simulacao.num_parcelas_obra LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, status_pagamento, organizacao_id)
            VALUES (p_contrato_id, 'Parcela de Obra ' || i || '/' || v_simulacao.num_parcelas_obra, 'Obra', v_data_vencimento, v_valor_parcela_obra, 'Pendente', v_contrato.organizacao_id);
            v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
        END LOOP;
    END IF;
    
    -- Retorna todas as parcelas (novas e as que já estavam pagas) do contrato
    RETURN QUERY SELECT contrato_parcelas.id, contrato_parcelas.contrato_id, contrato_parcelas.descricao, contrato_parcelas.tipo, contrato_parcelas.data_vencimento, contrato_parcelas.valor_parcela, contrato_parcelas.status_pagamento, contrato_parcelas.lancamento_id, contrato_parcelas.created_at, contrato_parcelas.updated_at FROM public.contrato_parcelas WHERE contrato_parcelas.contrato_id = p_contrato_id ORDER BY data_vencimento;

END;$function$
;

CREATE OR REPLACE FUNCTION public.fn_relatorio_comercial(p_data_inicio text, p_data_fim text, p_organizacao_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_retorno jsonb;
    v_start_date timestamptz;
    v_end_date timestamptz;
    v_diff_days integer;
    v_min_date timestamptz;
BEGIN
    v_start_date := p_data_inicio::timestamptz;
    v_end_date   := (p_data_fim || ' 23:59:59')::timestamptz;

    -- Descobre a nascente da Organização na Tabela 
    SELECT MIN(created_at) INTO v_min_date 
    FROM contatos 
    WHERE organizacao_id::integer = p_organizacao_id 
      AND tipo_contato = 'Lead';

    -- Trimming de Cauda! 
    IF v_min_date IS NOT NULL AND v_start_date < v_min_date THEN
        v_start_date := date_trunc('day', v_min_date);
    END IF;

    -- Trava Final Reversa  
    IF v_end_date < v_start_date THEN
        v_end_date := v_start_date;
    END IF;

    v_diff_days := (v_end_date::date - v_start_date::date);

    WITH contatos_periodo AS (
        SELECT id, origem, created_at
        FROM contatos
        WHERE organizacao_id::integer = p_organizacao_id
          AND tipo_contato = 'Lead'
          AND created_at >= v_start_date
          AND created_at <= v_end_date
    ),
    serie_tempo AS (
        SELECT generate_series(
            CASE WHEN v_diff_days > 35 THEN date_trunc('month', v_start_date::date) ELSE v_start_date::date END,
            CASE WHEN v_diff_days > 35 THEN date_trunc('month', v_end_date::date) ELSE v_end_date::date END,
            CASE WHEN v_diff_days > 35 THEN '1 month'::interval ELSE '1 day'::interval END
        )::date as data_ref
    ),
    leads_agrupados AS (
        SELECT 
            TO_CHAR(s.data_ref, 'YYYY-MM-DD') AS "data",
            COUNT(c.id) AS qtd
        FROM serie_tempo s
        LEFT JOIN contatos_periodo c ON 
            (CASE WHEN v_diff_days > 35 THEN date_trunc('month', c.created_at::date)::date ELSE c.created_at::date END) = s.data_ref
        GROUP BY s.data_ref
        ORDER BY s.data_ref
    ),
    conversas_whatsapp AS (
        SELECT 
            c.id AS contato_id,
            c.origem,
            c.created_at AS contato_criado_em,
            MIN(m.sent_at) FILTER (WHERE m.direction = 'outbound') as msg_primeiro_outbound,
            MIN(m.sent_at) FILTER (WHERE m.direction = 'inbound') as msg_primeiro_inbound
        FROM contatos_periodo c
        LEFT JOIN whatsapp_messages m ON m.contato_id::text = c.id::text
        GROUP BY c.id, c.origem, c.created_at
    ),
    metricas_tempo as (
        SELECT 
           AVG(EXTRACT(EPOCH FROM (msg_primeiro_outbound - contato_criado_em))/60) FILTER (WHERE msg_primeiro_outbound > contato_criado_em) as tempo_nossa_resposta,
           AVG(EXTRACT(EPOCH FROM (msg_primeiro_inbound - msg_primeiro_outbound))/60) FILTER (WHERE msg_primeiro_inbound > msg_primeiro_outbound) as tempo_espera_lead,
           COUNT(msg_primeiro_outbound) as total_interagidos
        FROM conversas_whatsapp
    ),
    totais_leads_origem AS (
        SELECT 
            SUM(qtd) as total_leads,
            COALESCE(
                jsonb_object_agg(origem_ajustada, qtd), 
                '{}'::jsonb
            ) as leads_por_origem
        FROM (
            SELECT 
                COALESCE(NULLIF(TRIM(origem), ''), 'Orgânico/Direto') as origem_ajustada, 
                COUNT(*) as qtd
            FROM contatos_periodo
            GROUP BY 1
        ) sub
    ),
    -- Lógica Exata Aprovada Ranniere: Snapshot Literal Ordenado Cronologicamente e Forçando Início
    cards_do_periodo AS (
        SELECT cnf.id as contato_no_funil_id, 
               cnf.coluna_id as coluna_atual_id,
               col.funil_id
        FROM contatos_no_funil cnf
        INNER JOIN contatos_periodo cp ON cp.id::text = cnf.contato_id::text
        LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
        WHERE cnf.organizacao_id = p_organizacao_id
    ),
    pisadas_brutas AS (
        -- Movimentos registrados
        SELECT h.contato_no_funil_id, h.coluna_nova_id as coluna_id
        FROM historico_movimentacao_funil h
        INNER JOIN cards_do_periodo cp ON cp.contato_no_funil_id = h.contato_no_funil_id
        UNION
        -- Estado Atual (Cobre quem nunca se moveu)
        SELECT cp.contato_no_funil_id, cp.coluna_atual_id as coluna_id
        FROM cards_do_periodo cp
        UNION
        -- Auto-Inserção da Etapa 0 (Entrada). Todo lead preenche necessariamente o topo da funilização.
        SELECT cp.contato_no_funil_id, cf_base.id as coluna_id
        FROM cards_do_periodo cp
        INNER JOIN colunas_funil cf_base ON cf_base.funil_id = cp.funil_id
        WHERE cf_base.ordem = 0 OR UPPER(TRIM(cf_base.nome)) = 'ENTRADA'
    ),
    conversao_funil AS (
        SELECT 
            INITCAP(LOWER(TRIM(cf.nome))) as name,
            COUNT(DISTINCT pb.contato_no_funil_id) as value,
            AVG(cf.ordem) as ordem_base
        FROM pisadas_brutas pb
        INNER JOIN colunas_funil cf ON cf.id = pb.coluna_id
        GROUP BY INITCAP(LOWER(TRIM(cf.nome)))
        -- Ordenação Obrigatória pela Posição Numérica NATIVA da Coluna no CRM!!
        ORDER BY AVG(cf.ordem) ASC, COUNT(DISTINCT pb.contato_no_funil_id) DESC
    )
    SELECT jsonb_build_object(
        'total_leads', COALESCE((SELECT total_leads FROM totais_leads_origem), 0),
        'leads_por_origem', COALESCE((SELECT leads_por_origem FROM totais_leads_origem), '{}'::jsonb),
        'total_conversas_ativas', COALESCE((SELECT total_interagidos FROM metricas_tempo), 0),
        'nosso_tempo_medio_resposta_minutos', COALESCE((SELECT tempo_nossa_resposta FROM metricas_tempo), 0),
        'tempo_medio_resposta_lead_minutos', COALESCE((SELECT tempo_espera_lead FROM metricas_tempo), 0),
        'leads_por_dia', COALESCE((SELECT jsonb_agg(jsonb_build_object('data', "data", 'qtd', qtd)) FROM leads_agrupados), '[]'::jsonb),
        'conversao_funil', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value, 'ordem', ordem_base)) FROM conversao_funil), '[]'::jsonb)
    ) INTO v_retorno;

    RETURN v_retorno;
END;
$function$
;

ALTER TABLE public."funcoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."etapa_obra" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."funcionarios" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."ocorrencias" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."configuracoes_belvo" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."diarios_obra" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."permissoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."ai_planning_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contrato_parcelas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."kpis_personalizados" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."usuario_aceite_politicas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."modelos_contrato" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."marcas_uploads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."bim_notas_elementos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."activity_anexos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."abonos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."configuracoes_venda" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."jornada_detalhes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."produtos_empreendimento" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."categorias_financeiras" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."disciplinas_projetos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."documento_tipos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."lancamentos_anexos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."whatsapp_webhook_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automacoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."configuracoes_whatsapp" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."lancamentos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contatos_no_funil" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contatos_no_funil_produtos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contrato_permutas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."funis" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."colunas_funil" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."conciliacao_historico" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."app_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."chat_conversations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."email_regras" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."meta_ads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."meta_adsets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."configuracoes_ia" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."crm_notas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."empreendimento_documento_embeddings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."abono_tipos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contratos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."feriados" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."historico_movimentacao_funil" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contatos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."pedidos_compra" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."vales_agendados" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."activities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contracheques" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cadastro_empresa" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."banco_arquivos_ofx" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."banco_transacoes_ofx" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."historico_salarial" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."banco_de_horas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contas_financeiras" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."email_configuracoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."empresa_anexos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."estoque" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."telefones_backup_faxina" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tabelas_sistema" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."elementos_bim" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."movimentacoes_estoque" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."whatsapp_scheduled_broadcasts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contrato_produtos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."meta_ads_historico" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."whatsapp_messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."whatsapp_conversations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."atividades_elementos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."debug_notificacoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."bim_notas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."bim_notas_comentarios" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."notificacoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cargos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."termos_aceite" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."termos_uso" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."email_messages_cache" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."parcelas_adicionais" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."auditoria_ia_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."campos_sistema" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."orcamento_itens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."feedback" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."jornadas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."materiais" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contrato_anexos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."documentos_funcionarios" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."emails" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."empreendimento_anexos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."empreendimentos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."faturas_cartao" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."meta_campaigns" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."notification_subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."orcamentos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."pedidos_compra_anexos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."pedidos_compra_itens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."pedidos_compra_status_historico_legacy" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."pontos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."indices_financeiros" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."meta_form_config" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."meta_forms_catalog" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."projetos_bim" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."chat_messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."variaveis_virtuais" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."rdo_fotos_uploads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."simulacoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."sinapi" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."subetapas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."telefones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."politicas_plataforma" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."bim_vistas_federadas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."pedidos_compra_historico_fases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."pedidos_fases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."usuarios" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."whatsapp_broadcast_lists" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."whatsapp_list_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."integracoes_meta" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contratos_terceirizados" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contratos_terceirizados_anexos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."integracoes_google" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."monitor_visitas" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."funcoes";
CREATE POLICY "Acesso restrito por organização" ON public."funcoes" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."funcoes";
CREATE POLICY "rls_delete_org_policy" ON public."funcoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."funcoes";
CREATE POLICY "rls_insert_org_policy" ON public."funcoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."funcoes";
CREATE POLICY "rls_select_org_policy" ON public."funcoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."funcoes";
CREATE POLICY "rls_update_org_policy" ON public."funcoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."etapa_obra";
CREATE POLICY "Acesso restrito por organização" ON public."etapa_obra" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."etapa_obra";
CREATE POLICY "rls_delete_org_policy" ON public."etapa_obra" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."etapa_obra";
CREATE POLICY "rls_insert_org_policy" ON public."etapa_obra" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."etapa_obra";
CREATE POLICY "rls_select_org_policy" ON public."etapa_obra" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."etapa_obra";
CREATE POLICY "rls_update_org_policy" ON public."etapa_obra" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."funcionarios";
CREATE POLICY "Acesso restrito por organização" ON public."funcionarios" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."funcionarios";
CREATE POLICY "rls_delete_org_policy" ON public."funcionarios" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."funcionarios";
CREATE POLICY "rls_insert_org_policy" ON public."funcionarios" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."funcionarios";
CREATE POLICY "rls_select_org_policy" ON public."funcionarios" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."funcionarios";
CREATE POLICY "rls_update_org_policy" ON public."funcionarios" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."ocorrencias";
CREATE POLICY "Acesso restrito por organização" ON public."ocorrencias" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."ocorrencias";
CREATE POLICY "rls_delete_org_policy" ON public."ocorrencias" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."ocorrencias";
CREATE POLICY "rls_insert_org_policy" ON public."ocorrencias" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."ocorrencias";
CREATE POLICY "rls_select_org_policy" ON public."ocorrencias" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."ocorrencias";
CREATE POLICY "rls_update_org_policy" ON public."ocorrencias" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso config Belvo por organização" ON public."configuracoes_belvo";
CREATE POLICY "Acesso config Belvo por organização" ON public."configuracoes_belvo" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."configuracoes_belvo";
CREATE POLICY "rls_delete_org_policy" ON public."configuracoes_belvo" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."configuracoes_belvo";
CREATE POLICY "rls_insert_org_policy" ON public."configuracoes_belvo" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."configuracoes_belvo";
CREATE POLICY "rls_select_org_policy" ON public."configuracoes_belvo" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."configuracoes_belvo";
CREATE POLICY "rls_update_org_policy" ON public."configuracoes_belvo" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."diarios_obra";
CREATE POLICY "Acesso restrito por organização" ON public."diarios_obra" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."diarios_obra";
CREATE POLICY "rls_delete_org_policy" ON public."diarios_obra" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."diarios_obra";
CREATE POLICY "rls_insert_org_policy" ON public."diarios_obra" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."diarios_obra";
CREATE POLICY "rls_select_org_policy" ON public."diarios_obra" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."diarios_obra";
CREATE POLICY "rls_update_org_policy" ON public."diarios_obra" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "Escrita liberada para todos" ON public."sys_notification_templates" AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "Leitura de templates p todo o sistema" ON public."sys_notification_templates" AS PERMISSIVE FOR SELECT
  USING (true);

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "Permitir gestao pela propria organizacao" ON public."sys_notification_templates" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "Permitir leitura multi-tenant" ON public."sys_notification_templates" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "Superadmin update templates" ON public."sys_notification_templates" AS PERMISSIVE FOR ALL TO authenticated
  USING ((( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = 1));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "Templates publicos para leitura" ON public."sys_notification_templates" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = 1) OR (organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())))));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "rls_delete_org_policy" ON public."sys_notification_templates" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "rls_insert_org_policy" ON public."sys_notification_templates" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "rls_select_org_policy" ON public."sys_notification_templates" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.sys_notification_templates" does not exist
-- CREATE POLICY "rls_update_org_policy" ON public."sys_notification_templates" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."permissoes";
CREATE POLICY "rls_delete_org_policy" ON public."permissoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."permissoes";
CREATE POLICY "rls_insert_org_policy" ON public."permissoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."permissoes";
CREATE POLICY "rls_select_org_policy" ON public."permissoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."permissoes";
CREATE POLICY "rls_update_org_policy" ON public."permissoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Usuarios apagam seus proprios planejamentos" ON public."ai_planning_sessions";
CREATE POLICY "Usuarios apagam seus proprios planejamentos" ON public."ai_planning_sessions" AS PERMISSIVE FOR DELETE
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Usuarios atualizam seus proprios planejamentos" ON public."ai_planning_sessions";
CREATE POLICY "Usuarios atualizam seus proprios planejamentos" ON public."ai_planning_sessions" AS PERMISSIVE FOR UPDATE
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Usuarios criam seus proprios planejamentos" ON public."ai_planning_sessions";
CREATE POLICY "Usuarios criam seus proprios planejamentos" ON public."ai_planning_sessions" AS PERMISSIVE FOR INSERT
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Usuarios veem seus proprios planejamentos" ON public."ai_planning_sessions";
CREATE POLICY "Usuarios veem seus proprios planejamentos" ON public."ai_planning_sessions" AS PERMISSIVE FOR SELECT
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."ai_planning_sessions";
CREATE POLICY "rls_delete_org_policy" ON public."ai_planning_sessions" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."ai_planning_sessions";
CREATE POLICY "rls_insert_org_policy" ON public."ai_planning_sessions" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."ai_planning_sessions";
CREATE POLICY "rls_select_org_policy" ON public."ai_planning_sessions" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."ai_planning_sessions";
CREATE POLICY "rls_update_org_policy" ON public."ai_planning_sessions" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contrato_parcelas";
CREATE POLICY "rls_delete_org_policy" ON public."contrato_parcelas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contrato_parcelas";
CREATE POLICY "rls_insert_org_policy" ON public."contrato_parcelas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contrato_parcelas";
CREATE POLICY "rls_select_org_policy" ON public."contrato_parcelas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contrato_parcelas";
CREATE POLICY "rls_update_org_policy" ON public."contrato_parcelas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir criacao de KPI para usuarios da organizacao" ON public."kpis_personalizados";
CREATE POLICY "Permitir criacao de KPI para usuarios da organizacao" ON public."kpis_personalizados" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "Permitir exclusao de KPI para usuarios da organizacao" ON public."kpis_personalizados";
CREATE POLICY "Permitir exclusao de KPI para usuarios da organizacao" ON public."kpis_personalizados" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "Permitir visualizacao de KPI para usuarios da organizacao" ON public."kpis_personalizados";
CREATE POLICY "Permitir visualizacao de KPI para usuarios da organizacao" ON public."kpis_personalizados" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "Usuarios podem atualizar seus proprios KPIs" ON public."kpis_personalizados";
CREATE POLICY "Usuarios podem atualizar seus proprios KPIs" ON public."kpis_personalizados" AS PERMISSIVE FOR UPDATE
  USING ((auth.uid() = usuario_id))
  WITH CHECK ((auth.uid() = usuario_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."kpis_personalizados";
CREATE POLICY "rls_delete_org_policy" ON public."kpis_personalizados" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."kpis_personalizados";
CREATE POLICY "rls_insert_org_policy" ON public."kpis_personalizados" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."kpis_personalizados";
CREATE POLICY "rls_select_org_policy" ON public."kpis_personalizados" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."kpis_personalizados";
CREATE POLICY "rls_update_org_policy" ON public."kpis_personalizados" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Assinatura: Usuário pode registrar seu aceite" ON public."usuario_aceite_politicas";
CREATE POLICY "Assinatura: Usuário pode registrar seu aceite" ON public."usuario_aceite_politicas" AS PERMISSIVE FOR INSERT
  WITH CHECK ((auth.uid() = usuario_id));

DROP POLICY IF EXISTS "Auditoria: Superadmins leem todos os históricos" ON public."usuario_aceite_politicas";
CREATE POLICY "Auditoria: Superadmins leem todos os históricos" ON public."usuario_aceite_politicas" AS PERMISSIVE FOR SELECT
  USING (check_is_superadmin());

DROP POLICY IF EXISTS "Privacidade: Usuário lê apenas seus próprios aceites" ON public."usuario_aceite_politicas";
CREATE POLICY "Privacidade: Usuário lê apenas seus próprios aceites" ON public."usuario_aceite_politicas" AS PERMISSIVE FOR SELECT
  USING ((auth.uid() = usuario_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."usuario_aceite_politicas";
CREATE POLICY "rls_delete_org_policy" ON public."usuario_aceite_politicas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."usuario_aceite_politicas";
CREATE POLICY "rls_insert_org_policy" ON public."usuario_aceite_politicas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."usuario_aceite_politicas";
CREATE POLICY "rls_select_org_policy" ON public."usuario_aceite_politicas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."usuario_aceite_politicas";
CREATE POLICY "rls_update_org_policy" ON public."usuario_aceite_politicas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Allow users to manage models within their organization" ON public."modelos_contrato";
CREATE POLICY "Allow users to manage models within their organization" ON public."modelos_contrato" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))))
  WITH CHECK ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."modelos_contrato";
CREATE POLICY "rls_delete_org_policy" ON public."modelos_contrato" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."modelos_contrato";
CREATE POLICY "rls_insert_org_policy" ON public."modelos_contrato" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."modelos_contrato";
CREATE POLICY "rls_select_org_policy" ON public."modelos_contrato" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."modelos_contrato";
CREATE POLICY "rls_update_org_policy" ON public."modelos_contrato" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Liberar Geral Marcas Uploads" ON public."marcas_uploads";
CREATE POLICY "Liberar Geral Marcas Uploads" ON public."marcas_uploads" AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."marcas_uploads";
CREATE POLICY "rls_delete_org_policy" ON public."marcas_uploads" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."marcas_uploads";
CREATE POLICY "rls_insert_org_policy" ON public."marcas_uploads" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."marcas_uploads";
CREATE POLICY "rls_select_org_policy" ON public."marcas_uploads" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."marcas_uploads";
CREATE POLICY "rls_update_org_policy" ON public."marcas_uploads" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."bim_notas_elementos";
CREATE POLICY "rls_delete_org_policy" ON public."bim_notas_elementos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."bim_notas_elementos";
CREATE POLICY "rls_insert_org_policy" ON public."bim_notas_elementos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."bim_notas_elementos";
CREATE POLICY "rls_select_org_policy" ON public."bim_notas_elementos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."bim_notas_elementos";
CREATE POLICY "rls_update_org_policy" ON public."bim_notas_elementos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."activity_anexos";
CREATE POLICY "rls_delete_org_policy" ON public."activity_anexos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."activity_anexos";
CREATE POLICY "rls_insert_org_policy" ON public."activity_anexos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."activity_anexos";
CREATE POLICY "rls_select_org_policy" ON public."activity_anexos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."activity_anexos";
CREATE POLICY "rls_update_org_policy" ON public."activity_anexos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."abonos";
CREATE POLICY "Acesso restrito por organização" ON public."abonos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."abonos";
CREATE POLICY "rls_delete_org_policy" ON public."abonos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."abonos";
CREATE POLICY "rls_insert_org_policy" ON public."abonos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."abonos";
CREATE POLICY "rls_select_org_policy" ON public."abonos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."abonos";
CREATE POLICY "rls_update_org_policy" ON public."abonos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."configuracoes_venda";
CREATE POLICY "rls_delete_org_policy" ON public."configuracoes_venda" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."configuracoes_venda";
CREATE POLICY "rls_insert_org_policy" ON public."configuracoes_venda" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."configuracoes_venda";
CREATE POLICY "rls_select_org_policy" ON public."configuracoes_venda" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."configuracoes_venda";
CREATE POLICY "rls_update_org_policy" ON public."configuracoes_venda" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."jornada_detalhes";
CREATE POLICY "rls_delete_org_policy" ON public."jornada_detalhes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."jornada_detalhes";
CREATE POLICY "rls_insert_org_policy" ON public."jornada_detalhes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."jornada_detalhes";
CREATE POLICY "rls_select_org_policy" ON public."jornada_detalhes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."jornada_detalhes";
CREATE POLICY "rls_update_org_policy" ON public."jornada_detalhes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."produtos_empreendimento";
CREATE POLICY "Acesso restrito por organização" ON public."produtos_empreendimento" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."produtos_empreendimento";
CREATE POLICY "rls_delete_org_policy" ON public."produtos_empreendimento" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."produtos_empreendimento";
CREATE POLICY "rls_insert_org_policy" ON public."produtos_empreendimento" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."produtos_empreendimento";
CREATE POLICY "rls_select_org_policy" ON public."produtos_empreendimento" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."produtos_empreendimento";
CREATE POLICY "rls_update_org_policy" ON public."produtos_empreendimento" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."categorias_financeiras";
CREATE POLICY "Acesso restrito por organização" ON public."categorias_financeiras" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Permitir leitura para usuarios da organizacao" ON public."categorias_financeiras";
CREATE POLICY "Permitir leitura para usuarios da organizacao" ON public."categorias_financeiras" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."categorias_financeiras";
CREATE POLICY "rls_delete_org_policy" ON public."categorias_financeiras" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."categorias_financeiras";
CREATE POLICY "rls_insert_org_policy" ON public."categorias_financeiras" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."categorias_financeiras";
CREATE POLICY "rls_select_org_policy" ON public."categorias_financeiras" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."categorias_financeiras";
CREATE POLICY "rls_update_org_policy" ON public."categorias_financeiras" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Todos podem ver disciplinas" ON public."disciplinas_projetos";
CREATE POLICY "Todos podem ver disciplinas" ON public."disciplinas_projetos" AS PERMISSIVE FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."disciplinas_projetos";
CREATE POLICY "rls_delete_org_policy" ON public."disciplinas_projetos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."disciplinas_projetos";
CREATE POLICY "rls_insert_org_policy" ON public."disciplinas_projetos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."disciplinas_projetos";
CREATE POLICY "rls_select_org_policy" ON public."disciplinas_projetos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."disciplinas_projetos";
CREATE POLICY "rls_update_org_policy" ON public."disciplinas_projetos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."documento_tipos";
CREATE POLICY "Acesso restrito por organização" ON public."documento_tipos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Permitir acesso para a própria organização" ON public."documento_tipos";
CREATE POLICY "Permitir acesso para a própria organização" ON public."documento_tipos" AS PERMISSIVE FOR ALL
  USING ((( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."documento_tipos";
CREATE POLICY "rls_delete_org_policy" ON public."documento_tipos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."documento_tipos";
CREATE POLICY "rls_insert_org_policy" ON public."documento_tipos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."documento_tipos";
CREATE POLICY "rls_select_org_policy" ON public."documento_tipos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."documento_tipos";
CREATE POLICY "rls_update_org_policy" ON public."documento_tipos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."lancamentos_anexos";
CREATE POLICY "rls_delete_org_policy" ON public."lancamentos_anexos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."lancamentos_anexos";
CREATE POLICY "rls_insert_org_policy" ON public."lancamentos_anexos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."lancamentos_anexos";
CREATE POLICY "rls_select_org_policy" ON public."lancamentos_anexos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."lancamentos_anexos";
CREATE POLICY "rls_update_org_policy" ON public."lancamentos_anexos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."whatsapp_webhook_logs";
CREATE POLICY "rls_delete_org_policy" ON public."whatsapp_webhook_logs" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."whatsapp_webhook_logs";
CREATE POLICY "rls_insert_org_policy" ON public."whatsapp_webhook_logs" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."whatsapp_webhook_logs";
CREATE POLICY "rls_select_org_policy" ON public."whatsapp_webhook_logs" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."whatsapp_webhook_logs";
CREATE POLICY "rls_update_org_policy" ON public."whatsapp_webhook_logs" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."automacoes";
CREATE POLICY "rls_delete_org_policy" ON public."automacoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."automacoes";
CREATE POLICY "rls_insert_org_policy" ON public."automacoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."automacoes";
CREATE POLICY "rls_select_org_policy" ON public."automacoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."automacoes";
CREATE POLICY "rls_update_org_policy" ON public."automacoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."configuracoes_whatsapp";
CREATE POLICY "rls_delete_org_policy" ON public."configuracoes_whatsapp" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."configuracoes_whatsapp";
CREATE POLICY "rls_insert_org_policy" ON public."configuracoes_whatsapp" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."configuracoes_whatsapp";
CREATE POLICY "rls_select_org_policy" ON public."configuracoes_whatsapp" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."configuracoes_whatsapp";
CREATE POLICY "rls_update_org_policy" ON public."configuracoes_whatsapp" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."lancamentos";
CREATE POLICY "Acesso restrito por organização" ON public."lancamentos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Permitir criacao de lancamentos para usuarios da organizacao" ON public."lancamentos";
CREATE POLICY "Permitir criacao de lancamentos para usuarios da organizacao" ON public."lancamentos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "Permitir visualizacao de lancamentos para usuarios da organizac" ON public."lancamentos";
CREATE POLICY "Permitir visualizacao de lancamentos para usuarios da organizac" ON public."lancamentos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."lancamentos";
CREATE POLICY "rls_delete_org_policy" ON public."lancamentos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."lancamentos";
CREATE POLICY "rls_insert_org_policy" ON public."lancamentos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."lancamentos";
CREATE POLICY "rls_select_org_policy" ON public."lancamentos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."lancamentos";
CREATE POLICY "rls_update_org_policy" ON public."lancamentos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."contatos_no_funil";
CREATE POLICY "Acesso restrito por organização" ON public."contatos_no_funil" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contatos_no_funil";
CREATE POLICY "rls_delete_org_policy" ON public."contatos_no_funil" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contatos_no_funil";
CREATE POLICY "rls_insert_org_policy" ON public."contatos_no_funil" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contatos_no_funil";
CREATE POLICY "rls_select_org_policy" ON public."contatos_no_funil" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contatos_no_funil";
CREATE POLICY "rls_update_org_policy" ON public."contatos_no_funil" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.indices_governamentais" does not exist
-- CREATE POLICY "Apenas Org 1 deleta indices" ON public."indices_governamentais" AS PERMISSIVE FOR DELETE
  USING (((get_auth_user_org() = 1) AND (organizacao_id = 1)));

-- ERRO POLICY: relation "public.indices_governamentais" does not exist
-- CREATE POLICY "Apenas Org 1 edita indices" ON public."indices_governamentais" AS PERMISSIVE FOR UPDATE
  USING (((get_auth_user_org() = 1) AND (organizacao_id = 1)));

-- ERRO POLICY: relation "public.indices_governamentais" does not exist
-- CREATE POLICY "Apenas Org 1 insere indices" ON public."indices_governamentais" AS PERMISSIVE FOR INSERT
  WITH CHECK (((get_auth_user_org() = 1) AND (organizacao_id = 1)));

-- ERRO POLICY: relation "public.indices_governamentais" does not exist
-- CREATE POLICY "Usuarios podem ver indices" ON public."indices_governamentais" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = 1) OR (organizacao_id = get_auth_user_org())));

-- ERRO POLICY: relation "public.sys_chat_participants" does not exist
-- CREATE POLICY "Insercao de participantes" ON public."sys_chat_participants" AS PERMISSIVE FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM sys_chat_conversations c
  WHERE ((c.id = sys_chat_participants.conversation_id) AND (c.organizacao_id = get_auth_user_org())))));

-- ERRO POLICY: relation "public.sys_chat_participants" does not exist
-- CREATE POLICY "Leitura de participantes" ON public."sys_chat_participants" AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM sys_chat_conversations c
  WHERE ((c.id = sys_chat_participants.conversation_id) AND ((c.organizacao_id = get_auth_user_org()) OR (c.organizacao_id = 1))))));

DROP POLICY IF EXISTS "Usuários podem atualizar as associações da sua organização" ON public."contatos_no_funil_produtos";
CREATE POLICY "Usuários podem atualizar as associações da sua organização" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id = get_current_user_organizacao_id()));

DROP POLICY IF EXISTS "Usuários podem deletar as associações da sua organização" ON public."contatos_no_funil_produtos";
CREATE POLICY "Usuários podem deletar as associações da sua organização" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = get_current_user_organizacao_id()));

DROP POLICY IF EXISTS "Usuários podem inserir associações para sua organização" ON public."contatos_no_funil_produtos";
CREATE POLICY "Usuários podem inserir associações para sua organização" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = get_current_user_organizacao_id()));

DROP POLICY IF EXISTS "Usuários podem ver as associações da sua organização" ON public."contatos_no_funil_produtos";
CREATE POLICY "Usuários podem ver as associações da sua organização" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = get_current_user_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contatos_no_funil_produtos";
CREATE POLICY "rls_delete_org_policy" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contatos_no_funil_produtos";
CREATE POLICY "rls_insert_org_policy" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contatos_no_funil_produtos";
CREATE POLICY "rls_select_org_policy" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contatos_no_funil_produtos";
CREATE POLICY "rls_update_org_policy" ON public."contatos_no_funil_produtos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir atualização de permutas por organização" ON public."contrato_permutas";
CREATE POLICY "Permitir atualização de permutas por organização" ON public."contrato_permutas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permitir exclusão de permutas por organização" ON public."contrato_permutas";
CREATE POLICY "Permitir exclusão de permutas por organização" ON public."contrato_permutas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permitir inserção de permutas por organização" ON public."contrato_permutas";
CREATE POLICY "Permitir inserção de permutas por organização" ON public."contrato_permutas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permitir leitura de permutas por organização" ON public."contrato_permutas";
CREATE POLICY "Permitir leitura de permutas por organização" ON public."contrato_permutas" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contrato_permutas";
CREATE POLICY "rls_delete_org_policy" ON public."contrato_permutas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contrato_permutas";
CREATE POLICY "rls_insert_org_policy" ON public."contrato_permutas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contrato_permutas";
CREATE POLICY "rls_select_org_policy" ON public."contrato_permutas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contrato_permutas";
CREATE POLICY "rls_update_org_policy" ON public."contrato_permutas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."funis";
CREATE POLICY "Acesso restrito por organização" ON public."funis" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."funis";
CREATE POLICY "rls_delete_org_policy" ON public."funis" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."funis";
CREATE POLICY "rls_insert_org_policy" ON public."funis" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."funis";
CREATE POLICY "rls_select_org_policy" ON public."funis" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."funis";
CREATE POLICY "rls_update_org_policy" ON public."funis" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."colunas_funil";
CREATE POLICY "Acesso restrito por organização" ON public."colunas_funil" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."colunas_funil";
CREATE POLICY "rls_delete_org_policy" ON public."colunas_funil" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."colunas_funil";
CREATE POLICY "rls_insert_org_policy" ON public."colunas_funil" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."colunas_funil";
CREATE POLICY "rls_select_org_policy" ON public."colunas_funil" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."colunas_funil";
CREATE POLICY "rls_update_org_policy" ON public."colunas_funil" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_chat_broadcast_lists" does not exist
-- CREATE POLICY "Acesso completo as listas" ON public."sys_chat_broadcast_lists" AS PERMISSIVE FOR ALL
  USING ((((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)) AND (owner_id = auth.uid())));

-- ERRO POLICY: relation "public.sys_chat_messages" does not exist
-- CREATE POLICY "Insercao de mensagens" ON public."sys_chat_messages" AS PERMISSIVE FOR INSERT
  WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM sys_chat_participants p
  WHERE ((p.conversation_id = sys_chat_messages.conversation_id) AND (p.user_id = auth.uid()))))));

-- ERRO POLICY: relation "public.sys_chat_messages" does not exist
-- CREATE POLICY "Leitura de mensagens" ON public."sys_chat_messages" AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM sys_chat_participants p
  WHERE ((p.conversation_id = sys_chat_messages.conversation_id) AND (p.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Permite acesso apenas para a própria organização" ON public."conciliacao_historico";
CREATE POLICY "Permite acesso apenas para a própria organização" ON public."conciliacao_historico" AS PERMISSIVE FOR SELECT
  USING (((auth.jwt() ->> 'organizacao_id'::text) = (organizacao_id)::text));

DROP POLICY IF EXISTS "Permite inserção apenas para a própria organização" ON public."conciliacao_historico";
CREATE POLICY "Permite inserção apenas para a própria organização" ON public."conciliacao_historico" AS PERMISSIVE FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'organizacao_id'::text) = (organizacao_id)::text));

DROP POLICY IF EXISTS "Permitir inserção de histórico para membros da organização" ON public."conciliacao_historico";
CREATE POLICY "Permitir inserção de histórico para membros da organização" ON public."conciliacao_historico" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))) AND (usuario_id = auth.uid())));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."conciliacao_historico";
CREATE POLICY "rls_delete_org_policy" ON public."conciliacao_historico" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."conciliacao_historico";
CREATE POLICY "rls_insert_org_policy" ON public."conciliacao_historico" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."conciliacao_historico";
CREATE POLICY "rls_select_org_policy" ON public."conciliacao_historico" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."conciliacao_historico";
CREATE POLICY "rls_update_org_policy" ON public."conciliacao_historico" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Public Insert" ON public."app_logs";
CREATE POLICY "Public Insert" ON public."app_logs" AS PERMISSIVE FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public Select" ON public."app_logs";
CREATE POLICY "Public Select" ON public."app_logs" AS PERMISSIVE FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."app_logs";
CREATE POLICY "rls_delete_org_policy" ON public."app_logs" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."app_logs";
CREATE POLICY "rls_insert_org_policy" ON public."app_logs" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."app_logs";
CREATE POLICY "rls_select_org_policy" ON public."app_logs" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."app_logs";
CREATE POLICY "rls_update_org_policy" ON public."app_logs" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."chat_conversations";
CREATE POLICY "rls_delete_org_policy" ON public."chat_conversations" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."chat_conversations";
CREATE POLICY "rls_insert_org_policy" ON public."chat_conversations" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."chat_conversations";
CREATE POLICY "rls_select_org_policy" ON public."chat_conversations" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."chat_conversations";
CREATE POLICY "rls_update_org_policy" ON public."chat_conversations" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Usuarios gerenciam suas regras" ON public."email_regras";
CREATE POLICY "Usuarios gerenciam suas regras" ON public."email_regras" AS PERMISSIVE FOR ALL
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."email_regras";
CREATE POLICY "rls_delete_org_policy" ON public."email_regras" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."email_regras";
CREATE POLICY "rls_insert_org_policy" ON public."email_regras" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."email_regras";
CREATE POLICY "rls_select_org_policy" ON public."email_regras" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."email_regras";
CREATE POLICY "rls_update_org_policy" ON public."email_regras" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."meta_ads";
CREATE POLICY "rls_delete_org_policy" ON public."meta_ads" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."meta_ads";
CREATE POLICY "rls_insert_org_policy" ON public."meta_ads" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."meta_ads";
CREATE POLICY "rls_select_org_policy" ON public."meta_ads" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."meta_ads";
CREATE POLICY "rls_update_org_policy" ON public."meta_ads" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."meta_adsets";
CREATE POLICY "rls_delete_org_policy" ON public."meta_adsets" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."meta_adsets";
CREATE POLICY "rls_insert_org_policy" ON public."meta_adsets" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."meta_adsets";
CREATE POLICY "rls_select_org_policy" ON public."meta_adsets" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."meta_adsets";
CREATE POLICY "rls_update_org_policy" ON public."meta_adsets" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."configuracoes_ia";
CREATE POLICY "rls_delete_org_policy" ON public."configuracoes_ia" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."configuracoes_ia";
CREATE POLICY "rls_insert_org_policy" ON public."configuracoes_ia" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."configuracoes_ia";
CREATE POLICY "rls_select_org_policy" ON public."configuracoes_ia" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."configuracoes_ia";
CREATE POLICY "rls_update_org_policy" ON public."configuracoes_ia" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."crm_notas";
CREATE POLICY "rls_delete_org_policy" ON public."crm_notas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."crm_notas";
CREATE POLICY "rls_insert_org_policy" ON public."crm_notas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."crm_notas";
CREATE POLICY "rls_select_org_policy" ON public."crm_notas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."crm_notas";
CREATE POLICY "rls_update_org_policy" ON public."crm_notas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."empreendimento_documento_embeddings";
CREATE POLICY "rls_delete_org_policy" ON public."empreendimento_documento_embeddings" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."empreendimento_documento_embeddings";
CREATE POLICY "rls_insert_org_policy" ON public."empreendimento_documento_embeddings" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."empreendimento_documento_embeddings";
CREATE POLICY "rls_select_org_policy" ON public."empreendimento_documento_embeddings" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."empreendimento_documento_embeddings";
CREATE POLICY "rls_update_org_policy" ON public."empreendimento_documento_embeddings" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."abono_tipos";
CREATE POLICY "Acesso restrito por organização" ON public."abono_tipos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."abono_tipos";
CREATE POLICY "rls_delete_org_policy" ON public."abono_tipos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."abono_tipos";
CREATE POLICY "rls_insert_org_policy" ON public."abono_tipos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."abono_tipos";
CREATE POLICY "rls_select_org_policy" ON public."abono_tipos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."abono_tipos";
CREATE POLICY "rls_update_org_policy" ON public."abono_tipos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."contratos";
CREATE POLICY "Acesso restrito por organização" ON public."contratos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Corretores podem atualizar seus proprios contratos" ON public."contratos";
CREATE POLICY "Corretores podem atualizar seus proprios contratos" ON public."contratos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "Corretores podem criar novos contratos" ON public."contratos";
CREATE POLICY "Corretores podem criar novos contratos" ON public."contratos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "Corretores podem deletar seus proprios contratos" ON public."contratos";
CREATE POLICY "Corretores podem deletar seus proprios contratos" ON public."contratos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "Corretores podem ver apenas seus proprios contratos" ON public."contratos";
CREATE POLICY "Corretores podem ver apenas seus proprios contratos" ON public."contratos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contratos";
CREATE POLICY "rls_delete_org_policy" ON public."contratos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contratos";
CREATE POLICY "rls_insert_org_policy" ON public."contratos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contratos";
CREATE POLICY "rls_select_org_policy" ON public."contratos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contratos";
CREATE POLICY "rls_update_org_policy" ON public."contratos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."feriados";
CREATE POLICY "Acesso restrito por organização" ON public."feriados" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."feriados";
CREATE POLICY "rls_delete_org_policy" ON public."feriados" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."feriados";
CREATE POLICY "rls_insert_org_policy" ON public."feriados" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."feriados";
CREATE POLICY "rls_select_org_policy" ON public."feriados" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."feriados";
CREATE POLICY "rls_update_org_policy" ON public."feriados" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir leitura do histórico para usuários da mesma organiza" ON public."historico_movimentacao_funil";
CREATE POLICY "Permitir leitura do histórico para usuários da mesma organiza" ON public."historico_movimentacao_funil" AS PERMISSIVE FOR SELECT
  USING (((auth.uid() IS NOT NULL) AND (organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."historico_movimentacao_funil";
CREATE POLICY "rls_delete_org_policy" ON public."historico_movimentacao_funil" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."historico_movimentacao_funil";
CREATE POLICY "rls_insert_org_policy" ON public."historico_movimentacao_funil" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."historico_movimentacao_funil";
CREATE POLICY "rls_select_org_policy" ON public."historico_movimentacao_funil" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."historico_movimentacao_funil";
CREATE POLICY "rls_update_org_policy" ON public."historico_movimentacao_funil" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."contatos";
CREATE POLICY "Acesso restrito por organização" ON public."contatos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Allow authenticated users to manage their organization contacts" ON public."contatos";
CREATE POLICY "Allow authenticated users to manage their organization contacts" ON public."contatos" AS PERMISSIVE FOR ALL TO authenticated
  USING ((organizacao_id = get_my_organization_id()))
  WITH CHECK ((organizacao_id = get_my_organization_id()));

DROP POLICY IF EXISTS "Allow authenticated users to read their organization contacts" ON public."contatos";
CREATE POLICY "Allow authenticated users to read their organization contacts" ON public."contatos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = get_my_organization_id()));

DROP POLICY IF EXISTS "Corretores externos podem inserir contatos" ON public."contatos";
CREATE POLICY "Corretores externos podem inserir contatos" ON public."contatos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((get_user_funcao_id() = 20));

DROP POLICY IF EXISTS "Corretores externos veem apenas contatos criados por eles" ON public."contatos";
CREATE POLICY "Corretores externos veem apenas contatos criados por eles" ON public."contatos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((get_user_funcao_id() = 20) AND (criado_por_usuario_id = auth.uid())) OR (get_user_funcao_id() <> 20)));

DROP POLICY IF EXISTS "Corretores podem atualizar seus proprios contatos" ON public."contatos";
CREATE POLICY "Corretores podem atualizar seus proprios contatos" ON public."contatos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "Corretores podem criar novos contatos" ON public."contatos";
CREATE POLICY "Corretores podem criar novos contatos" ON public."contatos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "Corretores podem deletar seus proprios contatos" ON public."contatos";
CREATE POLICY "Corretores podem deletar seus proprios contatos" ON public."contatos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "Corretores podem ver apenas seus proprios contatos" ON public."contatos";
CREATE POLICY "Corretores podem ver apenas seus proprios contatos" ON public."contatos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = criado_por_usuario_id));

DROP POLICY IF EXISTS "Permitir leitura para usuarios da organizacao" ON public."contatos";
CREATE POLICY "Permitir leitura para usuarios da organizacao" ON public."contatos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "Politica_Criar_Contatos_Org" ON public."contatos";
CREATE POLICY "Politica_Criar_Contatos_Org" ON public."contatos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Politica_Editar_Contatos_Org" ON public."contatos";
CREATE POLICY "Politica_Editar_Contatos_Org" ON public."contatos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Politica_Excluir_Contatos_Org" ON public."contatos";
CREATE POLICY "Politica_Excluir_Contatos_Org" ON public."contatos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Politica_Ver_Contatos_Org" ON public."contatos";
CREATE POLICY "Politica_Ver_Contatos_Org" ON public."contatos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contatos";
CREATE POLICY "rls_delete_org_policy" ON public."contatos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contatos";
CREATE POLICY "rls_insert_org_policy" ON public."contatos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contatos";
CREATE POLICY "rls_select_org_policy" ON public."contatos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contatos";
CREATE POLICY "rls_update_org_policy" ON public."contatos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."pedidos_compra";
CREATE POLICY "Acesso restrito por organização" ON public."pedidos_compra" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."pedidos_compra";
CREATE POLICY "rls_delete_org_policy" ON public."pedidos_compra" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."pedidos_compra";
CREATE POLICY "rls_insert_org_policy" ON public."pedidos_compra" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."pedidos_compra";
CREATE POLICY "rls_select_org_policy" ON public."pedidos_compra" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."pedidos_compra";
CREATE POLICY "rls_update_org_policy" ON public."pedidos_compra" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."vales_agendados";
CREATE POLICY "rls_delete_org_policy" ON public."vales_agendados" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."vales_agendados";
CREATE POLICY "rls_insert_org_policy" ON public."vales_agendados" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."vales_agendados";
CREATE POLICY "rls_select_org_policy" ON public."vales_agendados" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."vales_agendados";
CREATE POLICY "rls_update_org_policy" ON public."vales_agendados" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."activities";
CREATE POLICY "Acesso restrito por organização" ON public."activities" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."activities";
CREATE POLICY "rls_delete_org_policy" ON public."activities" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."activities";
CREATE POLICY "rls_insert_org_policy" ON public."activities" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."activities";
CREATE POLICY "rls_select_org_policy" ON public."activities" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."activities";
CREATE POLICY "rls_update_org_policy" ON public."activities" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."contracheques";
CREATE POLICY "Acesso restrito por organização" ON public."contracheques" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contracheques";
CREATE POLICY "rls_delete_org_policy" ON public."contracheques" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contracheques";
CREATE POLICY "rls_insert_org_policy" ON public."contracheques" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contracheques";
CREATE POLICY "rls_select_org_policy" ON public."contracheques" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contracheques";
CREATE POLICY "rls_update_org_policy" ON public."contracheques" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.instagram_messages" does not exist
-- CREATE POLICY "instagram_messages_delete" ON public."instagram_messages" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.instagram_messages" does not exist
-- CREATE POLICY "instagram_messages_insert" ON public."instagram_messages" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.instagram_messages" does not exist
-- CREATE POLICY "instagram_messages_select" ON public."instagram_messages" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.instagram_messages" does not exist
-- CREATE POLICY "instagram_messages_update" ON public."instagram_messages" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso total apenas para a própria organização" ON public."cadastro_empresa";
CREATE POLICY "Acesso total apenas para a própria organização" ON public."cadastro_empresa" AS PERMISSIVE FOR ALL
  USING ((get_current_user_organizacao_id() = organizacao_id))
  WITH CHECK ((get_current_user_organizacao_id() = organizacao_id));

DROP POLICY IF EXISTS "Permitir leitura para usuarios da organizacao" ON public."cadastro_empresa";
CREATE POLICY "Permitir leitura para usuarios da organizacao" ON public."cadastro_empresa" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."cadastro_empresa";
CREATE POLICY "rls_delete_org_policy" ON public."cadastro_empresa" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."cadastro_empresa";
CREATE POLICY "rls_insert_org_policy" ON public."cadastro_empresa" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."cadastro_empresa";
CREATE POLICY "rls_select_org_policy" ON public."cadastro_empresa" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."cadastro_empresa";
CREATE POLICY "rls_update_org_policy" ON public."cadastro_empresa" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permite Tudo Arquivos OFX" ON public."banco_arquivos_ofx";
CREATE POLICY "Permite Tudo Arquivos OFX" ON public."banco_arquivos_ofx" AS PERMISSIVE FOR ALL
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."banco_arquivos_ofx";
CREATE POLICY "rls_delete_org_policy" ON public."banco_arquivos_ofx" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."banco_arquivos_ofx";
CREATE POLICY "rls_insert_org_policy" ON public."banco_arquivos_ofx" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."banco_arquivos_ofx";
CREATE POLICY "rls_select_org_policy" ON public."banco_arquivos_ofx" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."banco_arquivos_ofx";
CREATE POLICY "rls_update_org_policy" ON public."banco_arquivos_ofx" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permite Tudo Transacoes OFX" ON public."banco_transacoes_ofx";
CREATE POLICY "Permite Tudo Transacoes OFX" ON public."banco_transacoes_ofx" AS PERMISSIVE FOR ALL
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."banco_transacoes_ofx";
CREATE POLICY "rls_delete_org_policy" ON public."banco_transacoes_ofx" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."banco_transacoes_ofx";
CREATE POLICY "rls_insert_org_policy" ON public."banco_transacoes_ofx" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."banco_transacoes_ofx";
CREATE POLICY "rls_select_org_policy" ON public."banco_transacoes_ofx" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."banco_transacoes_ofx";
CREATE POLICY "rls_update_org_policy" ON public."banco_transacoes_ofx" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."historico_salarial";
CREATE POLICY "Acesso restrito por organização" ON public."historico_salarial" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."historico_salarial";
CREATE POLICY "rls_delete_org_policy" ON public."historico_salarial" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."historico_salarial";
CREATE POLICY "rls_insert_org_policy" ON public."historico_salarial" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."historico_salarial";
CREATE POLICY "rls_select_org_policy" ON public."historico_salarial" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."historico_salarial";
CREATE POLICY "rls_update_org_policy" ON public."historico_salarial" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."banco_de_horas";
CREATE POLICY "Acesso restrito por organização" ON public."banco_de_horas" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."banco_de_horas";
CREATE POLICY "rls_delete_org_policy" ON public."banco_de_horas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."banco_de_horas";
CREATE POLICY "rls_insert_org_policy" ON public."banco_de_horas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."banco_de_horas";
CREATE POLICY "rls_select_org_policy" ON public."banco_de_horas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."banco_de_horas";
CREATE POLICY "rls_update_org_policy" ON public."banco_de_horas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."contas_financeiras";
CREATE POLICY "Acesso restrito por organização" ON public."contas_financeiras" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Permitir leitura para usuarios da organizacao" ON public."contas_financeiras";
CREATE POLICY "Permitir leitura para usuarios da organizacao" ON public."contas_financeiras" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contas_financeiras";
CREATE POLICY "rls_delete_org_policy" ON public."contas_financeiras" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contas_financeiras";
CREATE POLICY "rls_insert_org_policy" ON public."contas_financeiras" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contas_financeiras";
CREATE POLICY "rls_select_org_policy" ON public."contas_financeiras" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contas_financeiras";
CREATE POLICY "rls_update_org_policy" ON public."contas_financeiras" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Usuarios gerenciam sua propria config de email" ON public."email_configuracoes";
CREATE POLICY "Usuarios gerenciam sua propria config de email" ON public."email_configuracoes" AS PERMISSIVE FOR ALL
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."email_configuracoes";
CREATE POLICY "rls_delete_org_policy" ON public."email_configuracoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."email_configuracoes";
CREATE POLICY "rls_insert_org_policy" ON public."email_configuracoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."email_configuracoes";
CREATE POLICY "rls_select_org_policy" ON public."email_configuracoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."email_configuracoes";
CREATE POLICY "rls_update_org_policy" ON public."email_configuracoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir CRIAÇÃO para a própria organização" ON public."empresa_anexos";
CREATE POLICY "Permitir CRIAÇÃO para a própria organização" ON public."empresa_anexos" AS PERMISSIVE FOR INSERT
  WITH CHECK ((( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id));

DROP POLICY IF EXISTS "Permitir LEITURA para a própria organização" ON public."empresa_anexos";
CREATE POLICY "Permitir LEITURA para a própria organização" ON public."empresa_anexos" AS PERMISSIVE FOR SELECT
  USING ((( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."empresa_anexos";
CREATE POLICY "rls_delete_org_policy" ON public."empresa_anexos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."empresa_anexos";
CREATE POLICY "rls_insert_org_policy" ON public."empresa_anexos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."empresa_anexos";
CREATE POLICY "rls_select_org_policy" ON public."empresa_anexos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."empresa_anexos";
CREATE POLICY "rls_update_org_policy" ON public."empresa_anexos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."estoque";
CREATE POLICY "Acesso restrito por organização" ON public."estoque" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."estoque";
CREATE POLICY "rls_delete_org_policy" ON public."estoque" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."estoque";
CREATE POLICY "rls_insert_org_policy" ON public."estoque" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."estoque";
CREATE POLICY "rls_select_org_policy" ON public."estoque" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."estoque";
CREATE POLICY "rls_update_org_policy" ON public."estoque" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."telefones_backup_faxina";
CREATE POLICY "rls_delete_org_policy" ON public."telefones_backup_faxina" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."telefones_backup_faxina";
CREATE POLICY "rls_insert_org_policy" ON public."telefones_backup_faxina" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."telefones_backup_faxina";
CREATE POLICY "rls_select_org_policy" ON public."telefones_backup_faxina" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."telefones_backup_faxina";
CREATE POLICY "rls_update_org_policy" ON public."telefones_backup_faxina" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Leitura liberada para todos" ON public."tabelas_sistema";
CREATE POLICY "Leitura liberada para todos" ON public."tabelas_sistema" AS PERMISSIVE FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."tabelas_sistema";
CREATE POLICY "rls_delete_org_policy" ON public."tabelas_sistema" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."tabelas_sistema";
CREATE POLICY "rls_insert_org_policy" ON public."tabelas_sistema" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."tabelas_sistema";
CREATE POLICY "rls_select_org_policy" ON public."tabelas_sistema" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."tabelas_sistema";
CREATE POLICY "rls_update_org_policy" ON public."tabelas_sistema" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Usuarios atualizam elementos da sua organizacao" ON public."elementos_bim";
CREATE POLICY "Usuarios atualizam elementos da sua organizacao" ON public."elementos_bim" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Usuarios deletam elementos da sua organizacao" ON public."elementos_bim";
CREATE POLICY "Usuarios deletam elementos da sua organizacao" ON public."elementos_bim" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Usuarios inserem elementos na sua organizacao" ON public."elementos_bim";
CREATE POLICY "Usuarios inserem elementos na sua organizacao" ON public."elementos_bim" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Usuarios veem elementos da sua organizacao" ON public."elementos_bim";
CREATE POLICY "Usuarios veem elementos da sua organizacao" ON public."elementos_bim" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."elementos_bim";
CREATE POLICY "rls_delete_org_policy" ON public."elementos_bim" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."elementos_bim";
CREATE POLICY "rls_insert_org_policy" ON public."elementos_bim" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."elementos_bim";
CREATE POLICY "rls_select_org_policy" ON public."elementos_bim" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."elementos_bim";
CREATE POLICY "rls_update_org_policy" ON public."elementos_bim" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir INSERT se organizacao_id bater com a do usuário (via " ON public."movimentacoes_estoque";
CREATE POLICY "Permitir INSERT se organizacao_id bater com a do usuário (via " ON public."movimentacoes_estoque" AS PERMISSIVE FOR INSERT
  WITH CHECK (((auth.role() = 'authenticated'::text) AND (organizacao_id = get_my_organization_id())));

DROP POLICY IF EXISTS "Permitir criar movimentacoes na propria organizacao" ON public."movimentacoes_estoque";
CREATE POLICY "Permitir criar movimentacoes na propria organizacao" ON public."movimentacoes_estoque" AS PERMISSIVE FOR INSERT
  WITH CHECK ((auth.uid() IN ( SELECT usuarios.id
   FROM usuarios
  WHERE (usuarios.organizacao_id = movimentacoes_estoque.organizacao_id))));

DROP POLICY IF EXISTS "Permitir leitura de movimentacoes da propria organizacao" ON public."movimentacoes_estoque";
CREATE POLICY "Permitir leitura de movimentacoes da propria organizacao" ON public."movimentacoes_estoque" AS PERMISSIVE FOR SELECT
  USING ((auth.uid() IN ( SELECT usuarios.id
   FROM usuarios
  WHERE (usuarios.organizacao_id = movimentacoes_estoque.organizacao_id))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."movimentacoes_estoque";
CREATE POLICY "rls_delete_org_policy" ON public."movimentacoes_estoque" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."movimentacoes_estoque";
CREATE POLICY "rls_insert_org_policy" ON public."movimentacoes_estoque" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."movimentacoes_estoque";
CREATE POLICY "rls_select_org_policy" ON public."movimentacoes_estoque" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."movimentacoes_estoque";
CREATE POLICY "rls_update_org_policy" ON public."movimentacoes_estoque" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Ver agendamentos da org" ON public."whatsapp_scheduled_broadcasts";
CREATE POLICY "Ver agendamentos da org" ON public."whatsapp_scheduled_broadcasts" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."whatsapp_scheduled_broadcasts";
CREATE POLICY "rls_delete_org_policy" ON public."whatsapp_scheduled_broadcasts" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."whatsapp_scheduled_broadcasts";
CREATE POLICY "rls_insert_org_policy" ON public."whatsapp_scheduled_broadcasts" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."whatsapp_scheduled_broadcasts";
CREATE POLICY "rls_select_org_policy" ON public."whatsapp_scheduled_broadcasts" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."whatsapp_scheduled_broadcasts";
CREATE POLICY "rls_update_org_policy" ON public."whatsapp_scheduled_broadcasts" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir acesso total se a organizacao do usuario for a mesma" ON public."contrato_produtos";
CREATE POLICY "Permitir acesso total se a organizacao do usuario for a mesma" ON public."contrato_produtos" AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM usuarios
  WHERE ((usuarios.id = auth.uid()) AND (usuarios.organizacao_id = contrato_produtos.organizacao_id)))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contrato_produtos";
CREATE POLICY "rls_delete_org_policy" ON public."contrato_produtos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contrato_produtos";
CREATE POLICY "rls_insert_org_policy" ON public."contrato_produtos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contrato_produtos";
CREATE POLICY "rls_select_org_policy" ON public."contrato_produtos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contrato_produtos";
CREATE POLICY "rls_update_org_policy" ON public."contrato_produtos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Allow insert for same organization" ON public."meta_ads_historico";
CREATE POLICY "Allow insert for same organization" ON public."meta_ads_historico" AS PERMISSIVE FOR INSERT
  WITH CHECK (((auth.uid() IS NOT NULL) AND (organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())))));

DROP POLICY IF EXISTS "Allow read access to same organization" ON public."meta_ads_historico";
CREATE POLICY "Allow read access to same organization" ON public."meta_ads_historico" AS PERMISSIVE FOR SELECT
  USING (((auth.uid() IS NOT NULL) AND (organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."meta_ads_historico";
CREATE POLICY "rls_delete_org_policy" ON public."meta_ads_historico" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."meta_ads_historico";
CREATE POLICY "rls_insert_org_policy" ON public."meta_ads_historico" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."meta_ads_historico";
CREATE POLICY "rls_select_org_policy" ON public."meta_ads_historico" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."meta_ads_historico";
CREATE POLICY "rls_update_org_policy" ON public."meta_ads_historico" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Allow authenticated users to manage their organization messages" ON public."whatsapp_messages";
CREATE POLICY "Allow authenticated users to manage their organization messages" ON public."whatsapp_messages" AS PERMISSIVE FOR ALL TO authenticated
  USING ((organizacao_id = get_my_organization_id()))
  WITH CHECK ((organizacao_id = get_my_organization_id()));

DROP POLICY IF EXISTS "Allow authenticated users to read their organization messages" ON public."whatsapp_messages";
CREATE POLICY "Allow authenticated users to read their organization messages" ON public."whatsapp_messages" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = get_my_organization_id()));

DROP POLICY IF EXISTS "Enable read access for organization members" ON public."whatsapp_messages";
CREATE POLICY "Enable read access for organization members" ON public."whatsapp_messages" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."whatsapp_messages";
CREATE POLICY "rls_delete_org_policy" ON public."whatsapp_messages" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."whatsapp_messages";
CREATE POLICY "rls_insert_org_policy" ON public."whatsapp_messages" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."whatsapp_messages";
CREATE POLICY "rls_select_org_policy" ON public."whatsapp_messages" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."whatsapp_messages";
CREATE POLICY "rls_update_org_policy" ON public."whatsapp_messages" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."whatsapp_conversations";
CREATE POLICY "rls_delete_org_policy" ON public."whatsapp_conversations" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."whatsapp_conversations";
CREATE POLICY "rls_insert_org_policy" ON public."whatsapp_conversations" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."whatsapp_conversations";
CREATE POLICY "rls_select_org_policy" ON public."whatsapp_conversations" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."whatsapp_conversations";
CREATE POLICY "rls_update_org_policy" ON public."whatsapp_conversations" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."atividades_elementos";
CREATE POLICY "rls_delete_org_policy" ON public."atividades_elementos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."atividades_elementos";
CREATE POLICY "rls_insert_org_policy" ON public."atividades_elementos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."atividades_elementos";
CREATE POLICY "rls_select_org_policy" ON public."atividades_elementos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."atividades_elementos";
CREATE POLICY "rls_update_org_policy" ON public."atividades_elementos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."debug_notificacoes";
CREATE POLICY "rls_delete_org_policy" ON public."debug_notificacoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."debug_notificacoes";
CREATE POLICY "rls_insert_org_policy" ON public."debug_notificacoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."debug_notificacoes";
CREATE POLICY "rls_select_org_policy" ON public."debug_notificacoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."debug_notificacoes";
CREATE POLICY "rls_update_org_policy" ON public."debug_notificacoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir criar notas" ON public."bim_notas";
CREATE POLICY "Permitir criar notas" ON public."bim_notas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir editar notas" ON public."bim_notas";
CREATE POLICY "Permitir editar notas" ON public."bim_notas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir leitura geral" ON public."bim_notas";
CREATE POLICY "Permitir leitura geral" ON public."bim_notas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."bim_notas";
CREATE POLICY "rls_delete_org_policy" ON public."bim_notas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."bim_notas";
CREATE POLICY "rls_insert_org_policy" ON public."bim_notas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."bim_notas";
CREATE POLICY "rls_select_org_policy" ON public."bim_notas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."bim_notas";
CREATE POLICY "rls_update_org_policy" ON public."bim_notas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_chat_mural_posts" does not exist
-- CREATE POLICY "Acesso as postagens do mural" ON public."sys_chat_mural_posts" AS PERMISSIVE FOR ALL
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "Criar comentarios" ON public."bim_notas_comentarios";
CREATE POLICY "Criar comentarios" ON public."bim_notas_comentarios" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Ver comentarios" ON public."bim_notas_comentarios";
CREATE POLICY "Ver comentarios" ON public."bim_notas_comentarios" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."bim_notas_comentarios";
CREATE POLICY "rls_delete_org_policy" ON public."bim_notas_comentarios" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."bim_notas_comentarios";
CREATE POLICY "rls_insert_org_policy" ON public."bim_notas_comentarios" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."bim_notas_comentarios";
CREATE POLICY "rls_select_org_policy" ON public."bim_notas_comentarios" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."bim_notas_comentarios";
CREATE POLICY "rls_update_org_policy" ON public."bim_notas_comentarios" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_chat_mural_comments" does not exist
-- CREATE POLICY "Acesso aos comentarios do mural" ON public."sys_chat_mural_comments" AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM sys_chat_mural_posts p
  WHERE ((p.id = sys_chat_mural_comments.post_id) AND ((p.organizacao_id = get_auth_user_org()) OR (p.organizacao_id = 1))))));

-- ERRO POLICY: relation "public.sys_chat_mural_likes" does not exist
-- CREATE POLICY "Acesso aos likes do mural" ON public."sys_chat_mural_likes" AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM sys_chat_mural_posts p
  WHERE ((p.id = sys_chat_mural_likes.post_id) AND ((p.organizacao_id = get_auth_user_org()) OR (p.organizacao_id = 1))))));

-- ERRO POLICY: relation "public.instagram_conversations" does not exist
-- CREATE POLICY "instagram_conversations_delete" ON public."instagram_conversations" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.instagram_conversations" does not exist
-- CREATE POLICY "instagram_conversations_insert" ON public."instagram_conversations" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.instagram_conversations" does not exist
-- CREATE POLICY "instagram_conversations_select" ON public."instagram_conversations" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.instagram_conversations" does not exist
-- CREATE POLICY "instagram_conversations_update" ON public."instagram_conversations" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Backend cria notificacoes" ON public."notificacoes";
CREATE POLICY "Backend cria notificacoes" ON public."notificacoes" AS PERMISSIVE FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios veem proprias notificacoes" ON public."notificacoes";
CREATE POLICY "Usuarios veem proprias notificacoes" ON public."notificacoes" AS PERMISSIVE FOR SELECT
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Usuários atualizam suas proprias notificacoes" ON public."notificacoes";
CREATE POLICY "Usuários atualizam suas proprias notificacoes" ON public."notificacoes" AS PERMISSIVE FOR UPDATE
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Usuários veem suas proprias notificacoes" ON public."notificacoes";
CREATE POLICY "Usuários veem suas proprias notificacoes" ON public."notificacoes" AS PERMISSIVE FOR SELECT
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."notificacoes";
CREATE POLICY "rls_delete_org_policy" ON public."notificacoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."notificacoes";
CREATE POLICY "rls_insert_org_policy" ON public."notificacoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."notificacoes";
CREATE POLICY "rls_select_org_policy" ON public."notificacoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."notificacoes";
CREATE POLICY "rls_update_org_policy" ON public."notificacoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."cargos";
CREATE POLICY "rls_delete_org_policy" ON public."cargos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."cargos";
CREATE POLICY "rls_insert_org_policy" ON public."cargos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."cargos";
CREATE POLICY "rls_select_org_policy" ON public."cargos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."cargos";
CREATE POLICY "rls_update_org_policy" ON public."cargos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."termos_aceite";
CREATE POLICY "rls_delete_org_policy" ON public."termos_aceite" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."termos_aceite";
CREATE POLICY "rls_insert_org_policy" ON public."termos_aceite" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."termos_aceite";
CREATE POLICY "rls_select_org_policy" ON public."termos_aceite" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."termos_aceite";
CREATE POLICY "rls_update_org_policy" ON public."termos_aceite" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Leitura pública de termos ativos" ON public."termos_uso";
CREATE POLICY "Leitura pública de termos ativos" ON public."termos_uso" AS PERMISSIVE FOR SELECT
  USING ((ativo = true));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."termos_uso";
CREATE POLICY "rls_delete_org_policy" ON public."termos_uso" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."termos_uso";
CREATE POLICY "rls_insert_org_policy" ON public."termos_uso" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."termos_uso";
CREATE POLICY "rls_select_org_policy" ON public."termos_uso" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."termos_uso";
CREATE POLICY "rls_update_org_policy" ON public."termos_uso" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Gerenciar minhas mensagens" ON public."email_messages_cache";
CREATE POLICY "Gerenciar minhas mensagens" ON public."email_messages_cache" AS PERMISSIVE FOR ALL
  USING ((account_id IN ( SELECT email_configuracoes.id
   FROM email_configuracoes
  WHERE (email_configuracoes.user_id = auth.uid()))))
  WITH CHECK ((account_id IN ( SELECT email_configuracoes.id
   FROM email_configuracoes
  WHERE (email_configuracoes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Usuários podem inserir/atualizar suas proprias mensagens" ON public."email_messages_cache";
CREATE POLICY "Usuários podem inserir/atualizar suas proprias mensagens" ON public."email_messages_cache" AS PERMISSIVE FOR ALL
  USING ((account_id IN ( SELECT email_configuracoes.id
   FROM email_configuracoes
  WHERE (email_configuracoes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Usuários podem ver suas proprias mensagens" ON public."email_messages_cache";
CREATE POLICY "Usuários podem ver suas proprias mensagens" ON public."email_messages_cache" AS PERMISSIVE FOR SELECT
  USING ((account_id IN ( SELECT email_configuracoes.id
   FROM email_configuracoes
  WHERE (email_configuracoes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."email_messages_cache";
CREATE POLICY "rls_delete_org_policy" ON public."email_messages_cache" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."email_messages_cache";
CREATE POLICY "rls_insert_org_policy" ON public."email_messages_cache" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."email_messages_cache";
CREATE POLICY "rls_select_org_policy" ON public."email_messages_cache" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."email_messages_cache";
CREATE POLICY "rls_update_org_policy" ON public."email_messages_cache" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."parcelas_adicionais";
CREATE POLICY "rls_delete_org_policy" ON public."parcelas_adicionais" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."parcelas_adicionais";
CREATE POLICY "rls_insert_org_policy" ON public."parcelas_adicionais" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."parcelas_adicionais";
CREATE POLICY "rls_select_org_policy" ON public."parcelas_adicionais" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."parcelas_adicionais";
CREATE POLICY "rls_update_org_policy" ON public."parcelas_adicionais" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_org_notification_settings" does not exist
-- CREATE POLICY "Orgs alteram suas rotas" ON public."sys_org_notification_settings" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

-- ERRO POLICY: relation "public.sys_org_notification_settings" does not exist
-- CREATE POLICY "Orgs criam suas rotas" ON public."sys_org_notification_settings" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

-- ERRO POLICY: relation "public.sys_org_notification_settings" does not exist
-- CREATE POLICY "Orgs excluem suas rotas" ON public."sys_org_notification_settings" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

-- ERRO POLICY: relation "public.sys_org_notification_settings" does not exist
-- CREATE POLICY "Orgs leem suas rotas" ON public."sys_org_notification_settings" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.sys_org_notification_settings" does not exist
-- CREATE POLICY "Permitir gestao da propria originazacao" ON public."sys_org_notification_settings" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."auditoria_ia_logs";
CREATE POLICY "rls_delete_org_policy" ON public."auditoria_ia_logs" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."auditoria_ia_logs";
CREATE POLICY "rls_insert_org_policy" ON public."auditoria_ia_logs" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."auditoria_ia_logs";
CREATE POLICY "rls_select_org_policy" ON public."auditoria_ia_logs" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."auditoria_ia_logs";
CREATE POLICY "rls_update_org_policy" ON public."auditoria_ia_logs" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Leitura liberada para todos" ON public."campos_sistema";
CREATE POLICY "Leitura liberada para todos" ON public."campos_sistema" AS PERMISSIVE FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Leitura pública de campos sistema" ON public."campos_sistema";
CREATE POLICY "Leitura pública de campos sistema" ON public."campos_sistema" AS PERMISSIVE FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."campos_sistema";
CREATE POLICY "rls_delete_org_policy" ON public."campos_sistema" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."campos_sistema";
CREATE POLICY "rls_insert_org_policy" ON public."campos_sistema" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."campos_sistema";
CREATE POLICY "rls_select_org_policy" ON public."campos_sistema" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."campos_sistema";
CREATE POLICY "rls_update_org_policy" ON public."campos_sistema" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."orcamento_itens";
CREATE POLICY "Acesso restrito por organização" ON public."orcamento_itens" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."orcamento_itens";
CREATE POLICY "rls_delete_org_policy" ON public."orcamento_itens" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."orcamento_itens";
CREATE POLICY "rls_insert_org_policy" ON public."orcamento_itens" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."orcamento_itens";
CREATE POLICY "rls_select_org_policy" ON public."orcamento_itens" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."orcamento_itens";
CREATE POLICY "rls_update_org_policy" ON public."orcamento_itens" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."feedback";
CREATE POLICY "Acesso restrito por organização" ON public."feedback" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."feedback";
CREATE POLICY "rls_delete_org_policy" ON public."feedback" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."feedback";
CREATE POLICY "rls_insert_org_policy" ON public."feedback" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."feedback";
CREATE POLICY "rls_select_org_policy" ON public."feedback" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."feedback";
CREATE POLICY "rls_update_org_policy" ON public."feedback" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."jornadas";
CREATE POLICY "Acesso restrito por organização" ON public."jornadas" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."jornadas";
CREATE POLICY "rls_delete_org_policy" ON public."jornadas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."jornadas";
CREATE POLICY "rls_insert_org_policy" ON public."jornadas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."jornadas";
CREATE POLICY "rls_select_org_policy" ON public."jornadas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."jornadas";
CREATE POLICY "rls_update_org_policy" ON public."jornadas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."materiais";
CREATE POLICY "Acesso restrito por organização" ON public."materiais" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."materiais";
CREATE POLICY "rls_delete_org_policy" ON public."materiais" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."materiais";
CREATE POLICY "rls_insert_org_policy" ON public."materiais" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."materiais";
CREATE POLICY "rls_select_org_policy" ON public."materiais" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."materiais";
CREATE POLICY "rls_update_org_policy" ON public."materiais" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permite DELETE para usuários da mesma organização" ON public."contrato_anexos";
CREATE POLICY "Permite DELETE para usuários da mesma organização" ON public."contrato_anexos" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permite INSERT para usuários da mesma organização" ON public."contrato_anexos";
CREATE POLICY "Permite INSERT para usuários da mesma organização" ON public."contrato_anexos" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permite SELECT para usuários da mesma organização" ON public."contrato_anexos";
CREATE POLICY "Permite SELECT para usuários da mesma organização" ON public."contrato_anexos" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contrato_anexos";
CREATE POLICY "rls_delete_org_policy" ON public."contrato_anexos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contrato_anexos";
CREATE POLICY "rls_insert_org_policy" ON public."contrato_anexos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contrato_anexos";
CREATE POLICY "rls_select_org_policy" ON public."contrato_anexos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contrato_anexos";
CREATE POLICY "rls_update_org_policy" ON public."contrato_anexos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."documentos_funcionarios";
CREATE POLICY "Acesso restrito por organização" ON public."documentos_funcionarios" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Permite DELETE para usuários da mesma organização" ON public."documentos_funcionarios";
CREATE POLICY "Permite DELETE para usuários da mesma organização" ON public."documentos_funcionarios" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permite INSERT para usuários da mesma organização" ON public."documentos_funcionarios";
CREATE POLICY "Permite INSERT para usuários da mesma organização" ON public."documentos_funcionarios" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permite SELECT para usuários da mesma organização" ON public."documentos_funcionarios";
CREATE POLICY "Permite SELECT para usuários da mesma organização" ON public."documentos_funcionarios" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."documentos_funcionarios";
CREATE POLICY "rls_delete_org_policy" ON public."documentos_funcionarios" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."documentos_funcionarios";
CREATE POLICY "rls_insert_org_policy" ON public."documentos_funcionarios" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."documentos_funcionarios";
CREATE POLICY "rls_select_org_policy" ON public."documentos_funcionarios" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."documentos_funcionarios";
CREATE POLICY "rls_update_org_policy" ON public."documentos_funcionarios" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Emails_Delete_Org" ON public."emails";
CREATE POLICY "Emails_Delete_Org" ON public."emails" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Emails_Insert_Org" ON public."emails";
CREATE POLICY "Emails_Insert_Org" ON public."emails" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Emails_Select_Org" ON public."emails";
CREATE POLICY "Emails_Select_Org" ON public."emails" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Emails_Update_Org" ON public."emails";
CREATE POLICY "Emails_Update_Org" ON public."emails" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Permite acesso de leitura para a propria organizacao" ON public."emails";
CREATE POLICY "Permite acesso de leitura para a propria organizacao" ON public."emails" AS PERMISSIVE FOR SELECT
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite atualizacao para a propria organizacao" ON public."emails";
CREATE POLICY "Permite atualizacao para a propria organizacao" ON public."emails" AS PERMISSIVE FOR UPDATE
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite delecao para a propria organizacao" ON public."emails";
CREATE POLICY "Permite delecao para a propria organizacao" ON public."emails" AS PERMISSIVE FOR DELETE
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite insercao para a propria organizacao" ON public."emails";
CREATE POLICY "Permite insercao para a propria organizacao" ON public."emails" AS PERMISSIVE FOR INSERT
  WITH CHECK (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."emails";
CREATE POLICY "rls_delete_org_policy" ON public."emails" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."emails";
CREATE POLICY "rls_insert_org_policy" ON public."emails" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."emails";
CREATE POLICY "rls_select_org_policy" ON public."emails" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."emails";
CREATE POLICY "rls_update_org_policy" ON public."emails" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permite DELETE para usuários da mesma organização" ON public."empreendimento_anexos";
CREATE POLICY "Permite DELETE para usuários da mesma organização" ON public."empreendimento_anexos" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = get_organizacao_do_usuario_atual()));

DROP POLICY IF EXISTS "Permite INSERT para usuários da mesma organização" ON public."empreendimento_anexos";
CREATE POLICY "Permite INSERT para usuários da mesma organização" ON public."empreendimento_anexos" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = get_organizacao_do_usuario_atual()));

DROP POLICY IF EXISTS "Permite SELECT para usuários da mesma organização" ON public."empreendimento_anexos";
CREATE POLICY "Permite SELECT para usuários da mesma organização" ON public."empreendimento_anexos" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = get_organizacao_do_usuario_atual()));

DROP POLICY IF EXISTS "Permite UPDATE para usuários da mesma organização" ON public."empreendimento_anexos";
CREATE POLICY "Permite UPDATE para usuários da mesma organização" ON public."empreendimento_anexos" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id = get_organizacao_do_usuario_atual()))
  WITH CHECK ((organizacao_id = get_organizacao_do_usuario_atual()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."empreendimento_anexos";
CREATE POLICY "rls_delete_org_policy" ON public."empreendimento_anexos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."empreendimento_anexos";
CREATE POLICY "rls_insert_org_policy" ON public."empreendimento_anexos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."empreendimento_anexos";
CREATE POLICY "rls_select_org_policy" ON public."empreendimento_anexos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."empreendimento_anexos";
CREATE POLICY "rls_update_org_policy" ON public."empreendimento_anexos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."empreendimentos";
CREATE POLICY "Acesso restrito por organização" ON public."empreendimentos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Permitir leitura para usuarios da organizacao" ON public."empreendimentos";
CREATE POLICY "Permitir leitura para usuarios da organizacao" ON public."empreendimentos" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = ( SELECT u.organizacao_id
   FROM usuarios u
  WHERE (u.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."empreendimentos";
CREATE POLICY "rls_delete_org_policy" ON public."empreendimentos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."empreendimentos";
CREATE POLICY "rls_insert_org_policy" ON public."empreendimentos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."empreendimentos";
CREATE POLICY "rls_select_org_policy" ON public."empreendimentos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."empreendimentos";
CREATE POLICY "rls_update_org_policy" ON public."empreendimentos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "faturas_cartao_insert_policy" ON public."faturas_cartao";
CREATE POLICY "faturas_cartao_insert_policy" ON public."faturas_cartao" AS PERMISSIVE FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "faturas_cartao_select_policy" ON public."faturas_cartao";
CREATE POLICY "faturas_cartao_select_policy" ON public."faturas_cartao" AS PERMISSIVE FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "faturas_cartao_update_policy" ON public."faturas_cartao";
CREATE POLICY "faturas_cartao_update_policy" ON public."faturas_cartao" AS PERMISSIVE FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."faturas_cartao";
CREATE POLICY "rls_delete_org_policy" ON public."faturas_cartao" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."faturas_cartao";
CREATE POLICY "rls_insert_org_policy" ON public."faturas_cartao" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."faturas_cartao";
CREATE POLICY "rls_select_org_policy" ON public."faturas_cartao" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."faturas_cartao";
CREATE POLICY "rls_update_org_policy" ON public."faturas_cartao" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."meta_campaigns";
CREATE POLICY "rls_delete_org_policy" ON public."meta_campaigns" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."meta_campaigns";
CREATE POLICY "rls_insert_org_policy" ON public."meta_campaigns" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."meta_campaigns";
CREATE POLICY "rls_select_org_policy" ON public."meta_campaigns" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."meta_campaigns";
CREATE POLICY "rls_update_org_policy" ON public."meta_campaigns" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Gerenciar minhas inscrições" ON public."notification_subscriptions";
CREATE POLICY "Gerenciar minhas inscrições" ON public."notification_subscriptions" AS PERMISSIVE FOR ALL
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Permite que usuários autenticados insiram suas próprias inscr" ON public."notification_subscriptions";
CREATE POLICY "Permite que usuários autenticados insiram suas próprias inscr" ON public."notification_subscriptions" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Permite que usuários leiam suas próprias inscrições" ON public."notification_subscriptions";
CREATE POLICY "Permite que usuários leiam suas próprias inscrições" ON public."notification_subscriptions" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Permitir Delete Próprio" ON public."notification_subscriptions";
CREATE POLICY "Permitir Delete Próprio" ON public."notification_subscriptions" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Permitir Insert Autenticado" ON public."notification_subscriptions";
CREATE POLICY "Permitir Insert Autenticado" ON public."notification_subscriptions" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Permitir Select Próprio" ON public."notification_subscriptions";
CREATE POLICY "Permitir Select Próprio" ON public."notification_subscriptions" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Permitir Update Autenticado" ON public."notification_subscriptions";
CREATE POLICY "Permitir Update Autenticado" ON public."notification_subscriptions" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Service Role Total" ON public."notification_subscriptions";
CREATE POLICY "Service Role Total" ON public."notification_subscriptions" AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role pode fazer tudo" ON public."notification_subscriptions";
CREATE POLICY "Service Role pode fazer tudo" ON public."notification_subscriptions" AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias inscrições" ON public."notification_subscriptions";
CREATE POLICY "Usuários gerenciam suas próprias inscrições" ON public."notification_subscriptions" AS PERMISSIVE FOR ALL
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Usuários podem salvar suas inscrições" ON public."notification_subscriptions";
CREATE POLICY "Usuários podem salvar suas inscrições" ON public."notification_subscriptions" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Usuários podem ver suas inscrições" ON public."notification_subscriptions";
CREATE POLICY "Usuários podem ver suas inscrições" ON public."notification_subscriptions" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."notification_subscriptions";
CREATE POLICY "rls_delete_org_policy" ON public."notification_subscriptions" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."notification_subscriptions";
CREATE POLICY "rls_insert_org_policy" ON public."notification_subscriptions" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."notification_subscriptions";
CREATE POLICY "rls_select_org_policy" ON public."notification_subscriptions" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."notification_subscriptions";
CREATE POLICY "rls_update_org_policy" ON public."notification_subscriptions" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."orcamentos";
CREATE POLICY "Acesso restrito por organização" ON public."orcamentos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."orcamentos";
CREATE POLICY "rls_delete_org_policy" ON public."orcamentos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."orcamentos";
CREATE POLICY "rls_insert_org_policy" ON public."orcamentos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."orcamentos";
CREATE POLICY "rls_select_org_policy" ON public."orcamentos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."orcamentos";
CREATE POLICY "rls_update_org_policy" ON public."orcamentos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permite acesso de leitura para a propria organizacao" ON public."pedidos_compra_anexos";
CREATE POLICY "Permite acesso de leitura para a propria organizacao" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR SELECT
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite atualizacao para a propria organizacao" ON public."pedidos_compra_anexos";
CREATE POLICY "Permite atualizacao para a propria organizacao" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR UPDATE
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite delecao para a propria organizacao" ON public."pedidos_compra_anexos";
CREATE POLICY "Permite delecao para a propria organizacao" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR DELETE
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite insercao para a propria organizacao" ON public."pedidos_compra_anexos";
CREATE POLICY "Permite insercao para a propria organizacao" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR INSERT
  WITH CHECK (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."pedidos_compra_anexos";
CREATE POLICY "rls_delete_org_policy" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."pedidos_compra_anexos";
CREATE POLICY "rls_insert_org_policy" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."pedidos_compra_anexos";
CREATE POLICY "rls_select_org_policy" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."pedidos_compra_anexos";
CREATE POLICY "rls_update_org_policy" ON public."pedidos_compra_anexos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."pedidos_compra_itens";
CREATE POLICY "rls_delete_org_policy" ON public."pedidos_compra_itens" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."pedidos_compra_itens";
CREATE POLICY "rls_insert_org_policy" ON public."pedidos_compra_itens" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."pedidos_compra_itens";
CREATE POLICY "rls_select_org_policy" ON public."pedidos_compra_itens" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."pedidos_compra_itens";
CREATE POLICY "rls_update_org_policy" ON public."pedidos_compra_itens" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."pedidos_compra_status_historico_legacy";
CREATE POLICY "rls_delete_org_policy" ON public."pedidos_compra_status_historico_legacy" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."pedidos_compra_status_historico_legacy";
CREATE POLICY "rls_insert_org_policy" ON public."pedidos_compra_status_historico_legacy" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."pedidos_compra_status_historico_legacy";
CREATE POLICY "rls_select_org_policy" ON public."pedidos_compra_status_historico_legacy" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."pedidos_compra_status_historico_legacy";
CREATE POLICY "rls_update_org_policy" ON public."pedidos_compra_status_historico_legacy" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."pontos";
CREATE POLICY "Acesso restrito por organização" ON public."pontos" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."pontos";
CREATE POLICY "rls_delete_org_policy" ON public."pontos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."pontos";
CREATE POLICY "rls_insert_org_policy" ON public."pontos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."pontos";
CREATE POLICY "rls_select_org_policy" ON public."pontos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."pontos";
CREATE POLICY "rls_update_org_policy" ON public."pontos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Apenas Org 1 pode editar índices" ON public."indices_financeiros";
CREATE POLICY "Apenas Org 1 pode editar índices" ON public."indices_financeiros" AS PERMISSIVE FOR UPDATE
  USING (((get_auth_user_org() = 1) AND (organizacao_id = 1)));

DROP POLICY IF EXISTS "Apenas Org 1 pode excluir índices" ON public."indices_financeiros";
CREATE POLICY "Apenas Org 1 pode excluir índices" ON public."indices_financeiros" AS PERMISSIVE FOR DELETE
  USING (((get_auth_user_org() = 1) AND (organizacao_id = 1)));

DROP POLICY IF EXISTS "Apenas Org 1 pode inserir índices" ON public."indices_financeiros";
CREATE POLICY "Apenas Org 1 pode inserir índices" ON public."indices_financeiros" AS PERMISSIVE FOR INSERT
  WITH CHECK (((get_auth_user_org() = 1) AND (organizacao_id = 1)));

DROP POLICY IF EXISTS "Usuários podem ver índices globais" ON public."indices_financeiros";
CREATE POLICY "Usuários podem ver índices globais" ON public."indices_financeiros" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = 1) OR (organizacao_id = get_auth_user_org())));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."indices_financeiros";
CREATE POLICY "rls_delete_org_policy" ON public."indices_financeiros" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."indices_financeiros";
CREATE POLICY "rls_insert_org_policy" ON public."indices_financeiros" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."indices_financeiros";
CREATE POLICY "rls_select_org_policy" ON public."indices_financeiros" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."indices_financeiros";
CREATE POLICY "rls_update_org_policy" ON public."indices_financeiros" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."meta_form_config";
CREATE POLICY "rls_delete_org_policy" ON public."meta_form_config" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."meta_form_config";
CREATE POLICY "rls_insert_org_policy" ON public."meta_form_config" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."meta_form_config";
CREATE POLICY "rls_select_org_policy" ON public."meta_form_config" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."meta_form_config";
CREATE POLICY "rls_update_org_policy" ON public."meta_form_config" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."meta_forms_catalog";
CREATE POLICY "rls_delete_org_policy" ON public."meta_forms_catalog" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."meta_forms_catalog";
CREATE POLICY "rls_insert_org_policy" ON public."meta_forms_catalog" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."meta_forms_catalog";
CREATE POLICY "rls_select_org_policy" ON public."meta_forms_catalog" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."meta_forms_catalog";
CREATE POLICY "rls_update_org_policy" ON public."meta_forms_catalog" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Autenticados podem inserir projetos BIM" ON public."projetos_bim";
CREATE POLICY "Autenticados podem inserir projetos BIM" ON public."projetos_bim" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Autenticados podem ver projetos BIM" ON public."projetos_bim";
CREATE POLICY "Autenticados podem ver projetos BIM" ON public."projetos_bim" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir atualização geral" ON public."projetos_bim";
CREATE POLICY "Permitir atualização geral" ON public."projetos_bim" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir criação geral" ON public."projetos_bim";
CREATE POLICY "Permitir criação geral" ON public."projetos_bim" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura geral" ON public."projetos_bim";
CREATE POLICY "Permitir leitura geral" ON public."projetos_bim" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar status" ON public."projetos_bim";
CREATE POLICY "Usuários podem atualizar status" ON public."projetos_bim" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."projetos_bim";
CREATE POLICY "rls_delete_org_policy" ON public."projetos_bim" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."projetos_bim";
CREATE POLICY "rls_insert_org_policy" ON public."projetos_bim" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."projetos_bim";
CREATE POLICY "rls_select_org_policy" ON public."projetos_bim" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."projetos_bim";
CREATE POLICY "rls_update_org_policy" ON public."projetos_bim" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."chat_messages";
CREATE POLICY "rls_delete_org_policy" ON public."chat_messages" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."chat_messages";
CREATE POLICY "rls_insert_org_policy" ON public."chat_messages" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."chat_messages";
CREATE POLICY "rls_select_org_policy" ON public."chat_messages" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."chat_messages";
CREATE POLICY "rls_update_org_policy" ON public."chat_messages" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Leitura liberada para todos" ON public."variaveis_virtuais";
CREATE POLICY "Leitura liberada para todos" ON public."variaveis_virtuais" AS PERMISSIVE FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."variaveis_virtuais";
CREATE POLICY "rls_delete_org_policy" ON public."variaveis_virtuais" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."variaveis_virtuais";
CREATE POLICY "rls_insert_org_policy" ON public."variaveis_virtuais" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."variaveis_virtuais";
CREATE POLICY "rls_select_org_policy" ON public."variaveis_virtuais" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."variaveis_virtuais";
CREATE POLICY "rls_update_org_policy" ON public."variaveis_virtuais" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."rdo_fotos_uploads";
CREATE POLICY "rls_delete_org_policy" ON public."rdo_fotos_uploads" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."rdo_fotos_uploads";
CREATE POLICY "rls_insert_org_policy" ON public."rdo_fotos_uploads" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."rdo_fotos_uploads";
CREATE POLICY "rls_select_org_policy" ON public."rdo_fotos_uploads" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."rdo_fotos_uploads";
CREATE POLICY "rls_update_org_policy" ON public."rdo_fotos_uploads" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.regras_roteamento_funil" does not exist
-- CREATE POLICY "org_acesso_propria_regra" ON public."regras_roteamento_funil" AS PERMISSIVE FOR ALL
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

-- ERRO POLICY: relation "public.regras_roteamento_funil" does not exist
-- CREATE POLICY "rls_delete_org_policy" ON public."regras_roteamento_funil" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.regras_roteamento_funil" does not exist
-- CREATE POLICY "rls_insert_org_policy" ON public."regras_roteamento_funil" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.regras_roteamento_funil" does not exist
-- CREATE POLICY "rls_select_org_policy" ON public."regras_roteamento_funil" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.regras_roteamento_funil" does not exist
-- CREATE POLICY "rls_update_org_policy" ON public."regras_roteamento_funil" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."simulacoes";
CREATE POLICY "Acesso restrito por organização" ON public."simulacoes" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."simulacoes";
CREATE POLICY "rls_delete_org_policy" ON public."simulacoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."simulacoes";
CREATE POLICY "rls_insert_org_policy" ON public."simulacoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."simulacoes";
CREATE POLICY "rls_select_org_policy" ON public."simulacoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."simulacoes";
CREATE POLICY "rls_update_org_policy" ON public."simulacoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."sinapi";
CREATE POLICY "rls_delete_org_policy" ON public."sinapi" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."sinapi";
CREATE POLICY "rls_insert_org_policy" ON public."sinapi" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."sinapi";
CREATE POLICY "rls_select_org_policy" ON public."sinapi" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."sinapi";
CREATE POLICY "rls_update_org_policy" ON public."sinapi" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."subetapas";
CREATE POLICY "Acesso restrito por organização" ON public."subetapas" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."subetapas";
CREATE POLICY "rls_delete_org_policy" ON public."subetapas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."subetapas";
CREATE POLICY "rls_insert_org_policy" ON public."subetapas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."subetapas";
CREATE POLICY "rls_select_org_policy" ON public."subetapas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."subetapas";
CREATE POLICY "rls_update_org_policy" ON public."subetapas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Allow authenticated users to manage their organization phone nu" ON public."telefones";
CREATE POLICY "Allow authenticated users to manage their organization phone nu" ON public."telefones" AS PERMISSIVE FOR ALL TO authenticated
  USING ((organizacao_id = get_my_organization_id()))
  WITH CHECK ((organizacao_id = get_my_organization_id()));

DROP POLICY IF EXISTS "Allow authenticated users to read their organization phone numb" ON public."telefones";
CREATE POLICY "Allow authenticated users to read their organization phone numb" ON public."telefones" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id = get_my_organization_id()));

DROP POLICY IF EXISTS "Permite acesso de leitura para a propria organizacao" ON public."telefones";
CREATE POLICY "Permite acesso de leitura para a propria organizacao" ON public."telefones" AS PERMISSIVE FOR SELECT
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite atualizacao para a propria organizacao" ON public."telefones";
CREATE POLICY "Permite atualizacao para a propria organizacao" ON public."telefones" AS PERMISSIVE FOR UPDATE
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite delecao para a propria organizacao" ON public."telefones";
CREATE POLICY "Permite delecao para a propria organizacao" ON public."telefones" AS PERMISSIVE FOR DELETE
  USING (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Permite insercao para a propria organizacao" ON public."telefones";
CREATE POLICY "Permite insercao para a propria organizacao" ON public."telefones" AS PERMISSIVE FOR INSERT
  WITH CHECK (((auth.uid() IS NOT NULL) AND (( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid())) = organizacao_id)));

DROP POLICY IF EXISTS "Telefones_Delete_Org" ON public."telefones";
CREATE POLICY "Telefones_Delete_Org" ON public."telefones" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Telefones_Insert_Org" ON public."telefones";
CREATE POLICY "Telefones_Insert_Org" ON public."telefones" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Telefones_Select_Org" ON public."telefones";
CREATE POLICY "Telefones_Select_Org" ON public."telefones" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Telefones_Update_Org" ON public."telefones";
CREATE POLICY "Telefones_Update_Org" ON public."telefones" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Usuários podem atualizar telefones da sua própria organizaç" ON public."telefones";
CREATE POLICY "Usuários podem atualizar telefones da sua própria organizaç" ON public."telefones" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'organizacao_id'::text))::bigint));

DROP POLICY IF EXISTS "Usuários podem inserir telefones na sua própria organização" ON public."telefones";
CREATE POLICY "Usuários podem inserir telefones na sua própria organização" ON public."telefones" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'organizacao_id'::text))::bigint));

DROP POLICY IF EXISTS "Usuários podem ver telefones da sua própria organização" ON public."telefones";
CREATE POLICY "Usuários podem ver telefones da sua própria organização" ON public."telefones" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'organizacao_id'::text))::bigint));

DROP POLICY IF EXISTS "Usuários могут deletar telefones da sua própria organiza" ON public."telefones";
CREATE POLICY "Usuários могут deletar telefones da sua própria organiza" ON public."telefones" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'organizacao_id'::text))::bigint));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."telefones";
CREATE POLICY "rls_delete_org_policy" ON public."telefones" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."telefones";
CREATE POLICY "rls_insert_org_policy" ON public."telefones" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."telefones";
CREATE POLICY "rls_select_org_policy" ON public."telefones" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."telefones";
CREATE POLICY "rls_update_org_policy" ON public."telefones" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.bim_mapeamentos_propriedades" does not exist
-- CREATE POLICY "bim_map_delete" ON public."bim_mapeamentos_propriedades" AS PERMISSIVE FOR DELETE
  USING ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.bim_mapeamentos_propriedades" does not exist
-- CREATE POLICY "bim_map_insert" ON public."bim_mapeamentos_propriedades" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.bim_mapeamentos_propriedades" does not exist
-- CREATE POLICY "bim_map_select" ON public."bim_mapeamentos_propriedades" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.bim_mapeamentos_propriedades" does not exist
-- CREATE POLICY "bim_map_update" ON public."bim_mapeamentos_propriedades" AS PERMISSIVE FOR UPDATE
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Permitir gestão de políticas para superadmins" ON public."politicas_plataforma";
CREATE POLICY "Permitir gestão de políticas para superadmins" ON public."politicas_plataforma" AS PERMISSIVE FOR ALL
  USING (check_is_superadmin());

DROP POLICY IF EXISTS "Permitir leitura de políticas ativas para todos" ON public."politicas_plataforma";
CREATE POLICY "Permitir leitura de políticas ativas para todos" ON public."politicas_plataforma" AS PERMISSIVE FOR SELECT
  USING ((is_active = true));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."bim_vistas_federadas";
CREATE POLICY "rls_delete_org_policy" ON public."bim_vistas_federadas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."bim_vistas_federadas";
CREATE POLICY "rls_insert_org_policy" ON public."bim_vistas_federadas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."bim_vistas_federadas";
CREATE POLICY "rls_select_org_policy" ON public."bim_vistas_federadas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."bim_vistas_federadas";
CREATE POLICY "rls_update_org_policy" ON public."bim_vistas_federadas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso total para autenticados" ON public."pedidos_compra_historico_fases";
CREATE POLICY "Acesso total para autenticados" ON public."pedidos_compra_historico_fases" AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."pedidos_compra_historico_fases";
CREATE POLICY "rls_delete_org_policy" ON public."pedidos_compra_historico_fases" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."pedidos_compra_historico_fases";
CREATE POLICY "rls_insert_org_policy" ON public."pedidos_compra_historico_fases" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."pedidos_compra_historico_fases";
CREATE POLICY "rls_select_org_policy" ON public."pedidos_compra_historico_fases" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."pedidos_compra_historico_fases";
CREATE POLICY "rls_update_org_policy" ON public."pedidos_compra_historico_fases" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso total para autenticados" ON public."pedidos_fases";
CREATE POLICY "Acesso total para autenticados" ON public."pedidos_fases" AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."pedidos_fases";
CREATE POLICY "rls_delete_org_policy" ON public."pedidos_fases" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."pedidos_fases";
CREATE POLICY "rls_insert_org_policy" ON public."pedidos_fases" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."pedidos_fases";
CREATE POLICY "rls_select_org_policy" ON public."pedidos_fases" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."pedidos_fases";
CREATE POLICY "rls_update_org_policy" ON public."pedidos_fases" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Acesso restrito por organização" ON public."usuarios";
CREATE POLICY "Acesso restrito por organização" ON public."usuarios" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = get_organizacao_id()))
  WITH CHECK ((organizacao_id = get_organizacao_id()));

DROP POLICY IF EXISTS "Permitir usuário atualizar seu próprio aceite" ON public."usuarios";
CREATE POLICY "Permitir usuário atualizar seu próprio aceite" ON public."usuarios" AS PERMISSIVE FOR UPDATE
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "Superadmins podem ler todos os usuarios" ON public."usuarios";
CREATE POLICY "Superadmins podem ler todos os usuarios" ON public."usuarios" AS PERMISSIVE FOR SELECT
  USING (check_is_superadmin());

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."usuarios";
CREATE POLICY "rls_delete_org_policy" ON public."usuarios" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."usuarios";
CREATE POLICY "rls_insert_org_policy" ON public."usuarios" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."usuarios";
CREATE POLICY "rls_select_org_policy" ON public."usuarios" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."usuarios";
CREATE POLICY "rls_update_org_policy" ON public."usuarios" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Criar listas na organização" ON public."whatsapp_broadcast_lists";
CREATE POLICY "Criar listas na organização" ON public."whatsapp_broadcast_lists" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Editar/Excluir listas da organização" ON public."whatsapp_broadcast_lists";
CREATE POLICY "Editar/Excluir listas da organização" ON public."whatsapp_broadcast_lists" AS PERMISSIVE FOR ALL
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Ver listas da organização" ON public."whatsapp_broadcast_lists";
CREATE POLICY "Ver listas da organização" ON public."whatsapp_broadcast_lists" AS PERMISSIVE FOR SELECT
  USING ((organizacao_id = ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."whatsapp_broadcast_lists";
CREATE POLICY "rls_delete_org_policy" ON public."whatsapp_broadcast_lists" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."whatsapp_broadcast_lists";
CREATE POLICY "rls_insert_org_policy" ON public."whatsapp_broadcast_lists" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."whatsapp_broadcast_lists";
CREATE POLICY "rls_select_org_policy" ON public."whatsapp_broadcast_lists" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."whatsapp_broadcast_lists";
CREATE POLICY "rls_update_org_policy" ON public."whatsapp_broadcast_lists" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Gerenciar membros" ON public."whatsapp_list_members";
CREATE POLICY "Gerenciar membros" ON public."whatsapp_list_members" AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM whatsapp_broadcast_lists l
  WHERE ((l.id = whatsapp_list_members.lista_id) AND (l.organizacao_id = ( SELECT usuarios.organizacao_id
           FROM usuarios
          WHERE (usuarios.id = auth.uid())))))));

DROP POLICY IF EXISTS "Ver membros de listas da organização" ON public."whatsapp_list_members";
CREATE POLICY "Ver membros de listas da organização" ON public."whatsapp_list_members" AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM whatsapp_broadcast_lists l
  WHERE ((l.id = whatsapp_list_members.lista_id) AND (l.organizacao_id = ( SELECT usuarios.organizacao_id
           FROM usuarios
          WHERE (usuarios.id = auth.uid())))))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."whatsapp_list_members";
CREATE POLICY "rls_delete_org_policy" ON public."whatsapp_list_members" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."whatsapp_list_members";
CREATE POLICY "rls_insert_org_policy" ON public."whatsapp_list_members" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."whatsapp_list_members";
CREATE POLICY "rls_select_org_policy" ON public."whatsapp_list_members" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."whatsapp_list_members";
CREATE POLICY "rls_update_org_policy" ON public."whatsapp_list_members" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Empresa gerencia sua própria integração Meta" ON public."integracoes_meta";
CREATE POLICY "Empresa gerencia sua própria integração Meta" ON public."integracoes_meta" AS PERMISSIVE FOR ALL
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Empresa vê sua própria integração Meta" ON public."integracoes_meta";
CREATE POLICY "Empresa vê sua própria integração Meta" ON public."integracoes_meta" AS PERMISSIVE FOR ALL
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."integracoes_meta";
CREATE POLICY "rls_delete_org_policy" ON public."integracoes_meta" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."integracoes_meta";
CREATE POLICY "rls_insert_org_policy" ON public."integracoes_meta" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."integracoes_meta";
CREATE POLICY "rls_select_org_policy" ON public."integracoes_meta" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."integracoes_meta";
CREATE POLICY "rls_update_org_policy" ON public."integracoes_meta" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contratos_terceirizados";
CREATE POLICY "rls_delete_org_policy" ON public."contratos_terceirizados" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contratos_terceirizados";
CREATE POLICY "rls_insert_org_policy" ON public."contratos_terceirizados" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contratos_terceirizados";
CREATE POLICY "rls_select_org_policy" ON public."contratos_terceirizados" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contratos_terceirizados";
CREATE POLICY "rls_update_org_policy" ON public."contratos_terceirizados" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."contratos_terceirizados_anexos";
CREATE POLICY "rls_delete_org_policy" ON public."contratos_terceirizados_anexos" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."contratos_terceirizados_anexos";
CREATE POLICY "rls_insert_org_policy" ON public."contratos_terceirizados_anexos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."contratos_terceirizados_anexos";
CREATE POLICY "rls_select_org_policy" ON public."contratos_terceirizados_anexos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."contratos_terceirizados_anexos";
CREATE POLICY "rls_update_org_policy" ON public."contratos_terceirizados_anexos" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Empresa gerencia sua própria integração Google" ON public."integracoes_google";
CREATE POLICY "Empresa gerencia sua própria integração Google" ON public."integracoes_google" AS PERMISSIVE FOR ALL
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "Empresa vê sua própria integração Google" ON public."integracoes_google";
CREATE POLICY "Empresa vê sua própria integração Google" ON public."integracoes_google" AS PERMISSIVE FOR ALL
  USING ((organizacao_id IN ( SELECT usuarios.organizacao_id
   FROM usuarios
  WHERE (usuarios.id = auth.uid()))));

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."integracoes_google";
CREATE POLICY "rls_delete_org_policy" ON public."integracoes_google" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."integracoes_google";
CREATE POLICY "rls_insert_org_policy" ON public."integracoes_google" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."integracoes_google";
CREATE POLICY "rls_select_org_policy" ON public."integracoes_google" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."integracoes_google";
CREATE POLICY "rls_update_org_policy" ON public."integracoes_google" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "Apenas admin vê as visitas" ON public."monitor_visitas";
CREATE POLICY "Apenas admin vê as visitas" ON public."monitor_visitas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Qualquer um pode registrar visita" ON public."monitor_visitas";
CREATE POLICY "Qualquer um pode registrar visita" ON public."monitor_visitas" AS PERMISSIVE FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "rls_delete_org_policy" ON public."monitor_visitas";
CREATE POLICY "rls_delete_org_policy" ON public."monitor_visitas" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_insert_org_policy" ON public."monitor_visitas";
CREATE POLICY "rls_insert_org_policy" ON public."monitor_visitas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((organizacao_id = get_auth_user_org()));

DROP POLICY IF EXISTS "rls_select_org_policy" ON public."monitor_visitas";
CREATE POLICY "rls_select_org_policy" ON public."monitor_visitas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

DROP POLICY IF EXISTS "rls_update_org_policy" ON public."monitor_visitas";
CREATE POLICY "rls_update_org_policy" ON public."monitor_visitas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organizacao_id = get_auth_user_org()))
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.historico_vgv" does not exist
-- CREATE POLICY "Inserção historico_vgv" ON public."historico_vgv" AS PERMISSIVE FOR INSERT
  WITH CHECK (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.historico_vgv" does not exist
-- CREATE POLICY "Leitura de histórico Org ou Global" ON public."historico_vgv" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

-- ERRO POLICY: relation "public.sys_chat_conversations" does not exist
-- CREATE POLICY "Insercao de conversas" ON public."sys_chat_conversations" AS PERMISSIVE FOR INSERT
  WITH CHECK ((organizacao_id = get_auth_user_org()));

-- ERRO POLICY: relation "public.sys_chat_conversations" does not exist
-- CREATE POLICY "Leitura de conversas" ON public."sys_chat_conversations" AS PERMISSIVE FOR SELECT
  USING (((organizacao_id = get_auth_user_org()) OR (organizacao_id = 1)));

CREATE TABLE IF NOT EXISTS public.sys_notification_templates (
  id bigint NOT NULL,
  nome_regra text NOT NULL,
  tabela_alvo text NOT NULL,
  evento text NOT NULL,
  coluna_monitorada text,
  valor_gatilho text,
  enviar_para_dono boolean DEFAULT false,
  titulo_template text NOT NULL,
  mensagem_template text NOT NULL,
  link_template text,
  organizacao_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  icone text DEFAULT 'fa-bell'::text,
  regras_avancadas jsonb
);

CREATE TABLE IF NOT EXISTS public.indices_governamentais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome_indice text NOT NULL,
  mes_ano text NOT NULL,
  data_referencia date NOT NULL,
  valor_mensal numeric NOT NULL,
  organizacao_id integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  descricao text
);

CREATE TABLE IF NOT EXISTS public.sys_chat_participants (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.sys_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid,
  sender_id uuid NOT NULL,
  conteudo text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  read_at timestamp with time zone
);

ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS meta_adset_id text;

ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS periodo_correcao text DEFAULT 'anual'::text;

ALTER TABLE public.cadastro_empresa ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.contas_financeiras ADD COLUMN IF NOT EXISTS conta_pai_id bigint;

ALTER TABLE public.elementos_bim ADD COLUMN IF NOT EXISTS sync_session text;

ALTER TABLE public.elementos_bim ADD COLUMN IF NOT EXISTS etapa_id bigint;

ALTER TABLE public.elementos_bim ADD COLUMN IF NOT EXISTS subetapa_id bigint;

ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS customer_window_start_at timestamp with time zone;

ALTER TABLE public.bim_notas ADD COLUMN IF NOT EXISTS markup_svg text;

CREATE TABLE IF NOT EXISTS public.sys_chat_mural_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organizacao_id bigint NOT NULL,
  author_id uuid NOT NULL,
  assunto text NOT NULL,
  conteudo text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sys_chat_mural_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sys_chat_mural_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  conteudo text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meta_ativos (
  id text NOT NULL,
  organizacao_id bigint NOT NULL,
  tipo text NOT NULL,
  nome text NOT NULL,
  empreendimento_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS link_opcional text;

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS imagem_url text;

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS diagnostico text;

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS plano_solucao text;

ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual'::text;

ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS bim_projeto_id bigint;

ALTER TABLE public.integracoes_meta ADD COLUMN IF NOT EXISTS instagram_business_account_id text;

CREATE TABLE IF NOT EXISTS public.historico_vgv (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data_alteracao timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  empreendimento_id bigint NOT NULL,
  produto_id bigint NOT NULL,
  valor_produto_anterior numeric,
  valor_produto_novo numeric,
  vgv_anterior numeric,
  vgv_novo numeric,
  organizacao_id integer,
  usuario_alteracao uuid
);

CREATE TABLE IF NOT EXISTS public.sys_chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organizacao_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
