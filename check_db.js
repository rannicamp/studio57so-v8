const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Buscando contas de cartão de crédito no banco, ignorando RLS...');
  const { data: contas, error: errC } = await supabase.from('contas_financeiras').select('id, nome, tipo').limit(15);
  if (errC) return console.error(errC);
  
  const cartaoContas = contas.filter(c => c.tipo === 'Cartão de Crédito');
  if (cartaoContas && cartaoContas.length > 0) {
    const contasList = cartaoContas.map(c => `${c.nome} (Igor: ${c.nome.includes('IGOR')}) -> ID: ${c.id}`);
    console.log('\nContas de cartão:\n', contasList.join('\n'));

    const igorAccount = cartaoContas.find(c => c.nome.includes('IGOR')) || cartaoContas[0];

    console.log('\nBuscando lançamentos para a conta de cartão:', igorAccount.nome);
    const { data: lancamentos, error: errL } = await supabase.from('lancamentos').select('id, descricao, data_transacao, data_vencimento, data_pagamento, valor').eq('conta_id', igorAccount.id).order('data_transacao', { ascending: false }).limit(20);
    if (errL) return console.error(errL);
    
    console.log('Total de Lançamentos últimos 20 encontrados:', lancamentos.length);
    if (lancamentos.length > 0) {
      console.table(lancamentos);
    } else {
        console.log('Nenhum lançamento encontrado para esta conta!');
    }
  } else {
      console.log('Nenhuma conta de cartão encontrada nas primeiras 15 contas!');
  }
}

check();
