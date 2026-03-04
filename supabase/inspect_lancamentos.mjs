import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres.vhuvnutzklhskkwbpxdz:Srbr19010720%40@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✅ Conectado!\n');

// 1. Ver colunas de lancamentos
const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lancamentos'
    ORDER BY ordinal_position;
`);
console.log('📋 Colunas de lancamentos:');
console.table(cols.rows);

// 2. Ver tipo das contas_financeiras
const tipos = await client.query(`
    SELECT DISTINCT tipo FROM public.contas_financeiras ORDER BY tipo;
`);
console.log('\n📋 Tipos de conta existentes:');
console.table(tipos.rows);

// 3. Ver se a tabela faturas_cartao foi criada
const faturas = await client.query(`
    SELECT COUNT(*) as total_faturas FROM public.faturas_cartao;
`);
console.log('\n📊 Total de faturas_cartao criadas:', faturas.rows[0].total_faturas);

// 4. Ver se a coluna fatura_id foi adicionada em lancamentos
const colFatura = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lancamentos' AND column_name = 'fatura_id';
`);
console.log('\n🔗 Coluna fatura_id em lancamentos:', colFatura.rows.length > 0 ? '✅ EXISTE' : '❌ NÃO EXISTE');

// 5. Ver se a trigger foi criada
const trigger = await client.query(`
    SELECT trigger_name, event_manipulation FROM information_schema.triggers 
    WHERE event_object_table = 'lancamentos' AND trigger_name = 'trg_vincular_fatura_lancamento';
`);
console.log('\n⚡ Trigger trg_vincular_fatura_lancamento:', trigger.rows.length > 0 ? '✅ EXISTE' : '❌ NÃO EXISTE');

await client.end();
