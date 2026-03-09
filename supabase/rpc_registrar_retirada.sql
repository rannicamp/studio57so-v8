-- =========================================================================
-- FUNÇÃO RPC: registrar_retirada_estoque
-- DESCRIÇÃO: Movimenta de forma atômica ferramentas "Disponíveis" para 
-- "Em Uso" e registra a transação histórica blindada contra concorrência 
-- simultânea (Condição de Corrida/Double Click).
-- =========================================================================

CREATE OR REPLACE FUNCTION registrar_retirada_estoque(
    p_estoque_id UUID,
    p_quantidade NUMERIC,
    p_observacao TEXT,
    p_usuario_id TEXT,
    p_funcionario_id UUID,
    p_organizacao_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
