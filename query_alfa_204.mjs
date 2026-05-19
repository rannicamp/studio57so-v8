import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vhuvnutzklhskkwbpxdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodXZudXR6a2xoc2trd2JweGR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkyNjY0NiwiZXhwIjoyMDY1NTAyNjQ2fQ.wprEVKNDXXIjHJ32fQQnTBGdMdGLBL7SrXUio5-dDXc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: empreendimentos, error: err1 } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .ilike('nome', '%Alfa%');

  if (err1) {
    console.error('Error fetching empreendimentos:', err1);
    return;
  }

  console.log('Empreendimentos:', empreendimentos);

  if (empreendimentos.length > 0) {
    const alfaId = empreendimentos[0].id;
    const { data: unidades, error: err2 } = await supabase
      .from('produtos_empreendimento')
      .select('unidade, valor_base, valor_venda_calculado')
      .eq('empreendimento_id', alfaId)
      .eq('unidade', '204');

    if (err2) {
      console.error('Error fetching unidade 204:', err2);
      return;
    }

    console.log('Unidade 204 data:', unidades);
  }
}

run();
