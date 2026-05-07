require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function extracao() {
  const empId = 6;
  const { data: emp } = await supabase.from('empreendimentos').select('*').eq('id', empId).single();
  const { data: produtos } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', empId).order('unidade', { ascending: true });
  const { data: confs } = await supabase.from('configuracoes_venda').select('*').eq('empreendimento_id', empId).single();
  const { data: anexos } = await supabase.from('empreendimento_anexos').select('*').eq('empreendimento_id', empId);
  
  console.log('=== EMPREENDIMENTO ===');
  console.log(JSON.stringify(emp, null, 2));

  console.log('\n=== PRODUTOS (LOTES) ===');
  console.log('Total encontrados:', produtos?.length);
  if (produtos && produtos.length > 0) {
    produtos.forEach(p => {
       console.log('Lote ' + p.unidade + ' | Matrícula: ' + (p.matricula || p.matricula_individual || p.descricao || 'N/A') + ' | Status: ' + p.status + ' | Área: ' + p.area_m2 + 'm² | Valor: R$ ' + p.valor_venda_calculado);
    });
  }

  console.log('\n=== CONFIGS DE VENDA ===');
  console.log(JSON.stringify(confs, null, 2));

  console.log('\n=== ANEXOS ===');
  if (anexos && anexos.length > 0) {
    anexos.forEach(a => console.log('- ' + a.nome_arquivo + ' | ' + a.caminho_arquivo));
  }
}
extracao();
