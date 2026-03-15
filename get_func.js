require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yeyvffolghowihkrtpke.supabase.co');
const ref = url.hostname.split('.')[0];
const pgUrl = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${ref}.supabase.co:5432/postgres`;

const client = new Client({ connectionString: pgUrl });
client.connect().then(() => {
   client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_quantitativos_orcamentacao_bim';")
     .then(res => {
         require('fs').writeFileSync('live_func.sql', res.rows[0].pg_get_functiondef);
         console.log('Salvo em live_func.sql logado com sucesso');
         client.end();
     })
     .catch(err => { console.error('Error query', err); client.end(); });
}).catch(console.error);
