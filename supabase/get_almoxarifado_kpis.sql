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
  entradas_alugadas AS (
    SELECT 
      pci.material_id,
      SUM(pci.quantidade_solicitada) as qtd_historica_alugada
    FROM public.pedidos_compra_itens pci
    JOIN public.pedidos_compra p ON p.id = pci.pedido_compra_id
    WHERE pci.tipo_operacao = 'Aluguel'
      AND p.organizacao_id = p_organizacao_id
      AND p.status IN ('Entregue', 'Realizado', 'Em Negociação', 'Revisão do Responsável')
    GROUP BY pci.material_id
  ),
  entradas_alugadas_manuais AS (
    SELECT 
      e.material_id,
      SUM(m.quantidade) as qtd_historica_alugada
    FROM public.movimentacoes_estoque m
    JOIN public.estoque e ON e.id = m.estoque_id
    WHERE m.organizacao_id = p_organizacao_id
      AND m.tipo = 'Entrada por Compra' 
      AND m.observacao LIKE '[ALUGUEL]%'
    GROUP BY e.material_id
  ),
  entradas_alugadas_total AS (
    SELECT 
      COALESCE(ea.material_id, eam.material_id) as material_id,
      COALESCE(ea.qtd_historica_alugada, 0) + COALESCE(eam.qtd_historica_alugada, 0) as qtd_historica_alugada
    FROM entradas_alugadas ea
    FULL OUTER JOIN entradas_alugadas_manuais eam ON ea.material_id = eam.material_id
  ),
  estoque_dividido AS (
    SELECT 
      pr.material_id,
      pr.classificacao,
      pr.nome,
      pr.preco_recente,
      (pr.qtd_disp + pr.qtd_uso) as qtd_total,
      LEAST(pr.qtd_disp + pr.qtd_uso, COALESCE(ea.qtd_historica_alugada, 0)) as qtd_alugada,
      (pr.qtd_disp + pr.qtd_uso) - LEAST(pr.qtd_disp + pr.qtd_uso, COALESCE(ea.qtd_historica_alugada, 0)) as qtd_propria
    FROM precos_recentes pr
    LEFT JOIN entradas_alugadas_total ea ON ea.material_id = pr.material_id
  ),
  ativos_proprios AS (
    SELECT *, (qtd_propria * preco_recente) as valor_total
    FROM estoque_dividido
    WHERE qtd_propria > 0 AND classificacao != 'Serviço'
  ),
  ativos_alugados AS (
    SELECT *, (qtd_alugada * preco_recente) as valor_total
    FROM estoque_dividido
    WHERE qtd_alugada > 0 AND classificacao != 'Serviço'
  ),
  totais_proprios AS (
    SELECT 
      COALESCE(SUM(valor_total), 0) as valor_estoque,
      COUNT(*) as total_skus,
      COALESCE(SUM(qtd_propria), 0) as total_fisico,
      COALESCE(SUM(CASE WHEN classificacao = 'Equipamento' THEN qtd_propria ELSE 0 END), 0) as total_equipamentos
    FROM ativos_proprios
  ),
  totais_alugados AS (
    SELECT 
      COALESCE(SUM(valor_total), 0) as valor_estoque,
      COUNT(*) as total_skus,
      COALESCE(SUM(qtd_alugada), 0) as total_fisico,
      COALESCE(SUM(CASE WHEN classificacao = 'Equipamento' THEN qtd_alugada ELSE 0 END), 0) as total_equipamentos
    FROM ativos_alugados
  ),
  top_valiosos_proprios AS (
    SELECT json_agg(row_to_json(t)) as top_v
    FROM (
      SELECT nome, qtd_propria as quantidade, valor_total
      FROM ativos_proprios
      ORDER BY valor_total DESC
      LIMIT 10
    ) t
  ),
  top_valiosos_alugados AS (
    SELECT json_agg(row_to_json(t)) as top_v
    FROM (
      SELECT nome, qtd_alugada as quantidade, valor_total
      FROM ativos_alugados
      ORDER BY valor_total DESC
      LIMIT 10
    ) t
  ),
  distribuicao_proprios AS (
    SELECT json_agg(row_to_json(d)) as dist
    FROM (
      SELECT classificacao as name, SUM(valor_total) as value
      FROM ativos_proprios
      GROUP BY classificacao
    ) d
  ),
  distribuicao_alugados AS (
    SELECT json_agg(row_to_json(d)) as dist
    FROM (
      SELECT classificacao as name, SUM(valor_total) as value
      FROM ativos_alugados
      GROUP BY classificacao
    ) d
  )
  
  SELECT json_build_object(
    'proprios', json_build_object(
      'valor_total', ROUND((SELECT valor_estoque FROM totais_proprios), 2),
      'quantidade_skus', (SELECT total_skus FROM totais_proprios),
      'quantidade_fisica', ROUND((SELECT total_fisico FROM totais_proprios), 2),
      'equipamentos_em_uso', ROUND((SELECT total_equipamentos FROM totais_proprios), 2),
      'top_valiosos', COALESCE((SELECT top_v FROM top_valiosos_proprios), '[]'::json),
      'distribuicao_valor', COALESCE((SELECT dist FROM distribuicao_proprios), '[]'::json)
    ),
    'alugados', json_build_object(
      'valor_total', ROUND((SELECT valor_estoque FROM totais_alugados), 2),
      'quantidade_skus', (SELECT total_skus FROM totais_alugados),
      'quantidade_fisica', ROUND((SELECT total_fisico FROM totais_alugados), 2),
      'equipamentos_em_uso', ROUND((SELECT total_equipamentos FROM totais_alugados), 2),
      'top_valiosos', COALESCE((SELECT top_v FROM top_valiosos_alugados), '[]'::json),
      'distribuicao_valor', COALESCE((SELECT dist FROM distribuicao_alugados), '[]'::json)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
