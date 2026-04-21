const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const payload = {
    descricao: "Teste Receita OFX",
    valor: 1500.00,
    tipo: "Receita",
    conta_id: 11, // Replace with an existing conta_id
    organizacao_id: 2,
    status: "Pago",
    data_transacao: "2025-05-10",
    data_pagamento: "2025-05-10",
    fitid_banco: "TEST_FITID_123"
  };
  const { data, error } = await supabase.from('lancamentos').insert(payload).select();
  console.log({data, error});
}
test();
