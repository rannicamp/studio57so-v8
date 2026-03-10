-- Migration: Nova Tabela de Índices Financeiros & RPC
-- Data: 10/03/2026
-- Objetivo: Armazenar índices oficiais (IPCA, IGP-M, etc) de forma centralizada (Org 1) e prover consulta pública/SaaS.

-- 1. Criação da Tabela
CREATE TABLE IF NOT EXISTS public.indices_governamentais (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_indice TEXT NOT NULL,           -- Ex: 'IPCA', 'IGP-M', 'INCC'
    mes_ano TEXT NOT NULL,               -- Ex: '01/2026', '12/2025'
    data_referencia DATE NOT NULL,       -- Ex: '2026-01-01' (Usado para ordenação cronológica)
    valor_mensal DECIMAL(10,4) NOT NULL, -- Valor percentual do mês (Ex: 0.42)
    organizacao_id INTEGER NOT NULL DEFAULT 1 REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Impede duplicidade de índice no mesmo mês
    UNIQUE(nome_indice, mes_ano) 
);

-- Trigger de Updated_at (Padrão Studio 57)
DROP TRIGGER IF EXISTS handle_updated_at_indices_gov ON public.indices_governamentais;
CREATE TRIGGER handle_updated_at_indices_gov
BEFORE UPDATE ON public.indices_governamentais
FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.indices_governamentais ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança (SaaS Multitenancy Padrão)
-- SELECT: Qualquer usuário logado pode ver (porque os índices da Org 1 são globais).
DROP POLICY IF EXISTS "Usuarios podem ver indices" ON public.indices_governamentais;
CREATE POLICY "Usuarios podem ver indices" ON public.indices_governamentais
    FOR SELECT USING (
        organizacao_id = 1 OR organizacao_id = get_auth_user_org()
    );

-- INSERT: Apenas a Organização 1 (Matriz) pode inserir novos índices globais.
DROP POLICY IF EXISTS "Apenas Org 1 insere indices" ON public.indices_governamentais;
CREATE POLICY "Apenas Org 1 insere indices" ON public.indices_governamentais
    FOR INSERT WITH CHECK (
        get_auth_user_org() = 1 AND organizacao_id = 1
    );

-- UPDATE: Apenas a Organização 1 pode editar.
DROP POLICY IF EXISTS "Apenas Org 1 edita indices" ON public.indices_governamentais;
CREATE POLICY "Apenas Org 1 edita indices" ON public.indices_governamentais
    FOR UPDATE USING (
        get_auth_user_org() = 1 AND organizacao_id = 1
    );

-- DELETE: Apenas a Organização 1 pode excluir.
DROP POLICY IF EXISTS "Apenas Org 1 deleta indices" ON public.indices_governamentais;
CREATE POLICY "Apenas Org 1 deleta indices" ON public.indices_governamentais
    FOR DELETE USING (
        get_auth_user_org() = 1 AND organizacao_id = 1
    );


-- 4. Função (RPC) para calcular Acumulado de 12 Meses
-- Esta função será usada pelo motor do Simulador. Ela pega a data base, volta 12 meses
-- e soma (ou multiplica, dependendo da matemática) os índices daquele período.
-- Para índices brasileiros, a matemática real de acumulado é a produtória de (1 + taxa/100) - 1.

CREATE OR REPLACE FUNCTION public.calcular_acumulado_12m(p_indice TEXT, p_data_limite DATE)
RETURNS DECIMAL AS $$
DECLARE
    v_acumulado DECIMAL := 1.0;
    v_fator DECIMAL;
    v_count INTEGER := 0;
BEGIN
    -- Busca os últimos 12 registros ANTERIORES ou IGUAIS à p_data_limite para o índice escolhido
    FOR v_fator IN 
        SELECT (1 + (valor_mensal / 100))
        FROM public.indices_governamentais
        WHERE nome_indice = p_indice
          AND data_referencia <= p_data_limite
        ORDER BY data_referencia DESC
        LIMIT 12
    LOOP
        v_acumulado := v_acumulado * v_fator;
        v_count := v_count + 1;
    END LOOP;

    -- Se não encontrou nada, retorna zero.
    IF v_count = 0 THEN
        RETURN 0.00;
    END IF;

    -- Subtrai 1 e multiplica por 100 para voltar a ser porcentagem
    RETURN ROUND(((v_acumulado - 1) * 100)::numeric, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
