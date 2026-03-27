const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/SUPABASE_DATABASE_URL=(.*)/);

if (match) {
  let url = match[1].trim();
  url = url.replace(':5432', ':6543');
  
  const client = new Client({ connectionString: url });
  
  client.connect().then(() => {
    client.query(`
      SELECT tc.table_name, kcu.column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
      WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'contatos';
    `)
      .then(res => { 
          console.log(JSON.stringify(res.rows, null, 2));
          client.end(); 
      })
      .catch(e => { console.error('Query error:', e.message); client.end(); });
  }).catch(e => console.error('Connect error:', e.message));
}
