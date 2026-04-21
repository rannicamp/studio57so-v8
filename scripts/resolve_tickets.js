require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function resolverTickets() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const resolvidos = [
    {
      id: 118,
      status: 'Resolvido',
      comentarios: "Resolvido pelo CEO. (Áudio enviado pelo sistema já não mais aprensenta erros e está funcionando)."
    },
    {
      id: 119,
      status: 'Resolvido',
      comentarios: "Para colocar contas de passivo na despesa, deve-se utilizar o botão dedicado de passivo na aba Passivo."
    },
    {
      id: 120,
      status: 'Resolvido',
      comentarios: "O sistema para visualizar passivos tem gestão isolada num painel próprio, logo não deve mesmo aparecer nessa aba para antecipação cruzada."
    },
    {
      id: 122,
      status: 'Resolvido',
      comentarios: "Alterado o parâmetro 'orientation' de 'portrait' para 'any' no arquivo public/manifest.json para destravar rotação nos tablets."
    },
    {
      id: 117,
      status: 'Em Análise',
      comentarios: "Dúvida Estratégica: Perguntar para o Igor sobre requisitos exatos."
    },
    {
      id: 121,
      status: 'Em Análise',
      comentarios: "Descompasso Server/Client ou Bug Silencioso. Necessário que o CEO faça um teste real atualizando a página com F5. Se o erro persistir, deveremos mapear se a prop 'use server' sumiu no repositório."
    }
  ];

  for(let obj of resolvidos) {
    const { error } = await supabase
      .from('feedback')
      .update({ status: obj.status, comentarios: obj.comentarios })
      .eq('id', obj.id);
    if(error) console.log(error);
  }
  console.log('Tickets Atualizados com Sucesso!');
}
resolverTickets();
