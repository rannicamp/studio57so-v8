const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function describeSettingsAndSubscriptions() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        const res = await prod.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('sys_org_notification_settings', 'notification_subscriptions');
        `);
        const grouped = {};
        for(let r of res.rows) {
            if(!grouped[r.table_name]) grouped[r.table_name] = [];
            grouped[r.table_name].push(r.column_name + ' (' + r.data_type + ')');
        }
        console.log(grouped);
    } catch(err) { console.error(err.message); }
    finally { await prod.end(); }
}

describeSettingsAndSubscriptions();
