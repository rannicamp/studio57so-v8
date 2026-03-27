const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };
async function updateTicket() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        await prod.query(`UPDATE public.sys_app_feedbacks SET status = 'implementado' WHERE id = 76`);
        console.log('Ticket 76 Implementado');
    } catch(err) { console.error('Erro:', err.message); }
    finally { await prod.end(); }
}
updateTicket();
