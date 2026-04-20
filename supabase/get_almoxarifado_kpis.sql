CREATE OR REPLACE FUNCTION public.get_almoxarifado_kpis(
  p_organizacao_id BIGINT,
  p_empreendimento_id TEXT DEFAULT 'all'
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN

  WITH estoque_agrupado AS (
    SELECT 
      material_id,
      SUM(quantidade_atual) as qtd_disp,
      SUM(COALESCE(quantidade_em_uso, 0)) as qtd_uso
    FROM public.estoque
    WHERE organizacao_id = p_organizacao_id
      AND (p_empreendimento_id = 'all' OR empreendimento_id = CAST(p_empreendimento_id AS BIGINT))
    GROUP BY material_id
  ),
  precos_recentes AS (
    SELECT 
      e.material_id,
      e.qtd_disp,
      e.qtd_uso,
      m.classificacao,
      m.nome,
      COALESCE(
        (SELECT preco_unitario_real 
         FROM public.pedidos_compra_itens pci 
         WHERE pci.material_id = m.id AND preco_unitario_real IS NOT NULL
         ORDER BY created_at DESC 
         LIMIT 1),
        m.preco_unitario, 
        0
      ) as preco_recente
    FROM estoque_agrupado e
    JOIN public.materiais m ON m.id = e.material_id
  ),
  ativos AS (
    SELECT *, ((qtd_disp + qtd_uso) * preco_recente) as valor_total
    FROM precos_recentes 
    WHERE (qtd_disp + qtd_uso) > 0 AND classificacao != 'Serviço'
  ),
  totais AS (
    SELECT 
      COALESCE(SUM(valor_total), 0) as valor_estoque,
      COUNT(*) as total_skus,
      COALESCE(SUM(qtd_disp + qtd_uso), 0) as total_fisico,
      COALESCE(SUM(CASE WHEN classificacao = 'Equipamento' THEN qtd_uso ELSE 0 END), 0) as total_equipamentos_uso
    FROM ativos
  ),
  top_valiosos AS (
    SELECT json_agg(row_to_json(t)) as top_v
    FROM (
      SELECT nome, (qtd_disp + qtd_uso) as quantidade, preco_recente as valor_total
      FROM ativos
      ORDER BY preco_recente DESC
      LIMIT 10
    ) t
  ),
  distribuicao AS (
    SELECT json_agg(row_to_json(d)) as dist
    FROM (
      SELECT classificacao as name, SUM(valor_total) as value
      FROM ativos
      GROUP BY classificacao
    ) d
  )
  SELECT json_build_object(
    'valor_total', ROUND((SELECT valor_estoque FROM totais), 2),
    'quantidade_skus', (SELECT total_skus FROM totais),
    'quantidade_fisica', ROUND((SELECT total_fisico FROM totais), 2),
    'equipamentos_em_uso', ROUND((SELECT total_equipamentos_uso FROM totais), 2),
    'top_valiosos', COALESCE((SELECT top_v FROM top_valiosos), '[]'::json),
    'distribuicao_valor', COALESCE((SELECT dist FROM distribuicao), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
