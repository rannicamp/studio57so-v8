const { Client } = require('pg'); 
require('dotenv').config({ path: '.env.local' }); 

const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL }); 
client.connect().then(() => { 
  client.query("SELECT pg_get_functiondef(p.oid) as def FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_lancamentos_avancado';")
  .then(res => { 
    if(res.rows.length > 0) {
      console.log('RPC body length:', res.rows[0].def.length); 
      require('fs').writeFileSync('rpc_body.sql', res.rows[0].def); 
    } else {
      console.log("No RPC found");
    }
    client.end(); 
  }).catch(e => { console.error(e); client.end() }); 
});
