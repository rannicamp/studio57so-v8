CREATE OR REPLACE FUNCTION public.fn_autocalcular_orcamento_empreendimento(p_empreendimento_id BIGINT)
RETURNS void AS $$
DECLARE
  v_orcamento_id BIGINT;
  v_execucao_fisica JSONB;
  v_custo_total_previsto NUMERIC := 0;
  v_custo_total_executado NUMERIC := 0;
  v_percentual_executado NUMERIC := 0;
  v_etapa RECORD;
  v_etapa_executado_pct NUMERIC;
BEGIN
  SELECT id, execucao_fisica INTO v_orcamento_id, v_execucao_fisica
  FROM public.orcamentos
  WHERE empreendimento_id = p_empreendimento_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_orcamento_id IS NULL THEN RETURN; END IF;
  IF v_execucao_fisica IS NULL THEN v_execucao_fisica := '{}'::JSONB; END IF;

  SELECT COALESCE(SUM(custo_total), 0) INTO v_custo_total_previsto
  FROM public.orcamento_itens
  WHERE orcamento_id = v_orcamento_id;

  FOR v_etapa IN (
    SELECT etapa_id, SUM(custo_total) as etapa_custo
    FROM public.orcamento_itens
    WHERE orcamento_id = v_orcamento_id
    GROUP BY etapa_id
  ) LOOP
    IF v_etapa.etapa_id IS NOT NULL THEN
      v_etapa_executado_pct := COALESCE(NULLIF(v_execucao_fisica->>v_etapa.etapa_id::text, ''), '0')::NUMERIC;
      v_custo_total_executado := v_custo_total_executado + (v_etapa.etapa_custo * (v_etapa_executado_pct / 100.0));
    END IF;
  END LOOP;

  IF v_custo_total_previsto > 0 THEN
    v_percentual_executado := (v_custo_total_executado / v_custo_total_previsto) * 100.0;
  ELSE
    v_percentual_executado := 0;
  END IF;

  -- Apply ROUND(.., 2) to truncate all numeric pollution
  UPDATE public.empreendimentos
  SET 
    orcamento_previsto = ROUND(v_custo_total_previsto, 2),
    orcamento_executado = ROUND(v_custo_total_executado, 2),
    orcamento_percentual = ROUND(v_percentual_executado, 2)
  WHERE id = p_empreendimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
