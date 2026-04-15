import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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
      descricao, 
      contrato_id,
      contrato:contrato_id (
        id,
        contrato_produtos (
          produto:produto_id ( unidade )
        )
      )
    `)
    .not('contrato_id', 'is', null)
    .ilike('descricao', '%ADITIVO%'); // Pegar qualquer aditivo vinculado a contrato que mereça nomear a unidade

  if (error) {
    console.error("Erro na busca:", error);
    process.exit(1);
  }

  let mudancas = 0;
  for (const l of data) {
    const unidades = l.contrato?.contrato_produtos
      ?.map(cp => cp.produto?.unidade)
      .filter(Boolean)
      .join(', ');

    // Se já tiver a unidade na string, ignoramos para não duplicar
    if (unidades && !l.descricao.includes(unidades)) {
      const novaDescricao = `${l.descricao} - Un. ${unidades}`;
      console.log(`Atualizando [ID ${l.id}]:`);
      console.log(`DE:   ${l.descricao}`);
      console.log(`PARA: ${novaDescricao}\n`);

      const { error: errUpdate } = await supabase
        .from('lancamentos')
        .update({ descricao: novaDescricao })
        .eq('id', l.id);

      if (errUpdate) console.error("Erro:", errUpdate);
      else mudancas++;
    }
  }

  console.log(`✅ Sucesso! Total de ${mudancas} registros com "Aditivo" corrigidos e vinculados à unidade.`);
}

run();
