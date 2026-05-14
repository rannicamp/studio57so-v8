require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function downloadAnexos() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const pedidos = [130, 141];
  const outputDir = 'A:\\130 e 141';

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const { data: anexos, error } = await supabase
    .from('pedidos_compra_anexos')
    .select('*')
    .in('pedido_compra_id', pedidos);

  if (error) {
    console.error("Erro ao buscar anexos:", error);
    return;
  }

  console.log(`Encontrados ${anexos.length} anexos para os pedidos ${pedidos.join(', ')}.`);

  for (const anexo of anexos) {
    console.log(`Baixando: ${anexo.nome_arquivo} (Pedido #${anexo.pedido_compra_id})...`);
    const { data, error: downloadError } = await supabase.storage
      .from('pedidos-anexos')
      .download(anexo.caminho_arquivo);

    if (downloadError) {
      console.error(`Erro ao baixar ${anexo.nome_arquivo}:`, downloadError);
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const pedidoDir = path.join(outputDir, `Pedido_${anexo.pedido_compra_id}`);
    if (!fs.existsSync(pedidoDir)) {
      fs.mkdirSync(pedidoDir, { recursive: true });
    }

    const safeFileName = anexo.nome_arquivo.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(pedidoDir, safeFileName);
    fs.writeFileSync(filePath, buffer);
    console.log(`Salvo: ${filePath}`);
  }

  console.log("Download concluído com sucesso!");
}

downloadAnexos();
