require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function resolveTickets() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const idsToResolve = [59];
  const { data, error } = await supabase
    .from('feedback')
    .update({ status: 'Concluído' })
    .in('id', idsToResolve);
  if (error) console.error(error);
  else console.log('Resolved', idsToResolve);
}
resolveTickets();
