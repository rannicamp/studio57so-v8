import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

async function atualizar() {
  await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/feedback?id=eq.95`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'Resolvido' })
  });
  console.log('Ticket 95 marcado como Resolvido com sucesso no BD.');
}
atualizar();
