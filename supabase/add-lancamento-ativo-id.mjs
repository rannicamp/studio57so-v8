// Migration: adiciona coluna lancamento_ativo_id em lancamentos
// Uso: node supabase/add-lancamento-ativo-id.mjs
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: decodeURIComponent('postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres'),
    ssl: { rejectUnauthorized: false }
});
await client.connect();
console.log('✅ Conectado!\n');

// 1. Adiciona a coluna se não existir
const addCol = await client.query(`
    ALTER TABLE public.lancamentos
    ADD COLUMN IF NOT EXISTS lancamento_ativo_id BIGINT REFERENCES public.lancamentos(id) ON DELETE SET NULL;
`);
console.log('✅ Coluna lancamento_ativo_id adicionada (ou já existia)!');

// 2. Cria index para performance
await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lancamentos_ativo_id
    ON public.lancamentos(lancamento_ativo_id)
    WHERE lancamento_ativo_id IS NOT NULL;
`);
console.log('✅ Index criado!');

// 3. Confirma
const check = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'lancamento_ativo_id'
`);
console.log('\n📊 Verificação:');
console.table(check.rows);

await client.end();
console.log('🔌 Concluído!');
