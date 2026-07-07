// scratch/detalhar_leads_restantes_entrada.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COLUNAS_ENTRADA = [
  '902f7707-1f11-4fa6-89c3-b15735acfe1d',
  'e8e88027-c7be-4e8c-9667-e17fa4e06ce5'
];

async function main() {
  console.log("=== LEVANTAMENTO DOS LEADS RESTANTES NA ENTRADA ===");

  try {
    // 1. Buscar os contatos no funil nas colunas de Entrada
    const { data: leadsFunil, error: errLf } = await supabase
      .from('contatos_no_funil')
      .select('contato_id, coluna_id, created_at, colunas_funil(nome, funis(nome))')
      .in('coluna_id', COLUNAS_ENTRADA);

    if (errLf) {
      console.error(errLf);
      return;
    }

    console.log(`Leads restantes na Entrada do Funil: ${leadsFunil.length}`);

    const contatoIds = leadsFunil.map(l => l.contato_id);

    // 2. Buscar dados cadastrais dos contatos
    const { data: contatos, error: errC } = await supabase
      .from('contatos')
      .select('id, nome, origem, ia_atendimento_ativo, created_at, meta_form_data')
      .in('id', contatoIds);

    if (errC) {
      console.error(errC);
      return;
    }

    // 3. Buscar telefones
    const { data: telefones, error: errT } = await supabase
      .from('telefones')
      .select('contato_id, telefone')
      .in('contato_id', contatoIds);

    const telefonesMap = new Map(telefones?.map(t => [t.contato_id, t.telefone]) || []);

    // 4. Detalhar situação de cada um
    const listaFinal = contatos.map(c => {
      const lf = leadsFunil.find(l => l.contato_id === c.id);
      const tel = telefonesMap.get(c.id) || 'Sem telefone';
      
      return {
        id: c.id,
        nome: c.nome,
        origem: c.origem || 'Não informada',
        telefone: tel,
        ia_ativa: c.ia_atendimento_ativo,
        data_cadastro: c.created_at,
        funil_nome: lf?.colunas_funil?.funis?.nome || 'Desconhecido',
        coluna_nome: lf?.colunas_funil?.nome || 'Desconhecido'
      };
    });

    console.log("\n--- LISTAGEM DETALHADA ---");
    listaFinal.forEach((l, i) => {
      console.log(`${i+1}. Nome: ${l.nome} (ID: ${l.id})`);
      console.log(`   Origem: ${l.origem} | Fone: ${l.telefone}`);
      console.log(`   Funil: ${l.funil_nome} | Coluna: ${l.coluna_nome}`);
      console.log(`   Piloto Automático: ${l.ia_ativa ? 'Ativo 🤖' : 'Inativo 👤'}`);
      console.log(`   Data de Cadastro: ${l.data_cadastro}`);
      console.log("-".repeat(50));
    });

  } catch (err) {
    console.error("Erro no script:", err);
  }
}

main();
