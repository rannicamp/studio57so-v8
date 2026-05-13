
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
async function check() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(supabaseUrl + '/rest/v1/', { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } });
  const json = await res.json();
  const permDef = json.definitions.permissoes.properties;
  console.log(Object.keys(permDef));
}
check();

