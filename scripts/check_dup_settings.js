const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };
async function countRows() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        const res = await prod.query(`
            SELECT template_id, organizacao_id, COUNT(*) 
            FROM sys_org_notification_settings 
            WHERE is_active = true 
            GROUP BY template_id, organizacao_id 
            HAVING COUNT(*) > 1;
        `);
        console.table(res.rows);
    } catch(err) { console.error('Erro:', err.message); }
    finally { await prod.end(); }
}
countRows();
