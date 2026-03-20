import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  console.log('Testando RPC fn_relatorio_comercial para organizacao 1 / 2...');
  
  // Como as conversas reais estavam em 2025-12, vou buscar um range gigante pra gente ver se apita algo real.
  const { data, error } = await supabase.rpc('fn_relatorio_comercial', {
    p_data_inicio: '2025-01-01',
    p_data_fim: '2026-12-31',
    p_organizacao_id: 2
  });

  if (error) {
    console.error('ERRO NA RPC:', error);
  } else {
    console.log('SUCESSO, RETORNO DA RPC:', data);
  }

  const org1 = await supabase.rpc('fn_relatorio_comercial', {
    p_data_inicio: '2025-01-01',
    p_data_fim: '2026-12-31',
    p_organizacao_id: 1
  });
  console.log('Org 1:', org1.data);
}

checkRpc();
