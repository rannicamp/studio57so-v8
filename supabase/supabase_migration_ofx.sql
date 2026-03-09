-- =========================================================================================
-- MÓDULO FINANCEIRO: MOTOR DE CONCILIAÇÃO INTELIGENTE OFX (STUDIO 57)
-- =========================================================================================

-- 1. Tabela para registrar os Arquivos OFX enviados
CREATE TABLE IF NOT EXISTS public.banco_arquivos_ofx (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacao_id BIGINT REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    conta_id BIGINT REFERENCES public.contas_financeiras(id) ON DELETE CASCADE,
    arquivo_url TEXT,
    nome_arquivo TEXT,
    data_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enviado_por TEXT,
    periodo_inicio DATE,
    periodo_fim DATE,
    status TEXT DEFAULT 'Processado', -- Ex: Processado, Com Erro
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela Espelho (Staging) para as Transações Cruas do OFX
CREATE TABLE IF NOT EXISTS public.banco_transacoes_ofx (
    fitid TEXT PRIMARY KEY, -- O FITID é a Primary Key absoluta para garantir que a mesma transação nunca entre 2x, nem de outro banco
    arquivo_id UUID REFERENCES public.banco_arquivos_ofx(id) ON DELETE CASCADE,
    organizacao_id BIGINT REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    conta_id BIGINT REFERENCES public.contas_financeiras(id) ON DELETE CASCADE,
    data_transacao DATE NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    tipo TEXT NOT NULL, -- Receita ou Despesa (baseado no sinal do valor no OFX)
    descricao_banco TEXT,
    memo_banco TEXT,
    lancamento_id_vinculado BIGINT REFERENCES public.lancamentos(id) ON DELETE SET NULL, -- Se null = "Pendente de conciliação/Órfão"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Injetando a coluna de FITID e Booleanos na tabela real principal 'lancamentos'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lancamentos' AND column_name='fitid_banco') THEN 
        ALTER TABLE public.lancamentos ADD COLUMN fitid_banco TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lancamentos' AND column_name='origem_criacao') THEN 
        ALTER TABLE public.lancamentos ADD COLUMN origem_criacao TEXT DEFAULT 'Manual'; -- Pode ser: Manual ou OFX
    END IF;
END $$;

-- 4. Adicionar colunas de auto-pareamento de conta na Tabela 'contas_financeiras'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contas_financeiras' AND column_name='codigo_banco_ofx') THEN 
        ALTER TABLE public.contas_financeiras ADD COLUMN codigo_banco_ofx TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contas_financeiras' AND column_name='numero_conta_ofx') THEN 
        ALTER TABLE public.contas_financeiras ADD COLUMN numero_conta_ofx TEXT;
    END IF;
END $$;

-- 5. Habilitar o RLS (Segurança base do Supabase)
ALTER TABLE public.banco_arquivos_ofx ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_transacoes_ofx ENABLE ROW LEVEL SECURITY;

-- 6. Criar Policity (Dando acesso aos usuarios autenticados da plataforma)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banco_arquivos_ofx' AND policyname = 'Permite Tudo Arquivos OFX') THEN
        CREATE POLICY "Permite Tudo Arquivos OFX" ON public.banco_arquivos_ofx FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banco_transacoes_ofx' AND policyname = 'Permite Tudo Transacoes OFX') THEN
        CREATE POLICY "Permite Tudo Transacoes OFX" ON public.banco_transacoes_ofx FOR ALL USING (true);
    END IF;
END $$;
