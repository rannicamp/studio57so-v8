const fs = require('fs');
const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };
async function analyzeDupes() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        const res = await prod.query(`
            SELECT user_id, titulo, created_at, tipo 
            FROM notificacoes 
            ORDER BY created_at DESC 
            LIMIT 50;
        `);
        fs.writeFileSync('scripts/recent_notifs.json', JSON.stringify(res.rows, null, 2));
    } catch(err) { console.error('Erro:', err.message); }
    finally { await prod.end(); }
}
analyzeDupes();
