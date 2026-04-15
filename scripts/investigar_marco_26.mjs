import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('lancamentos')
    .select(`
      id, 
      valor, 
      status, 
      tipo, 
      descricao, 
      data_vencimento, 
      data_pagamento, 
      contrato_id,
      contrato:contrato_id ( numero_contrato, contato:contato_id (nome, razao_social) )
    `)
    .not('contrato_id', 'is', null);

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  // Filtrar rigorosamente como o Frontend: data_pagamento se existir, senao data_vencimento
  const marcoData = data.filter(l => {
    const dataCheck = l.data_pagamento || l.data_vencimento;
    return dataCheck && dataCheck.startsWith('2026-03');
  });

  // Sort by date
  marcoData.sort((a,b) => (a.data_pagamento || a.data_vencimento).localeCompare(b.data_pagamento || b.data_vencimento));

  // Ocultar dados muito internos se necessário, mas para o artefato vamos cuspir o JSON limpo
  const cleanData = marcoData.map(l => ({
    id: l.id,
    contrato: `#${l.contrato_id} (${l.contrato?.numero_contrato || '?'}) - ${l.contrato?.contato?.nome || l.contrato?.contato?.razao_social || 'Desconhecido'}`,
    descricao: l.descricao,
    tipo: l.tipo,
    status: l.status,
    valor: l.valor,
    data_vencimento: l.data_vencimento,
    data_pagamento: l.data_pagamento || 'N/A',
  }));

  fs.writeFileSync('lancamentos_marco.json', JSON.stringify(cleanData, null, 2));
  console.log(`Found ${cleanData.length} records. Saved to lancamentos_marco.json`);
}

run();
