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
    .ilike('descricao', '% - AP %');

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

    if (unidades) {
      // Exemplo: Substituir " - AP 402 |" por " - Un. 402, Garagem 05 |"
      const regex = / - AP .*? \|/;
      if (regex.test(l.descricao)) {
        const novaDescricao = l.descricao.replace(regex, ` - Un. ${unidades} |`);
        
        console.log(`[ID ${l.id}]`);
        console.log(`DE  : ${l.descricao}`);
        console.log(`PARA: ${novaDescricao}\n`);

        const { error: errUpdate } = await supabase
          .from('lancamentos')
          .update({ descricao: novaDescricao })
          .eq('id', l.id);

        if (!errUpdate) mudancas++;
      }
    }
  }
  
  console.log(`✅ Sucesso! Total de ${mudancas} registros antigos com "AP" corrigidos para o padrão Ouro.`);
}

run();
