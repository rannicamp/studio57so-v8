// scratch/investigar_desativacao_piloto.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ids = [5976, 6120, 6124, 6127, 6125];

async function main() {
  console.log("=== INVESTIGANDO DESATIVAÇÃO DE PILOTO AUTOMÁTICO ===");

  const { data: contatos, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, origem, created_at, objetivo, renda_familiar, fgts')
    .in('id', ids);

  if (errC) {
    console.error("Erro ao buscar contatos:", errC);
    return;
  }

  // Buscar histórico de notas do CRM para esses leads para ver quem/o que alterou
  const { data: notas, error: errN } = await supabase
    .from('crm_notas')
    .select('contato_id, conteudo, criado_em, usuario_id, usuarios(nome)')
    .in('contato_id', ids)
    .order('criado_em', { ascending: true });

  // Buscar informações do funil detalhadas
  const { data: funil, error: errF } = await supabase
    .from('contatos_no_funil')
    .select('*')
    .in('contato_id', ids);

  if (errF) {
    console.error("Erro ao carregar funil:", errF);
  }

  const funilMap = new Map((funil || []).map(f => [f.contato_id, f]));

  const notasMap = new Map();
  (notas || []).forEach(n => {
    if (!notasMap.has(n.contato_id)) {
      notasMap.set(n.contato_id, []);
    }
    notasMap.get(n.contato_id).push(n);
  });

  for (const contato of contatos) {
    const fData = funilMap.get(contato.id);
    console.log(`\n======================================================`);
    console.log(`Lead: ${contato.nome} (ID: ${contato.id})`);
    console.log(`Piloto Automático Atual: ${contato.ia_atendimento_ativo ? 'LIGADO 🤖' : 'DESLIGADO 👤'}`);
    console.log(`Ficha: Objetivo: ${contato.objetivo} | Renda: ${contato.renda_familiar} | FGTS: ${contato.fgts}`);
    console.log(`Funil:`, fData ? JSON.stringify(fData) : 'Sem registro de funil');
    console.log(`------------------------------------------------------`);
    console.log(`Histórico de Notas do CRM:`);
    
    const leadNotas = notasMap.get(contato.id) || [];
    if (leadNotas.length === 0) {
      console.log("   Nenhuma nota registrada.");
    } else {
      leadNotas.forEach(n => {
        console.log(`   [${n.criado_em}] [Alterado por: ${n.usuarios?.nome || 'Sistema'}]`);
        console.log(`   Conteúdo: "${n.conteudo.trim()}"`);
        console.log(`   ---`);
      });
    }
  }
}

main();
