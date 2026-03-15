require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yeyvffolghowihkrtpke.supabase.co');
const ref = url.hostname.split('.')[0];
const pgUrl = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${ref}.supabase.co:5432/postgres`;

const client = new Client({ connectionString: pgUrl });
client.connect().then(() => {
   const sql = fs.readFileSync('live_func.sql', 'utf8');
   client.query(sql)
     .then(res => {
         console.log('Função atualizada com sucesso no banco mestre!');
         client.end();
     })
     .catch(err => { console.error('Error executing sql', err); client.end(); });
}).catch(console.error);
