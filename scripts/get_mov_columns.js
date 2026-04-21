const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function investigate() {
  try {
     const { data: movData } = await supabase
            .from('movimentacoes_estoque')
            .select('*')
            .limit(1);
     console.log("Colunas de movimentacoes_estoque:", Object.keys(movData[0]));
  } catch(e) {
     console.error(e);
  }
}

investigate();
