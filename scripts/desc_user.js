const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function describeUserTables() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    try {
        await prod.connect();
        
        const tables = await prod.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name ILIKE '%user%' OR table_name ILIKE '%usuario%');
        `);
        console.log("User Tables:");
        console.table(tables.rows);

    } catch(err) { console.error(err.message); }
    finally { await prod.end(); }
}

describeUserTables();
