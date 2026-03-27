const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function describeUserPrefs() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        
        // Find tables with config, settings, preferences
        const tables = await prod.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name ILIKE '%pref%' OR table_name ILIKE '%user_notif%' OR table_name ILIKE '%funcionarios%');
        `);
        console.log("Found tables:");
        console.table(tables.rows);

        // Describe funcionarios
        const res = await prod.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('funcionarios', 'sys_user_notification_preferences');
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

describeUserPrefs();
