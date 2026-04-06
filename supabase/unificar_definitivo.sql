CREATE OR REPLACE FUNCTION public.unificar_materiais_definitivo(
p_material_antigo_id bigint,
p_material_novo_id bigint
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
AS $$
BEGIN
  -- ===================================================
  -- 1. TRATAMENTO DA TABELA ESTOQUE
  -- ===================================================

  -- PASSO A: Atualizar o destino (novo) somando as quantidades
  UPDATE public.estoque AS dest
  SET 
    quantidade_atual = dest.quantidade_atual + src.quantidade_atual,
    quantidade_em_uso = dest.quantidade_em_uso + src.quantidade_em_uso,
    custo_medio = CASE 
        WHEN (dest.quantidade_atual + src.quantidade_atual) > 0 THEN
            ((dest.quantidade_atual * dest.custo_medio) + (src.quantidade_atual * src.custo_medio)) / (dest.quantidade_atual + src.quantidade_atual)
        ELSE dest.custo_medio 
    END,
    ultima_atualizacao = NOW()
  FROM public.estoque AS src
  WHERE dest.material_id = p_material_novo_id
    AND src.material_id = p_material_antigo_id
    AND dest.empreendimento_id = src.empreendimento_id;

  -- PASSO B: Apagar os velhos somados
  DELETE FROM public.estoque
  WHERE material_id = p_material_antigo_id
    AND empreendimento_id IN (
        SELECT empreendimento_id 
        FROM public.estoque 
        WHERE material_id = p_material_novo_id
    );

  -- PASSO C: Renomear o restante
  UPDATE public.estoque
  SET material_id = p_material_novo_id
  WHERE material_id = p_material_antigo_id;

  -- ===================================================
  -- 2. TRATAMENTO DA TABELA ESTOQUE_OBRA
  -- ===================================================
  
  -- PASSO A: Soma
  UPDATE public.estoque_obra AS dest
  SET 
    quantidade = dest.quantidade + src.quantidade,
    ultima_atualizacao = NOW()
  FROM public.estoque_obra AS src
  WHERE dest.material_id = p_material_novo_id
    AND src.material_id = p_material_antigo_id
    AND dest.empreendimento_id = src.empreendimento_id;

  -- PASSO B: Apaga os somados
  DELETE FROM public.estoque_obra
  WHERE material_id = p_material_antigo_id
    AND empreendimento_id IN (
        SELECT empreendimento_id 
        FROM public.estoque_obra 
        WHERE material_id = p_material_novo_id
    );

  -- PASSO C: Renomeia o restante
  UPDATE public.estoque_obra
  SET material_id = p_material_novo_id
  WHERE material_id = p_material_antigo_id;

  -- ===================================================
  -- 3. ORÇAMENTOS E PEDIDOS (Renomeia)
  -- ===================================================
  UPDATE public.orcamento_itens
  SET material_id = p_material_novo_id
  WHERE material_id = p_material_antigo_id;

  UPDATE public.pedidos_compra_itens
  SET material_id = p_material_novo_id
  WHERE material_id = p_material_antigo_id;

  -- ===================================================
  -- 4. APAGA O MATERIAL VELHO FINALMENTE
  -- ===================================================
  DELETE FROM public.materiais
  WHERE id = p_material_antigo_id;

END;
$$;
