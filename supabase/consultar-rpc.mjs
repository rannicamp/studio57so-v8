import { Client } from 'pg';
import fs from 'fs';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Forneça o nome da função. Ex: node supabase/consultar-rpc.mjs nome_da_funcao");
  process.exit(1);
}
const funcName = args[0];

const envFile = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
envFile.split(/\r?\n/).forEach(l => {
  if (l.startsWith('SUPABASE_DATABASE_URL=')) {
    dbUrl = l.substring('SUPABASE_DATABASE_URL='.length).trim().replace(/['"]/g, '');
  }
});

if(!dbUrl) {
    console.error('SUPABASE_DATABASE_URL não encontrada em .env.local');
    process.exit(1);
}

// Ensure the dbUrl works with SSL and pooler
dbUrl = dbUrl.replace(':5432', ':6543');

const client = new Client({ 
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION' 
        AND specific_schema = 'public'
        AND routine_name = $1;
    `, [funcName]);
    
    if (res.rows.length > 0) {
      console.log('--- DEFINIÇÃO DA FUNÇÃO ---');
      console.log(res.rows[0].routine_definition);
      console.log('---------------------------');
    } else {
      console.log(`Função public.${funcName} não encontrada ou não é visível.`);
    }
  } catch(err) {
      console.error(err);
  } finally {
      client.end();
  }
}
run();
