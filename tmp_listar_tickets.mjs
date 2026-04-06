import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

async function buscar() {
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/feedback?select=id,status,descricao,pagina`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const data = await res.json();
  fs.writeFileSync('tickets.json', JSON.stringify(data, null, 2));
}

buscar();
