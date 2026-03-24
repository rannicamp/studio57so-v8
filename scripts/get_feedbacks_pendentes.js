require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getFeedbacks() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('feedback')
    .select('id, descricao, pagina, status, usuario_id, link_opcional, imagem_url, captura_de_tela_url')
    .in('status', ['Novo', 'Em Análise', 'Pendente'])
    .or('diagnostico.is.null,diagnostico.eq.');

  if (error) {
    console.error("Error fetching feedbacks:", error);
    return;
  }

  require('fs').writeFileSync('scripts/feedbacks_raw.json', JSON.stringify(data, null, 2));
  console.log("Feito! " + data.length + " tickets encontrados.");
}

getFeedbacks().catch(console.error);
