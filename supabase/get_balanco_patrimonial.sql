CREATE OR REPLACE FUNCTION public.get_balanco_patrimonial(p_organizacao_id BIGINT)
RETURNS JSON AS $$
DECLARE
  v_ativos_caixa NUMERIC := 0;
  v_ativos_imobilizados NUMERIC := 0;
  v_passivos NUMERIC := 0;
  v_vgv NUMERIC := 0;
  v_conta RECORD;
  v_saldo_parcial NUMERIC;
BEGIN
  -- 1. Obter VGV Construido Total
  SELECT COALESCE(SUM(patrimonio_vgv_construido), 0) INTO v_vgv
  FROM public.empreendimentos 
  WHERE organizacao_id = p_organizacao_id;

  -- 2. Iterar sobre todas as contas financeiras (Disponibilidade/Caixa)
  -- Ignorar as de Ativo e Passivo que são imobilizações (calculadas depois)
  FOR v_conta IN (
    SELECT id, tipo 
    FROM public.contas_financeiras 
    WHERE organizacao_id = p_organizacao_id
      AND tipo NOT IN ('Conta de Passivo', 'Conta de Ativo')
  ) LOOP
    v_saldo_parcial := public.calcular_saldo_anterior(v_conta.id, (CURRENT_DATE + 1)::date, p_organizacao_id);
    v_ativos_caixa := v_ativos_caixa + COALESCE(v_saldo_parcial, 0);
  END LOOP;

  -- 3. Calcular Ativos e Passivos Imobilizados via Patrimonio (Lancamentos)
  WITH patrimonio AS (
    SELECT id, tipo, valor
    FROM public.lancamentos
    WHERE organizacao_id = p_organizacao_id
      AND tipo IN ('Ativo', 'Passivo')
  ),
  vinculos AS (
    SELECT lancamento_ativo_id, valor
    FROM public.lancamentos
    WHERE organizacao_id = p_organizacao_id
      AND status = 'Pago'
      AND tipo IN ('Receita', 'Despesa')
      AND lancamento_ativo_id IN (SELECT id FROM patrimonio)
  ),
  realizados AS (
    SELECT lancamento_ativo_id, SUM(ABS(valor)) as realizado
    FROM vinculos
    GROUP BY lancamento_ativo_id
  )
  SELECT 
    COALESCE(SUM(CASE WHEN p.tipo = 'Ativo' THEN (p.valor - COALESCE(r.realizado, 0)) ELSE 0 END), 0) AS total_ativos,
    COALESCE(SUM(CASE WHEN p.tipo = 'Passivo' THEN (p.valor + COALESCE(r.realizado, 0)) ELSE 0 END), 0) AS total_passivos
  INTO v_ativos_imobilizados, v_passivos
  FROM patrimonio p
  LEFT JOIN realizados r ON p.id = r.lancamento_ativo_id;

  RETURN json_build_object(
      'ativos_caixa', ROUND(v_ativos_caixa, 2),
      'ativos_imobilizados', ROUND(v_ativos_imobilizados, 2),
      'passivos', ROUND(v_passivos, 2),
      'vgv_construido', ROUND(v_vgv, 2),
      'patrimonio_liquido', ROUND((v_ativos_caixa + v_ativos_imobilizados + v_vgv) - ABS(v_passivos), 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
