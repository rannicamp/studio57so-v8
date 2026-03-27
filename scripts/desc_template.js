const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function describeTemplate() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        const res = await prod.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sys_notification_templates';
        `);
        console.log("sys_notification_templates:");
        console.table(res.rows);
    } catch(err) { console.error(err.message); }
    finally { await prod.end(); }
}

describeTemplate();
