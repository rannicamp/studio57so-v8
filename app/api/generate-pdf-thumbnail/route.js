import { createClient } from '@/utils/supabase/server';
import { fromPath } from 'pdf2pic';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export async function POST(req) {
  console.log("API de thumbnail de PDF iniciada.");
  const { anexo } = await req.json();

  if (!anexo || !anexo.caminho_arquivo || !anexo.id) {
    console.error("Erro: Dados do anexo ausentes.");
    return new Response(JSON.stringify({ error: 'Dados do anexo ausentes.' }), { status: 400 });
  }

  if (!anexo.nome_arquivo.toLowerCase().endsWith('.pdf')) {
    console.log("Arquivo não é um PDF. Ignorando.");
    return new Response(JSON.stringify({ message: 'Não é um PDF, ignorando.' }), { status: 200 });
  }

  const supabase = await createClient();
  let tempDir; // Declarar aqui para usar no finally

  try {
    console.log(`[Anexo ID: ${anexo.id}] Passo 1: Baixando o PDF...`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('empreendimento-anexos')
      .download(anexo.caminho_arquivo);

    if (downloadError) throw downloadError;
    console.log(`[Anexo ID: ${anexo.id}] PDF baixado com sucesso.`);

    console.log(`[Anexo ID: ${anexo.id}] Passo 2: Salvando PDF temporariamente...`);
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'));
    const tempPdfPath = path.join(tempDir, anexo.nome_arquivo);
    await fs.writeFile(tempPdfPath, Buffer.from(await fileData.arrayBuffer()));
    console.log(`[Anexo ID: ${anexo.id}] PDF salvo em: ${tempPdfPath}`);

    console.log(`[Anexo ID: ${anexo.id}] Passo 3: Configurando a conversão...`);
    const options = {
      density: 150,
      saveFilename: `thumb_${anexo.id}`,
      savePath: tempDir,
      format: 'png',
      width: 600,
      height: 849
    };
    const convert = fromPath(tempPdfPath, options);

    console.log(`[Anexo ID: ${anexo.id}] Passo 4: Convertendo a primeira página... (Esta parte pode travar)`);
    const result = await convert(1, { responseType: 'base64' });
    console.log(`[Anexo ID: ${anexo.id}] Conversão para imagem concluída.`);

    const imageBuffer = Buffer.from(result.base64, 'base64');
    const thumbnailPath = `public-thumbnails/${anexo.empreendimento_id}/thumb_${anexo.id}.png`;

    console.log(`[Anexo ID: ${anexo.id}] Passo 5: Enviando thumbnail para o Storage...`);
    const { error: uploadError } = await supabase.storage
      .from('empreendimento-anexos')
      .upload(thumbnailPath, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });
      
    if (uploadError) throw uploadError;
    console.log(`[Anexo ID: ${anexo.id}] Thumbnail enviado com sucesso.`);

    console.log(`[Anexo ID: ${anexo.id}] Passo 6: Atualizando banco de dados...`);
    const { data: { publicUrl } } = supabase.storage
      .from('empreendimento-anexos')
      .getPublicUrl(thumbnailPath);

    const { error: dbError } = await supabase
      .from('empreendimento_anexos')
      .update({ thumbnail_url: publicUrl })
      .eq('id', anexo.id);

    if (dbError) throw dbError;
    console.log(`[Anexo ID: ${anexo.id}] Banco de dados atualizado.`);
    
    return new Response(JSON.stringify({ success: true, thumbnailUrl: publicUrl }), { status: 200 });

  } catch (error) {
    console.error(`[Anexo ID: ${anexo.id}] ERRO GERAL NO PROCESSO:`, error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  } finally {
    // 7. Limpar arquivos temporários
    if (tempDir) {
      console.log(`[Anexo ID: ${anexo.id}] Passo 7: Limpando arquivos temporários...`);
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`[Anexo ID: ${anexo.id}] Limpeza concluída.`);
    }
  }
}