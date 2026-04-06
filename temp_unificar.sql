
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
