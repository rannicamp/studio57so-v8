// Script de Migração: Motor de Conciliação OFX (Studio 57)
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✅ Conectado ao banco Studio 57!\n');

console.log('⏳ Criando tabela banco_arquivos_ofx...');
await client.query(`
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
    status TEXT DEFAULT 'Processado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);
console.log('✅ Tabela banco_arquivos_ofx OK!');

console.log('\n⏳ Criando tabela banco_transacoes_ofx...');
await client.query(`
CREATE TABLE IF NOT EXISTS public.banco_transacoes_ofx (
    fitid TEXT PRIMARY KEY,
    arquivo_id UUID REFERENCES public.banco_arquivos_ofx(id) ON DELETE CASCADE,
    organizacao_id BIGINT REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    conta_id BIGINT REFERENCES public.contas_financeiras(id) ON DELETE CASCADE,
    data_transacao DATE NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    tipo TEXT NOT NULL,
    descricao_banco TEXT,
    memo_banco TEXT,
    lancamento_id_vinculado BIGINT REFERENCES public.lancamentos(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);
console.log('✅ Tabela banco_transacoes_ofx OK!');

console.log('\n⏳ Adicionando colunas OFX na tabela lancamentos...');
await client.query(`
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lancamentos' AND column_name='fitid_banco') THEN 
        ALTER TABLE public.lancamentos ADD COLUMN fitid_banco TEXT UNIQUE;
        RAISE NOTICE 'Coluna fitid_banco adicionada.';
    ELSE
        RAISE NOTICE 'Coluna fitid_banco já existe, pulando.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lancamentos' AND column_name='origem_criacao') THEN 
        ALTER TABLE public.lancamentos ADD COLUMN origem_criacao TEXT DEFAULT 'Manual';
        RAISE NOTICE 'Coluna origem_criacao adicionada.';
    ELSE
        RAISE NOTICE 'Coluna origem_criacao já existe, pulando.';
    END IF;
END $$;
`);
console.log('✅ Colunas OFX em lancamentos OK!');

console.log('\n⏳ Adicionando colunas de auto-pareamento em contas_financeiras...');
await client.query(`
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contas_financeiras' AND column_name='codigo_banco_ofx') THEN 
        ALTER TABLE public.contas_financeiras ADD COLUMN codigo_banco_ofx TEXT;
        RAISE NOTICE 'Coluna codigo_banco_ofx adicionada.';
    ELSE
        RAISE NOTICE 'Coluna codigo_banco_ofx já existe, pulando.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contas_financeiras' AND column_name='numero_conta_ofx') THEN 
        ALTER TABLE public.contas_financeiras ADD COLUMN numero_conta_ofx TEXT;
        RAISE NOTICE 'Coluna numero_conta_ofx adicionada.';
    ELSE
        RAISE NOTICE 'Coluna numero_conta_ofx já existe, pulando.';
    END IF;
END $$;
`);
console.log('✅ Colunas de auto-pareamento em contas_financeiras OK!');

console.log('\n⏳ Habilitando RLS e criando Policies...');
await client.query(`ALTER TABLE public.banco_arquivos_ofx ENABLE ROW LEVEL SECURITY;`);
await client.query(`ALTER TABLE public.banco_transacoes_ofx ENABLE ROW LEVEL SECURITY;`);

await client.query(`
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banco_arquivos_ofx' AND policyname = 'Permite Tudo Arquivos OFX') THEN
        CREATE POLICY "Permite Tudo Arquivos OFX" ON public.banco_arquivos_ofx FOR ALL USING (true);
        RAISE NOTICE 'Policy banco_arquivos_ofx criada.';
    ELSE
        RAISE NOTICE 'Policy banco_arquivos_ofx já existe.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banco_transacoes_ofx' AND policyname = 'Permite Tudo Transacoes OFX') THEN
        CREATE POLICY "Permite Tudo Transacoes OFX" ON public.banco_transacoes_ofx FOR ALL USING (true);
        RAISE NOTICE 'Policy banco_transacoes_ofx criada.';
    ELSE
        RAISE NOTICE 'Policy banco_transacoes_ofx já existe.';
    END IF;
END $$;
`);
console.log('✅ RLS e Policies OK!');

// Verificação Final
const verifica = await client.query(`
    SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='banco_arquivos_ofx') AS tabela_arquivos,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='banco_transacoes_ofx') AS tabela_transacoes,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='lancamentos' AND column_name='fitid_banco') AS col_fitid,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='contas_financeiras' AND column_name='codigo_banco_ofx') AS col_banco_ofx;
`);
console.log('\n📊 VERIFICAÇÃO FINAL:');
console.table(verifica.rows);

await client.end();
console.log('\n🎉 Migração do Motor OFX concluída com sucesso!');
