require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const rdoId = 84;
  const fotosExcluir = [
    { id: 342, caminho: "84/1757887437106-133990725541230595.jpg" }
  ];

  console.log(`Iniciando exclusão da foto ID 342 (baleia) do RDO ID ${rdoId}...`);

  // 1. Excluir arquivos físicos do Supabase Storage
  const caminhos = fotosExcluir.map(f => f.caminho);
  console.log(`\nExcluindo arquivos físicos do Storage:`, caminhos);
  const { data: storageData, error: storageError } = await supabase
    .storage
    .from('rdo-fotos')
    .remove(caminhos);

  if (storageError) {
    console.error("Erro ao excluir do Storage:", storageError);
  } else {
    console.log("Arquivos físicos excluídos do Storage com sucesso:", storageData);
  }

  // 2. Excluir registros da tabela rdo_fotos_uploads
  const ids = fotosExcluir.map(f => f.id);
  console.log(`Excluindo registros de fotos com IDs ${ids.join(', ')} no banco...`);
  const { data: deleteFotoData, error: deleteFotoError } = await supabase
    .from('rdo_fotos_uploads')
    .delete()
    .in('id', ids);

  if (deleteFotoError) {
    console.error("Erro ao excluir registros de fotos:", deleteFotoError);
  } else {
    console.log("Registros excluídos do banco com sucesso.");
  }

  // 3. Buscar e atualizar o snapshot_dados do diario_obra_id = 84 se necessário
  console.log(`Buscando snapshot_dados do RDO ID ${rdoId}...`);
  const { data: rdo, error: rdoError } = await supabase
    .from('diarios_obra')
    .select('*')
    .eq('id', rdoId)
    .single();

  if (rdoError) {
    console.error("Erro ao buscar RDO para verificar snapshot:", rdoError);
  } else if (rdo.snapshot_dados) {
    let snapshot = { ...rdo.snapshot_dados };
    let alterado = false;
    
    // Se tiver fotos_do_dia no snapshot, removemos delas
    if (snapshot.fotos_do_dia && Array.isArray(snapshot.fotos_do_dia)) {
      const tamanhoAnterior = snapshot.fotos_do_dia.length;
      snapshot.fotos_do_dia = snapshot.fotos_do_dia.filter(f => !ids.includes(f.id));
      if (snapshot.fotos_do_dia.length !== tamanhoAnterior) {
        console.log(`Removendo as fotos do array 'fotos_do_dia' no snapshot (${tamanhoAnterior} -> ${snapshot.fotos_do_dia.length} fotos)...`);
        alterado = true;
      }
    }

    if (alterado) {
      console.log("Salvando snapshot atualizado no banco...");
      const { data: updateRdoData, error: updateRdoError } = await supabase
        .from('diarios_obra')
        .update({ snapshot_dados: snapshot })
        .eq('id', rdoId);

      if (updateRdoError) {
        console.error("Erro ao atualizar snapshot do RDO:", updateRdoError);
      } else {
        console.log("Snapshot do RDO atualizado com sucesso!");
      }
    } else {
      console.log("Nenhuma alteração de fotos era necessária no snapshot_dados.");
    }
  }

  console.log("\nProcesso finalizado com sucesso!");
}

main();
