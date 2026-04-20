CREATE OR REPLACE FUNCTION public.get_balanco_patrimonial(p_organizacao_id BIGINT)
RETURNS JSON AS $$
DECLARE
  v_ativos NUMERIC := 0;
  v_passivos NUMERIC := 0;
  v_vgv NUMERIC := 0;
  v_conta RECORD;
  v_saldo_parcial NUMERIC;
BEGIN
  -- 1. Obter VGV Construido Total
  SELECT COALESCE(SUM(patrimonio_vgv_construido), 0) INTO v_vgv
  FROM public.empreendimentos 
  WHERE organizacao_id = p_organizacao_id;

  -- 2. Iterar sobre todas as contas financeiras da organizacao
  FOR v_conta IN (
    SELECT id, tipo 
    FROM public.contas_financeiras 
    WHERE organizacao_id = p_organizacao_id
  ) LOOP
    -- Busca o saldo real atualizado. Como queremos o saldo de hoje, passamos CURRENT_DATE + 1 as DATE
    v_saldo_parcial := public.calcular_saldo_anterior(v_conta.id, (CURRENT_DATE + 1)::date, p_organizacao_id);
    
    IF v_conta.tipo = 'Conta de Passivo' THEN
      v_passivos := v_passivos + COALESCE(v_saldo_parcial, 0);
    ELSE
      v_ativos := v_ativos + COALESCE(v_saldo_parcial, 0);
    END IF;
  END LOOP;

  RETURN json_build_object(
      'ativos_caixa', ROUND(v_ativos, 2),
      'passivos', ROUND(v_passivos, 2),
      'vgv_construido', ROUND(v_vgv, 2),
      'patrimonio_liquido', ROUND((v_ativos + v_vgv) - ABS(v_passivos), 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
