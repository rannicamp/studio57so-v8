const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
   const { data: c } = await supabaseAdmin.from('contatos').select('*').limit(1);
   const { data: t } = await supabaseAdmin.from('telefones').select('*').limit(1);
   const { data: e } = await supabaseAdmin.from('emails').select('*').limit(1);
   
   let out = 'SCHEMA CONTATOS: ' + Object.keys(c[0]||{}).join(', ') + '\n';
   out += 'SCHEMA TELEFONES: ' + Object.keys(t[0]||{}).join(', ') + '\n';
   out += 'SCHEMA EMAILS: ' + Object.keys(e[0]||{}).join(', ') + '\n';
   
   fs.writeFileSync('schema_contatos.txt', out);
}
checkSchema();
