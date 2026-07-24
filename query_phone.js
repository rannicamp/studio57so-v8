const { Client } = require('pg');
const PROD_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
async function main() {
    const client = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT id, contato_id, phone_number, meta_wa_id
        FROM whatsapp_conversations
        WHERE phone_number ILIKE '%2797176570%' OR phone_number ILIKE '%27997176570%'
    `);
    console.log('Conversations by phone:', res.rows);
    await client.end();
}
main();
