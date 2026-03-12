const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: contas } = await supabase.from('contas_financeiras').select('id, nome, tipo');
  const cartaoContas = contas.filter(c => c.tipo === 'Cartão de Crédito');
  const igorAccount = cartaoContas.find(c => c.nome.includes('IGOR')) || cartaoContas[0];

  const { data: lancamentos } = await supabase.from('lancamentos').select('id, descricao, data_transacao, data_vencimento, data_pagamento, valor').eq('conta_id', igorAccount.id).order('data_transacao', { ascending: false }).limit(20);
  
  fs.writeFileSync('db_log.json', JSON.stringify({
    conta: igorAccount,
    lancamentos: lancamentos
  }, null, 2));
}

check();
