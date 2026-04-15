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
    .not('contrato_id', 'is', null);

  if (error) {
    console.error("Erro na busca:", error);
    process.exit(1);
  }

  let mudancas = 0;
  for (const l of data) {
    // Detecta as descrições vazias entres os hifens e pipes
    if (l.descricao && (l.descricao.includes(' -  |') || l.descricao.includes(' - |'))) {
      
      const unidades = l.contrato?.contrato_produtos
        ?.map(cp => cp.produto?.unidade)
        .filter(Boolean)
        .join(', ');

      if (unidades) {
        let novaDesc = l.descricao.replace(' -  |', ` - Un. ${unidades} |`);
        novaDesc = novaDesc.replace(' - |', ` - Un. ${unidades} |`);
        
        console.log(`\nAtualizando Lançamento ID ${l.id} (Contrato #${l.contrato_id})...`);
        console.log(`  DE:   ${l.descricao}`);
        console.log(`  PARA: ${novaDesc}`);
        
        // Realizar o UPDATE no Supabase
        const { error: errUpdate } = await supabase
          .from('lancamentos')
          .update({ descricao: novaDesc })
          .eq('id', l.id);

        if (errUpdate) console.error("Erro ao atualizar:", errUpdate);
        else mudancas++;
      }
    }
  }
  
  console.log(`\n✅ Sucesso! Total de ${mudancas} descrições corrigidas no banco de dados em tempo real.`);
}

run();
