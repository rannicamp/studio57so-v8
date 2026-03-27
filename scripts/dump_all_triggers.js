const fs = require('fs');
const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function listAllTriggers() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        const res = await prod.query(`
            SELECT event_object_table AS table_name, trigger_name, action_statement
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND action_statement ILIKE '%notifica%'
            ORDER BY event_object_table, trigger_name;
        `);
        
        let output = "";
        for (let row of res.rows) {
            output += `Table: ${row.table_name} | Trigger: ${row.trigger_name} | Action: ${row.action_statement}\n`;
        }
        
        fs.writeFileSync('scripts/all_notif_triggers.txt', output);
        console.log("Salvo em scripts/all_notif_triggers.txt");
    } catch(err) { console.error('Erro:', err.message); }
    finally { await prod.end(); }
}

listAllTriggers();
