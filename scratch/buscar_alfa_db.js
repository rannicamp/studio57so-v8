require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("=== BUSCANDO EMPREENDIMENTOS ===");
  const { data: emps, error: errE } = await supabase
    .from('empreendimentos')
    .select('*');
    
  if (errE) {
    console.error("Erro empreendimentos:", errE);
  } else {
    console.log("Todos os empreendimentos encontrados:", emps);
  }

  // Se acharmos o ID do Residencial Alfa, vamos buscar a contagem e valores na tabela produtos_empreendimento
  const alfa = emps?.find(e => e.nome.toLowerCase().includes('alfa'));
  if (alfa) {
    console.log(`\n=== PRODUTOS DO EMPREENDIMENTO ${alfa.nome} (ID ${alfa.id}) ===`);
    const { data: prods, error: errP } = await supabase
      .from('produtos_empreendimento')
      .select('*')
      .eq('empreendimento_id', alfa.id);
      
    if (errP) {
      console.error("Erro produtos:", errP);
    } else {
      console.log(`Total de produtos/unidades encontrados: ${prods.length}`);
      
      const disponiveis = prods.filter(p => p.status === 'Disponível');
      const reservados = prods.filter(p => p.status === 'Reservado');
      const vendidos = prods.filter(p => p.status === 'Vendido');
      
      console.log(`- Disponíveis: ${disponiveis.length}`);
      console.log(`- Reservados: ${reservados.length}`);
      console.log(`- Vendidos: ${vendidos.length}`);
      
      // Calcular VGV total
      const vgvTotal = prods.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
      console.log(`- VGV Total calculado: R$ ${vgvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      
      if (prods.length > 0) {
        console.log(`- Ticket Médio calculado: R$ ${(vgvTotal / prods.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      }
    }
  }
}

run();
