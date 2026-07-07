// scratch/listar_todas_colunas.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("=== COLUNAS DO FUNIL COM CONTAGEM DE LEADS ===");
  try {
    const { data: colunas, error: errCol } = await supabase
      .from('colunas_funil')
      .select(`
        id,
        nome,
        funil_id,
        organizacao_id,
        funis (
          nome
        )
      `)
      .order('organizacao_id', { ascending: true });

    if (errCol) {
      console.error("Erro ao buscar colunas:", errCol.message);
      return;
    }

    // Contar leads por coluna_id no banco
    const { data: contagens, error: errCount } = await supabase
      .rpc('executar_sql', {
        sql_query: "SELECT coluna_id, COUNT(*) as qtd FROM public.contatos_no_funil GROUP BY coluna_id"
      });

    const contagemMap = new Map();
    if (contagens) {
      contagens.forEach(c => {
        contagemMap.set(c.coluna_id, c.qtd);
      });
    } else {
      // Se a RPC executar_sql falhar ou não retornar nada, buscamos via supabase.from('contatos_no_funil')
      const { data: todosLeads } = await supabase.from('contatos_no_funil').select('coluna_id');
      if (todosLeads) {
        todosLeads.forEach(l => {
          contagemMap.set(l.coluna_id, (contagemMap.get(l.coluna_id) || 0) + 1);
        });
      }
    }

    colunas.forEach(c => {
      const qtd = contagemMap.get(c.id) || 0;
      console.log(`Org: ${c.organizacao_id} | Funil: ${c.funis?.nome || 'S/F'} | Coluna: [${c.id}] "${c.nome}" -> Leads: ${qtd}`);
    });

  } catch (err) {
    console.error("Erro geral:", err);
  }
}

main();
