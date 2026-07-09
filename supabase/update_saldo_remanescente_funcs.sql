CREATE OR REPLACE FUNCTION public.gerar_parcelas_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    config_venda RECORD;
    permuta_total NUMERIC;
    valor_base NUMERIC;
    valor_entrada NUMERIC;
    valor_obra NUMERIC;
    valor_adicionais NUMERIC;
    valor_remanescente NUMERIC;
    valor_parcela_entrada NUMERIC;
    valor_parcela_obra NUMERIC;
    primeira_data_entrada DATE;
    primeira_data_obra DATE;
    i INTEGER;
    v_prazo_entrega TEXT;
    v_data_chaves DATE := NULL;
    v_vencimento_saldo DATE;
BEGIN
    SELECT * INTO config_venda
    FROM public.configuracoes_venda
    WHERE empreendimento_id = NEW.empreendimento_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(valor), 0) INTO permuta_total
    FROM public.contrato_permutas
    WHERE contrato_id = NEW.id;

    valor_base := NEW.valor_final_venda;

    valor_entrada := valor_base * (config_venda.entrada_percentual / 100.0);
    valor_obra := valor_base * (config_venda.parcelas_obra_percentual / 100.0);
    
    primeira_data_entrada := COALESCE(config_venda.data_primeira_parcela_entrada, NEW.data_venda + INTERVAL '30 days');
    IF config_venda.num_parcelas_entrada > 0 THEN
        valor_parcela_entrada := valor_entrada / config_venda.num_parcelas_entrada;
        FOR i IN 1..config_venda.num_parcelas_entrada LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
            VALUES (NEW.id, 'Entrada ' || i || '/' || config_venda.num_parcelas_entrada, 'Entrada', primeira_data_entrada + (INTERVAL '1 month' * (i-1)), valor_parcela_entrada, NEW.organizacao_id);
        END LOOP;
    END IF;

    primeira_data_obra := COALESCE(config_venda.data_primeira_parcela_obra, primeira_data_entrada + (INTERVAL '1 month' * config_venda.num_parcelas_entrada));
    IF config_venda.num_parcelas_obra > 0 THEN
        valor_parcela_obra := valor_obra / config_venda.num_parcelas_obra;
        FOR i IN 1..config_venda.num_parcelas_obra LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
            VALUES (NEW.id, 'Parcela Obra ' || i || '/' || config_venda.num_parcelas_obra, 'Obra', primeira_data_obra + (INTERVAL '1 month' * (i-1)), valor_parcela_obra, NEW.organizacao_id);
        END LOOP;
    END IF;

    SELECT COALESCE(SUM(valor), 0) INTO valor_adicionais
    FROM public.parcelas_adicionais
    WHERE configuracao_venda_id = config_venda.id;

    INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
    SELECT NEW.id, 'Parcela Adicional', 'Adicional', pa.data_pagamento, pa.valor, NEW.organizacao_id
    FROM public.parcelas_adicionais pa
    WHERE pa.configuracao_venda_id = config_venda.id;

    valor_remanescente := valor_base - valor_entrada - valor_obra - valor_adicionais - permuta_total;
    IF valor_remanescente > 0 THEN
        -- Tenta buscar o prazo de entrega do empreendimento
        SELECT e.prazo_entrega INTO v_prazo_entrega
        FROM public.empreendimentos e
        WHERE e.id = NEW.empreendimento_id;

        IF v_prazo_entrega IS NOT NULL AND v_prazo_entrega <> '' THEN
            BEGIN
                IF v_prazo_entrega ~ '^\d{2}/\d{2}/\d{4}$' THEN
                    v_data_chaves := to_date(v_prazo_entrega, 'DD/MM/YYYY');
                ELSIF v_prazo_entrega ~ '^\d{4}-\d{2}-\d{2}$' THEN
                    v_data_chaves := to_date(v_prazo_entrega, 'YYYY-MM-DD');
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_data_chaves := NULL;
            END;
        END IF;

        IF v_data_chaves IS NOT NULL THEN
            v_vencimento_saldo := v_data_chaves;
        ELSE
            v_vencimento_saldo := primeira_data_obra + (INTERVAL '1 month' * config_venda.num_parcelas_obra);
        END IF;

        INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
        VALUES (NEW.id, 'Saldo Remanescente (Chaves)', 'Saldo Remanescente', v_vencimento_saldo, valor_remanescente, NEW.organizacao_id);
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.regerar_parcelas_contrato(p_contrato_id bigint, p_organizacao_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_simulacao RECORD;
  v_contrato RECORD;
  v_valor_parcela_entrada NUMERIC;
  v_valor_parcela_obra NUMERIC;
  v_total_gerado NUMERIC := 0;
  v_saldo_remanescente NUMERIC;
  v_ultima_data DATE;
  i INT;
  v_prazo_entrega TEXT;
  v_data_chaves DATE := NULL;
  v_vencimento_saldo DATE;
BEGIN
  -- 1. Obter dados do contrato e do plano de pagamento (simulação) vinculado
  SELECT * INTO v_contrato FROM public.contratos WHERE id = p_contrato_id AND organizacao_id = p_organizacao_id;
  IF v_contrato.id IS NULL THEN RETURN 'Erro: Contrato não encontrado.'; END IF;

  SELECT * INTO v_simulacao FROM public.simulacoes WHERE contrato_id = v_contrato.id;
  IF v_simulacao.id IS NULL THEN RETURN 'Erro: Plano de pagamento não encontrado para este contrato.'; END IF;

  -- 2. Limpar parcelas pendentes antigas para começar do zero.
  DELETE FROM public.contrato_parcelas WHERE contrato_id = p_contrato_id AND status_pagamento = 'Pendente';

  -- 3. Gerar as parcelas da ENTRADA
  IF v_simulacao.entrada_valor > 0 AND v_simulacao.num_parcelas_entrada > 0 AND v_simulacao.data_primeira_parcela_entrada IS NOT NULL THEN
    v_valor_parcela_entrada := v_simulacao.entrada_valor / v_simulacao.num_parcelas_entrada;
    FOR i IN 1..v_simulacao.num_parcelas_entrada LOOP
      INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
      VALUES (
        p_contrato_id,
        'Entrada - Parcela ' || i || '/' || v_simulacao.num_parcelas_entrada,
        'Entrada',
        v_simulacao.data_primeira_parcela_entrada + ((i-1) || ' months')::interval,
        v_valor_parcela_entrada,
        p_organizacao_id
      );
    END LOOP;
    v_total_gerado := v_total_gerado + v_simulacao.entrada_valor;
  END IF;

  -- 4. Gerar as parcelas de OBRA
  IF v_simulacao.parcelas_obra_valor > 0 AND v_simulacao.num_parcelas_obra > 0 AND v_simulacao.data_primeira_parcela_obra IS NOT NULL THEN
    v_valor_parcela_obra := v_simulacao.parcelas_obra_valor / v_simulacao.num_parcelas_obra;
    FOR i IN 1..v_simulacao.num_parcelas_obra LOOP
      INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
      VALUES (
        p_contrato_id,
        'Obra - Parcela ' || i || '/' || v_simulacao.num_parcelas_obra,
        'Obra',
        v_simulacao.data_primeira_parcela_obra + ((i-1) || ' months')::interval,
        v_valor_parcela_obra,
        p_organizacao_id
      );
    END LOOP;
    v_total_gerado := v_total_gerado + v_simulacao.parcelas_obra_valor;
  END IF;

  -- 5. Calcular e gerar a parcela do SALDO REMANESCENTE
  v_saldo_remanescente := v_contrato.valor_final_venda - v_total_gerado;

  IF v_saldo_remanescente > 0.01 THEN
    -- Tenta buscar o prazo de entrega do empreendimento
    SELECT e.prazo_entrega INTO v_prazo_entrega
    FROM public.empreendimentos e
    WHERE e.id = v_contrato.empreendimento_id;

    IF v_prazo_entrega IS NOT NULL AND v_prazo_entrega <> '' THEN
        BEGIN
            IF v_prazo_entrega ~ '^\d{2}/\d{2}/\d{4}$' THEN
                v_data_chaves := to_date(v_prazo_entrega, 'DD/MM/YYYY');
            ELSIF v_prazo_entrega ~ '^\d{4}-\d{2}-\d{2}$' THEN
                v_data_chaves := to_date(v_prazo_entrega, 'YYYY-MM-DD');
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_data_chaves := NULL;
        END;
    END IF;

    IF v_data_chaves IS NOT NULL THEN
        v_vencimento_saldo := v_data_chaves;
    ELSE
        SELECT MAX(data_vencimento) INTO v_ultima_data
        FROM public.contrato_parcelas
        WHERE contrato_id = p_contrato_id;

        IF v_ultima_data IS NULL THEN
            v_vencimento_saldo := v_contrato.data_venda + interval '30 days';
        ELSE
            v_vencimento_saldo := v_ultima_data + interval '1 month';
        END IF;
    END IF;

    INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, organizacao_id)
    VALUES (
      p_contrato_id,
      'Saldo Remanescente (Chaves)',
      'Saldo Remanescente',
      v_vencimento_saldo,
      v_saldo_remanescente,
      p_organizacao_id
    );
  END IF;

  RETURN 'Cronograma de parcelas recalculado com sucesso, incluindo o Saldo Remanescente.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.regerar_parcelas_contrato(p_contrato_id bigint)
 RETURNS TABLE(id bigint, contrato_id bigint, descricao text, tipo text, data_vencimento date, valor_parcela numeric, status_pagamento text, lancamento_id bigint, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$DECLARE
    v_simulacao RECORD;
    v_contrato RECORD;
    v_valor_base NUMERIC;
    v_valor_com_desconto NUMERIC;
    v_valor_parcela_entrada NUMERIC;
    v_valor_parcela_obra NUMERIC;
    v_data_vencimento DATE;
    v_total_gerado NUMERIC := 0;
    v_saldo_remanescente NUMERIC;
    v_ultima_data DATE;
    i INT;
    v_prazo_entrega TEXT;
    v_data_chaves DATE := NULL;
    v_vencimento_saldo DATE;
BEGIN
    SELECT * INTO v_contrato FROM public.contratos WHERE contratos.id = p_contrato_id;

    -- Encontrar a simulação associada ao contrato
    SELECT s.* INTO v_simulacao
    FROM public.simulacoes s
    JOIN public.contratos c ON s.id = c.simulacao_id
    WHERE c.id = p_contrato_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nenhuma simulação de pagamento individual encontrada para o contrato ID %', p_contrato_id;
    END IF;

    -- Deletar as parcelas antigas que ainda estão pendentes
    DELETE FROM public.contrato_parcelas
    WHERE public.contrato_parcelas.contrato_id = p_contrato_id 
      AND public.contrato_parcelas.status_pagamento = 'Pendente';

    -- Calcular valores base
    v_valor_base := v_simulacao.valor_venda;
    v_valor_com_desconto := v_valor_base - COALESCE(v_simulacao.desconto_valor, 0);

    -- Gerar parcelas da ENTRADA
    IF v_simulacao.num_parcelas_entrada > 0 AND v_simulacao.entrada_valor > 0 THEN
        v_valor_parcela_entrada := v_simulacao.entrada_valor / v_simulacao.num_parcelas_entrada;
        v_data_vencimento := v_simulacao.data_primeira_parcela_entrada;
        FOR i IN 1..v_simulacao.num_parcelas_entrada LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, status_pagamento, organizacao_id)
            VALUES (p_contrato_id, 'Parcela de Entrada ' || i || '/' || v_simulacao.num_parcelas_entrada, 'Entrada', v_data_vencimento, v_valor_parcela_entrada, 'Pendente', v_contrato.organizacao_id);
            v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
        END LOOP;
        v_total_gerado := v_total_gerado + v_simulacao.entrada_valor;
    END IF;

    -- Gerar parcelas da OBRA
    IF v_simulacao.num_parcelas_obra > 0 AND v_simulacao.parcelas_obra_valor > 0 THEN
        v_valor_parcela_obra := v_simulacao.parcelas_obra_valor / v_simulacao.num_parcelas_obra;
        v_data_vencimento := v_simulacao.data_primeira_parcela_obra;
        FOR i IN 1..v_simulacao.num_parcelas_obra LOOP
            INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, status_pagamento, organizacao_id)
            VALUES (p_contrato_id, 'Parcela de Obra ' || i || '/' || v_simulacao.num_parcelas_obra, 'Obra', v_data_vencimento, v_valor_parcela_obra, 'Pendente', v_contrato.organizacao_id);
            v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
        END LOOP;
        v_total_gerado := v_total_gerado + v_simulacao.parcelas_obra_valor;
    END IF;

    -- Gerar o saldo remanescente
    v_saldo_remanescente := v_contrato.valor_final_venda - v_total_gerado;

    IF v_saldo_remanescente > 0.01 THEN
        -- Tenta buscar o prazo de entrega do empreendimento
        SELECT e.prazo_entrega INTO v_prazo_entrega
        FROM public.empreendimentos e
        WHERE e.id = v_contrato.empreendimento_id;

        IF v_prazo_entrega IS NOT NULL AND v_prazo_entrega <> '' THEN
            BEGIN
                IF v_prazo_entrega ~ '^\d{2}/\d{2}/\d{4}$' THEN
                    v_data_chaves := to_date(v_prazo_entrega, 'DD/MM/YYYY');
                ELSIF v_prazo_entrega ~ '^\d{4}-\d{2}-\d{2}$' THEN
                    v_data_chaves := to_date(v_prazo_entrega, 'YYYY-MM-DD');
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_data_chaves := NULL;
            END;
        END IF;

        IF v_data_chaves IS NOT NULL THEN
            v_vencimento_saldo := v_data_chaves;
        ELSE
            SELECT MAX(data_vencimento) INTO v_ultima_data
            FROM public.contrato_parcelas
            WHERE contrato_id = p_contrato_id;

            IF v_ultima_data IS NULL THEN
                v_vencimento_saldo := v_contrato.data_venda + interval '30 days';
            ELSE
                v_vencimento_saldo := v_ultima_data + interval '1 month';
            END IF;
        END IF;

        INSERT INTO public.contrato_parcelas (contrato_id, descricao, tipo, data_vencimento, valor_parcela, status_pagamento, organizacao_id)
        VALUES (p_contrato_id, 'Saldo Remanescente (Chaves)', 'Saldo Remanescente', v_vencimento_saldo, v_saldo_remanescente, 'Pendente', v_contrato.organizacao_id);
    END IF;
    
    -- Retorna todas as parcelas (novas e as que já estavam pagas) do contrato
    RETURN QUERY SELECT contrato_parcelas.id, contrato_parcelas.contrato_id, contrato_parcelas.descricao, contrato_parcelas.tipo, contrato_parcelas.data_vencimento, contrato_parcelas.valor_parcela, contrato_parcelas.status_pagamento, contrato_parcelas.lancamento_id, contrato_parcelas.created_at, contrato_parcelas.updated_at FROM public.contrato_parcelas WHERE contrato_parcelas.contrato_id = p_contrato_id ORDER BY data_vencimento;

END;$function$
;
