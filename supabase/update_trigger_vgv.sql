ALTER TABLE public.empreendimentos
ADD COLUMN IF NOT EXISTS patrimonio_vgv_construido NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS vgv_total_projetado NUMERIC DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fn_autocalcular_orcamento_empreendimento(p_empreendimento_id BIGINT)
RETURNS void AS $$
DECLARE
  v_orcamento_id BIGINT;
  v_execucao_fisica JSONB;
  v_custo_total_previsto NUMERIC := 0;
  v_custo_total_executado NUMERIC := 0;
  v_percentual_executado NUMERIC := 0;
  v_vgv_total NUMERIC := 0;
  v_patrimonio_vgv NUMERIC := 0;
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

  -- Calcular o VGV Total (Regra de Ouro: Estoque Listado + Contratos)
  DECLARE
    v_vgv_estoque NUMERIC := 0;
    v_vgv_vendido NUMERIC := 0;
  BEGIN
    SELECT COALESCE(SUM(p.valor_venda_calculado), 0) INTO v_vgv_estoque
    FROM public.produtos_empreendimento p
    WHERE p.empreendimento_id = p_empreendimento_id
      AND p.status IN ('Disponível', 'Reservado', 'Reservada')
      AND NOT EXISTS (
        SELECT 1 FROM public.contrato_produtos cp
        JOIN public.contratos c ON c.id = cp.contrato_id
        WHERE cp.produto_id = p.id AND c.tipo_documento = 'CONTRATO' AND c.status_contrato = 'Assinado'
      );

    SELECT COALESCE(SUM(c.valor_final_venda), 0) INTO v_vgv_vendido
    FROM public.contratos c
    WHERE c.empreendimento_id = p_empreendimento_id
      AND c.tipo_documento = 'CONTRATO'
      AND c.status_contrato = 'Assinado';

    v_vgv_total := v_vgv_estoque + v_vgv_vendido;
  END;

  -- Calcular o Patrimônio VGV Construído
  v_patrimonio_vgv := v_vgv_total * (v_percentual_executado / 100.0);

  UPDATE public.empreendimentos
  SET 
    orcamento_previsto = v_custo_total_previsto,
    orcamento_executado = ROUND(v_custo_total_executado, 2),
    orcamento_percentual = ROUND(v_percentual_executado, 2),
    patrimonio_vgv_construido = ROUND(v_patrimonio_vgv, 2),
    vgv_total_projetado = ROUND(v_vgv_total, 2)
  WHERE id = p_empreendimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger unificado para quando VGV for alterado
CREATE OR REPLACE FUNCTION public.trg_auto_orcamento_calc_vgv()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'produtos_empreendimento' THEN
      v_emp_id := OLD.empreendimento_id;
      IF TG_OP != 'DELETE' THEN v_emp_id := NEW.empreendimento_id; END IF;
  ELSIF TG_TABLE_NAME = 'contratos' THEN
      v_emp_id := OLD.empreendimento_id;
      IF TG_OP != 'DELETE' THEN v_emp_id := NEW.empreendimento_id; END IF;
  ELSIF TG_TABLE_NAME = 'contrato_produtos' THEN
      -- Puxa o emp id baseado no contrato
      SELECT empreendimento_id INTO v_emp_id FROM public.contratos WHERE id = COALESCE(NEW.contrato_id, OLD.contrato_id);
  END IF;

  IF v_emp_id IS NOT NULL THEN
    PERFORM public.fn_autocalcular_orcamento_empreendimento(v_emp_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_calc_vgv_construido_pt ON public.produtos_empreendimento;
CREATE TRIGGER trg_calc_vgv_construido_pt
AFTER INSERT OR UPDATE OF valor_venda_calculado, status, empreendimento_id OR DELETE ON public.produtos_empreendimento
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_orcamento_calc_vgv();

DROP TRIGGER IF EXISTS trg_calc_vgv_construido_ct ON public.contratos;
CREATE TRIGGER trg_calc_vgv_construido_ct
AFTER INSERT OR UPDATE OF valor_final_venda, status_contrato, empreendimento_id OR DELETE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_orcamento_calc_vgv();

DROP TRIGGER IF EXISTS trg_calc_vgv_construido_cp ON public.contrato_produtos;
CREATE TRIGGER trg_calc_vgv_construido_cp
AFTER INSERT OR DELETE ON public.contrato_produtos
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_orcamento_calc_vgv();
