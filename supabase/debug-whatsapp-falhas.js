const fs = require('fs');
const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();

    const { rows } = await db.query(`
        SELECT 
            receiver_id,
            content,
            error_message,
            raw_payload,
            sent_at::text
        FROM whatsapp_messages
        WHERE status = 'failed'
        ORDER BY sent_at DESC
        LIMIT 5
    `);

    fs.writeFileSync('c:/Projetos/studio57so-v8/falhas.json', JSON.stringify(rows, null, 2));
    await db.end();
}
run();
