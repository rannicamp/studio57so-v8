require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ALLOWED_PROJECT_IDS = [1, 5, 6]; // Residencial Alfa (1), Beta Suítes (5), Refúgio Braúnas (6)
const VIDEO_NAMES = [
  'S57 - 0106.mp4',
  'S57 - 0406.mp4',
  'S57 - 0906.mp4',
  'S57 - 1106.mp4',
  'S57 - 1606.mp4',
  'S57 - 1806.mp4',
  'S57 - 2805.mp4'
];

// Função para localizar a pasta física de vídeos de forma robusta a prova de falhas de encoding
function locateVideoDir() {
  const baseDir = "C:\\Users\\ranni\\OneDrive";
  const items = fs.readdirSync(baseDir);
  let targetFolder = null;
  
  for (const item of items) {
    const fullPath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && item.startsWith("S57 INCORPORA")) {
      const candidatePath = path.join(fullPath, "MARKETING", "VIDEOS RANNIERE", "whatsapp");
      if (fs.existsSync(candidatePath)) {
        // Verificar se realmente possui os arquivos de vídeo para não pegar pasta errada vazia
        const files = fs.readdirSync(candidatePath);
        const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));
        if (mp4Files.length > 0) {
          targetFolder = candidatePath;
          break;
        }
      }
    }
  }
  
  if (!targetFolder) {
    throw new Error("Não foi possível encontrar a pasta física contendo os vídeos compactados do WhatsApp.");
  }
  return targetFolder;
}

async function saneamentoMarketing() {
  try {
    console.log("=== INICIANDO SANEAMENTO E LIMPEZA DE VÍDEOS DE MARKETING ===");
    
    // 1. LIMPEZA: Buscar todos os anexos de marketing referentes a esses vídeos
    const { data: anexos, error: fetchError } = await supabase
      .from('empreendimento_anexos')
      .select('id, empreendimento_id, caminho_arquivo, nome_arquivo')
      .eq('categoria_aba', 'marketing')
      .in('nome_arquivo', VIDEO_NAMES);
      
    if (fetchError) {
      throw new Error(`Erro ao buscar anexos para limpeza: ${fetchError.message}`);
    }
    
    console.log(`\nEncontrados ${anexos.length} registros totais de vídeos de marketing.`);
    
    // Separar anexos que devem ser excluídos (não estão nos 3 permitidos)
    const anexosParaDeletar = anexos.filter(a => !ALLOWED_PROJECT_IDS.includes(Number(a.empreendimento_id)));
    console.log(`Destes, ${anexosParaDeletar.length} pertencem a empreendimentos não autorizados e serão deletados.`);
    
    for (const anexo of anexosParaDeletar) {
      console.log(`\nLimpando anexo do Empreendimento ID: ${anexo.empreendimento_id} (${anexo.nome_arquivo})...`);
      
      // Deletar do Storage
      const { error: storageError } = await supabase.storage
        .from('empreendimento-anexos')
        .remove([anexo.caminho_arquivo]);
        
      if (storageError) {
        console.warn(`    ⚠️  Aviso ao deletar do Storage (pode já ter sido removido):`, storageError.message);
      } else {
        console.log(`    🗑️  Arquivo removido do Storage: "${anexo.caminho_arquivo}"`);
      }
      
      // Deletar do Banco de Dados
      const { error: dbError } = await supabase
        .from('empreendimento_anexos')
        .delete()
        .eq('id', anexo.id);
        
      if (dbError) {
        console.error(`    ❌ Erro ao deletar registro do Banco (ID: ${anexo.id}):`, dbError.message);
      } else {
        console.log(`    🗑️  Registro deletado do Banco de Dados (ID Anexo: ${anexo.id})`);
      }
    }
    
    console.log(`\n=== LIMPEZA CONCLUÍDA ===`);
    console.log(`--------------------------------------------------`);
    
    // 2. COMPLEMENTAÇÃO / ATUALIZAÇÃO: Garantir que os 3 autorizados tenham os 7 vídeos completos
    console.log(`\n=== GARANTINDO VIDEOS COMPLETOS NOS 3 EMPREENDIMENTOS AUTORIZADOS ===`);
    
    const videoDir = locateVideoDir();
    console.log(`Pasta física correta de vídeos: "${videoDir}"`);
    
    // Buscar os dados de cada um dos 3 empreendimentos autorizados
    const { data: empreendimentos, error: empError } = await supabase
      .from('empreendimentos')
      .select('id, nome, organizacao_id')
      .in('id', ALLOWED_PROJECT_IDS);
      
    if (empError) {
      throw new Error(`Erro ao buscar empreendimentos autorizados: ${empError.message}`);
    }
    
    for (const emp of empreendimentos) {
      console.log(`\nVerificando Empreendimento Autorizado: "${emp.nome}" (ID: ${emp.id}, Org: ${emp.organizacao_id})`);
      
      for (const videoName of VIDEO_NAMES) {
        const videoPath = path.join(videoDir, videoName);
        if (!fs.existsSync(videoPath)) {
          console.warn(`    ⚠️  Arquivo local não encontrado: ${videoName}`);
          continue;
        }
        
        const fileBuffer = fs.readFileSync(videoPath);
        const fileSize = fileBuffer.length;
        const storagePath = `${emp.id}/anexos/${videoName}`;
        
        // Verificar se já existe registro
        const { data: existing, error: checkError } = await supabase
          .from('empreendimento_anexos')
          .select('id')
          .eq('empreendimento_id', emp.id)
          .eq('caminho_arquivo', storagePath);
          
        if (checkError) {
          console.error(`    ❌ Erro ao checar anexo:`, checkError.message);
          continue;
        }
        
        if (existing && existing.length > 0) {
          console.log(`    ✔️  "${videoName}" já existe (ID Anexo: ${existing[0].id}). Garantindo flags de acesso...`);
          // Garantir flags
          await supabase
            .from('empreendimento_anexos')
            .update({ disponivel_corretor: true, pode_enviar_anexo: true })
            .eq('id', existing[0].id);
          continue;
        }
        
        // Fazer upload se não existir
        console.log(`    -> Subindo "${videoName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);
        const { error: uploadError } = await supabase.storage
          .from('empreendimento-anexos')
          .upload(storagePath, fileBuffer, {
            contentType: 'video/mp4',
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) {
          console.error(`    ❌ Erro no upload:`, uploadError.message);
          continue;
        }
        
        // Inserir registro no banco
        const { data: newAnexo, error: insertError } = await supabase
          .from('empreendimento_anexos')
          .insert({
            empreendimento_id: emp.id,
            caminho_arquivo: storagePath,
            nome_arquivo: videoName,
            titulo: videoName.replace('.mp4', ''),
            descricao: 'Vídeo compactado de marketing para compartilhamento via WhatsApp.',
            categoria_aba: 'marketing',
            disponivel_corretor: true,
            pode_enviar_anexo: true,
            status: 'Aprovado',
            organizacao_id: emp.organizacao_id,
            created_at: new Date()
          })
          .select();
          
        if (insertError) {
          console.error(`    ❌ Erro ao inserir no banco:`, insertError.message);
        } else {
          console.log(`    ✅ Sucesso! Vinculado no banco (ID Anexo: ${newAnexo[0].id})`);
        }
      }
    }
    
    console.log(`\n🎉 Saneamento e preenchimento finalizados com total sucesso!`);
    
  } catch (error) {
    console.error("❌ Ocorreu um erro crítico no saneamento:", error.message);
  }
}

saneamentoMarketing();
