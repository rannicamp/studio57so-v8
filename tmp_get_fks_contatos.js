const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
async function main() {
    const client = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='contatos';
    `);
    console.log(res.rows);
    await client.end();
}
main();
