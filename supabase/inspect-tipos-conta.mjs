// Inspeciona os tipos de conta existentes no banco
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: decodeURIComponent('postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres'),
    ssl: { rejectUnauthorized: false }
});

await client.connect();

const res = await client.query(`SELECT DISTINCT tipo FROM public.contas_financeiras ORDER BY tipo;`);
console.log('Tipos de conta existentes:');
console.table(res.rows);

const res2 = await client.query(`SELECT DISTINCT tipo FROM public.lancamentos ORDER BY tipo;`);
console.log('Tipos de lancamento existentes:');
console.table(res2.rows);

const res3 = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.contas_financeiras'::regclass AND contype = 'c'
`);
console.log('Constraints em contas_financeiras:');
console.table(res3.rows);

const res4 = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.lancamentos'::regclass AND contype = 'c'
`);
console.log('Constraints em lancamentos:');
console.table(res4.rows);

await client.end();
