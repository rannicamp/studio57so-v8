const fs = require('fs');
const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function checkTriggers() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        const res = await prod.query(`
            SELECT event_object_table AS table, trigger_name, action_statement
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND (action_statement ILIKE '%processar_regras_notificacao%' OR action_statement ILIKE '%processar_notificacao_automatica%');
        `);
        fs.writeFileSync('scripts/triggers_list.json', JSON.stringify(res.rows, null, 2));
        console.log("Salvo em scripts/triggers_list.json");
    } catch(err) { console.error('Erro:', err.message); }
    finally { await prod.end(); }
}

checkTriggers();
