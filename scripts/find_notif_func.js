const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function searchRoutines() {
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
        if (res.rows.length === 0) {
            console.log("Nenhuma função encontrada com INSERT INTO notificacoes");
        } else {
            for(let row of res.rows) {
                console.log("=============== FUNCTION: " + row.routine_name + " ===============");
                console.log(row.routine_definition);
            }
        }
    } catch(err) { console.error('Erro:', err.message); }
    finally { await prod.end(); }
}

searchRoutines();
