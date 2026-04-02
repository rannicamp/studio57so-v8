require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log('No DATABASE_URL in .env.local');
        return;
    }
    const c = new Client({ connectionString: dbUrl });
    await c.connect();
    const res = await c.query("SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'processar_regras_notificacao'");
    if(res.rows.length > 0) {
        console.log(res.rows[0].routine_definition);
    } else {
        console.log("Not found in public schema routines that match.");
    }
    await c.end();
}
run().catch(console.error);
