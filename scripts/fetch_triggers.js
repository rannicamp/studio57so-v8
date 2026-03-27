const fs = require('fs');
const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function extractRoutines() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        const res = await prod.query(`
            SELECT routine_name, routine_definition 
            FROM information_schema.routines 
            WHERE routine_type = 'FUNCTION' 
            AND routine_schema = 'public'
            AND routine_definition ILIKE '%INSERT INTO %notificacoes%';
        `);
        
        let output = "";
        for(let row of res.rows) {
            output += "=============== FUNCTION: " + row.routine_name + " ===============\n";
            output += row.routine_definition + "\n\n";
        }
        
        fs.writeFileSync('scripts/extracted_triggers.txt', output);
        console.log("Salvo em scripts/extracted_triggers.txt");
    } catch(err) { console.error('Erro:', err.message); }
    finally { await prod.end(); }
}

extractRoutines();
