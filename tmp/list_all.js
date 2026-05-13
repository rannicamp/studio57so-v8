
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
async function listAll() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(supabaseUrl + '/rest/v1/', {
    headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }
  });
  const json = await res.json();
  const tables = Object.keys(json.definitions || {}).sort();
  console.log(tables.join(', '));
}
listAll();

