-- 1. Criação da Tabela historico_vgv
CREATE TABLE IF NOT EXISTS public.historico_vgv (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data_alteracao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    empreendimento_id BIGINT NOT NULL REFERENCES public.empreendimentos(id) ON DELETE CASCADE,
    produto_id BIGINT NOT NULL REFERENCES public.produtos_empreendimento(id) ON DELETE CASCADE,
    valor_produto_anterior NUMERIC,
    valor_produto_novo NUMERIC,
    vgv_anterior NUMERIC,
    vgv_novo NUMERIC,
    organizacao_id INTEGER REFERENCES public.organizacoes(id),
    usuario_alteracao UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.historico_vgv ENABLE ROW LEVEL SECURITY;

-- Regra de Leitura Multitenancy (Global/Org)
CREATE POLICY "Leitura de histórico Org ou Global" ON public.historico_vgv
FOR SELECT USING (
    organizacao_id = get_auth_user_org() OR organizacao_id = 1
);

-- Regra de Inserção (Apenas Trigger fará isso, mas se precisar por segurança)
CREATE POLICY "Inserção historico_vgv" ON public.historico_vgv
FOR INSERT WITH CHECK (
    organizacao_id = get_auth_user_org() OR organizacao_id = 1
);

-- 2. Criação da SQL Function para Trigger
CREATE OR REPLACE FUNCTION public.log_historico_vgv_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_vgv_novo NUMERIC;
    v_vgv_anterior NUMERIC;
BEGIN
    -- Se o valor_venda_calculado não mudou, apenas retorna sem engatilhar
    IF OLD.valor_venda_calculado IS NOT DISTINCT FROM NEW.valor_venda_calculado THEN
        RETURN NEW;
    END IF;

    -- Calcula o novo VGV do Empreendimento somando todos os produtos atuais dele no banco
    SELECT COALESCE(SUM(valor_venda_calculado), 0) INTO v_vgv_novo
    FROM public.produtos_empreendimento
    WHERE empreendimento_id = NEW.empreendimento_id;

    -- O VGV antigo é o novo VGV matematicamente subtraído da troca de peso deste produto
    v_vgv_anterior := v_vgv_novo - COALESCE(NEW.valor_venda_calculado, 0) + COALESCE(OLD.valor_venda_calculado, 0);

    -- Insere o registro de auditoria no histórico
    INSERT INTO public.historico_vgv (
        empreendimento_id,
        produto_id,
        valor_produto_anterior,
        valor_produto_novo,
        vgv_anterior,
        vgv_novo,
        organizacao_id,
        usuario_alteracao
    ) VALUES (
        NEW.empreendimento_id,
        NEW.id,
        OLD.valor_venda_calculado,
        NEW.valor_venda_calculado,
        v_vgv_anterior,
        v_vgv_novo,
        NEW.organizacao_id,
        auth.uid()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criação da Trigger na Tabela 'produtos_empreendimento'
DROP TRIGGER IF EXISTS trigger_log_historico_vgv ON public.produtos_empreendimento;
CREATE TRIGGER trigger_log_historico_vgv
AFTER UPDATE OF valor_venda_calculado ON public.produtos_empreendimento
FOR EACH ROW
EXECUTE FUNCTION public.log_historico_vgv_trigger();
