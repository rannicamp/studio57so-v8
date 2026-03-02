const { Client } = require('pg');
const fs = require('fs');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();

    // Buscar no webhook logs onde o payload.entry[0].changes[0].value.statuses contenha erros
    const { rows } = await db.query(`
        SELECT created_at, payload
        FROM whatsapp_webhook_logs
        WHERE payload::jsonb -> 'body' -> 'entry' -> 0 -> 'changes' -> 0 -> 'value' -> 'statuses' -> 0 ->> 'status' = 'failed'
        ORDER BY created_at DESC
        LIMIT 5;
    `);

    fs.writeFileSync('c:/Projetos/studio57so-v8/webhook-falhas.json', JSON.stringify(rows, null, 2));
    await db.end();
}
run();
