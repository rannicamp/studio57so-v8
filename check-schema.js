const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
const host = 'db.' + baseHost.split('.')[0] + '.supabase.co';
const connStr = 'postgres://postgres:' + password + '@' + host + ':6543/postgres';
const client = new Client({ connectionString: connStr });
client.connect().then(() => {
  client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sync_queue'").then(res => {
    console.log(res.rows);
    client.end();
  });
});
