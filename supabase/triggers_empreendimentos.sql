ALTER TABLE public.empreendimentos
ADD COLUMN IF NOT EXISTS orcamento_previsto NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS orcamento_executado NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS orcamento_percentual NUMERIC DEFAULT 0;

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

  UPDATE public.empreendimentos
  SET 
    orcamento_previsto = v_custo_total_previsto,
    orcamento_executado = v_custo_total_executado,
    orcamento_percentual = v_percentual_executado
  WHERE id = p_empreendimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_auto_orcamento_empreendimento()
RETURNS TRIGGER AS $$
DECLARE
  v_empreendimento_id BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'orcamentos' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.execucao_fisica IS DISTINCT FROM OLD.execucao_fisica) THEN
      v_empreendimento_id := NEW.empreendimento_id;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'orcamento_itens' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT empreendimento_id INTO v_empreendimento_id FROM public.orcamentos WHERE id = OLD.orcamento_id;
    ELSE
      IF TG_OP = 'UPDATE' AND NEW.custo_total IS NOT DISTINCT FROM OLD.custo_total AND NEW.etapa_id IS NOT DISTINCT FROM OLD.etapa_id AND NEW.orcamento_id IS NOT DISTINCT FROM OLD.orcamento_id THEN
        RETURN NEW;
      END IF;
      SELECT empreendimento_id INTO v_empreendimento_id FROM public.orcamentos WHERE id = NEW.orcamento_id;
    END IF;
  END IF;

  IF v_empreendimento_id IS NOT NULL THEN
    PERFORM public.fn_autocalcular_orcamento_empreendimento(v_empreendimento_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_orcamentos_calc_patrimonio ON public.orcamentos;
CREATE TRIGGER trg_orcamentos_calc_patrimonio
AFTER INSERT OR UPDATE OF execucao_fisica ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_orcamento_empreendimento();

DROP TRIGGER IF EXISTS trg_orcamento_itens_calc_patrimonio ON public.orcamento_itens;
CREATE TRIGGER trg_orcamento_itens_calc_patrimonio
AFTER INSERT OR UPDATE OF custo_total, etapa_id, orcamento_id OR DELETE ON public.orcamento_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_orcamento_empreendimento();
