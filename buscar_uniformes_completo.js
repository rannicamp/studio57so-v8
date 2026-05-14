require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function downloadAnexos() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const baseOutputDir = 'A:\\130 e 141';
  if (!fs.existsSync(baseOutputDir)) fs.mkdirSync(baseOutputDir, { recursive: true });

  const downloadFile = async (bucket, caminho, outputDir, fileName) => {
    if (!caminho) return;
    const { data, error } = await supabase.storage.from(bucket).download(caminho);
    if (error) {
      console.log(`Erro ao baixar ${fileName} do bucket ${bucket}:`, error.message);
      return;
    }
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    // Sanitize filename
    const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
    const dest = path.join(outputDir, safeFileName);
    fs.writeFileSync(dest, Buffer.from(await data.arrayBuffer()));
    console.log(`Salvo: ${dest}`);
  };

  // 1. Baixar pedidos específicos (129 e 164)
  console.log("=== Buscando Pedidos 129 e 164 ===");
  const { data: anexosEsp } = await supabase
    .from('pedidos_compra_anexos')
    .select('*')
    .in('pedido_compra_id', [129, 164]);
  
  if (anexosEsp) {
    for (const anexo of anexosEsp) {
      await downloadFile('pedidos-anexos', anexo.caminho_arquivo, path.join(baseOutputDir, `Pedido_${anexo.pedido_compra_id}`), anexo.nome_arquivo);
    }
  }

  // 2. Busca por Palavras-chave
  const keywords = ['uniform', 'calça', 'calca', 'camis'];
  
  // A. Pedidos_Compra_Anexos
  console.log("=== Buscando anexos de pedidos de compras relacionados a uniformes ===");
  const { data: todosAnexosPedidos } = await supabase.from('pedidos_compra_anexos').select('*, pedido:pedidos_compra(titulo, justificativa)');
  
  if (todosAnexosPedidos) {
    for (const anexo of todosAnexosPedidos) {
      if (anexo.pedido_compra_id === 129 || anexo.pedido_compra_id === 164) continue; // já baixou
      
      const textoBuscavel = [
        anexo.nome_arquivo, 
        anexo.descricao, 
        anexo.pedido?.titulo, 
        anexo.pedido?.justificativa
      ].join(' ').toLowerCase();

      if (keywords.some(k => textoBuscavel.includes(k))) {
        await downloadFile('pedidos-anexos', anexo.caminho_arquivo, path.join(baseOutputDir, 'Busca_Uniformes', 'Pedidos'), `Pedido${anexo.pedido_compra_id}_${anexo.nome_arquivo}`);
      }
    }
  }

  // B. Lancamentos_Anexos
  console.log("=== Buscando anexos financeiros (Lançamentos) relacionados a uniformes ===");
  const { data: todosAnexosLanc } = await supabase.from('lancamentos_anexos').select('*, lancamento:lancamentos(descricao, observacao)');
  
  if (todosAnexosLanc) {
    for (const anexo of todosAnexosLanc) {
      const textoBuscavel = [
        anexo.nome_arquivo, 
        anexo.descricao, 
        anexo.lancamento?.descricao, 
        anexo.lancamento?.observacao
      ].join(' ').toLowerCase();

      if (keywords.some(k => textoBuscavel.includes(k))) {
        await downloadFile('documentos-financeiro', anexo.caminho_arquivo, path.join(baseOutputDir, 'Busca_Uniformes', 'Financeiro'), `Lanc${anexo.lancamento_id}_${anexo.nome_arquivo}`);
      }
    }
  }

  console.log("Varredura e download concluídos!");
}

downloadAnexos();
