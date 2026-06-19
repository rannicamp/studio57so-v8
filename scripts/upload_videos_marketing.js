require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Função para localizar a pasta de vídeos de forma robusta a prova de falhas de encoding
function locateVideoDir() {
  const baseDir = "C:\\Users\\ranni\\OneDrive";
  if (!fs.existsSync(baseDir)) {
    throw new Error(`Diretório base do OneDrive não encontrado: ${baseDir}`);
  }
  
  // Listar subdiretórios no OneDrive para encontrar o que bate com S57 INCORPORAÇÕES
  const items = fs.readdirSync(baseDir);
  let targetFolder = null;
  
  for (const item of items) {
    const fullPath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && item.startsWith("S57 INCORPORA")) {
      const candidatePath = path.join(fullPath, "MARKETING", "VIDEOS RANNIERE", "whatsapp");
      if (fs.existsSync(candidatePath)) {
        // Verificar se há arquivos .mp4
        const files = fs.readdirSync(candidatePath);
        const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));
        if (mp4Files.length > 0) {
          targetFolder = candidatePath;
          console.log(`Pasta de vídeos localizada com sucesso: "${targetFolder}" com ${mp4Files.length} vídeos.`);
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

async function uploadVideos() {
  try {
    const videoDir = locateVideoDir();
    const videoFiles = fs.readdirSync(videoDir).filter(f => f.toLowerCase().endsWith('.mp4'));
    
    console.log(`\nBuscando empreendimentos cadastrados no banco de dados...`);
    const { data: empreendimentos, error: empError } = await supabase
      .from('empreendimentos')
      .select('id, nome, organizacao_id');
      
    if (empError) {
      throw new Error(`Erro ao buscar empreendimentos: ${empError.message}`);
    }
    
    console.log(`Encontrados ${empreendimentos.length} empreendimentos.`);
    console.log(`--------------------------------------------------`);
    
    for (const emp of empreendimentos) {
      console.log(`\nProcessando Empreendimento: "${emp.nome}" (ID: ${emp.id}, Org: ${emp.organizacao_id})`);
      
      for (const videoName of videoFiles) {
        const videoPath = path.join(videoDir, videoName);
        const fileBuffer = fs.readFileSync(videoPath);
        const fileSize = fileBuffer.length;
        
        // Caminho no storage do Supabase
        const storagePath = `${emp.id}/anexos/${videoName}`;
        
        console.log(` -> Subindo "${videoName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);
        
        // 1. Upload do arquivo para o bucket
        const { error: uploadError } = await supabase.storage
          .from('empreendimento-anexos')
          .upload(storagePath, fileBuffer, {
            contentType: 'video/mp4',
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) {
          console.error(`    ❌ Erro no upload do arquivo:`, uploadError.message);
          continue;
        }
        
        // 2. Verificar se o registro já existe no banco para evitar duplicados
        const { data: existingAnexos, error: checkError } = await supabase
          .from('empreendimento_anexos')
          .select('id')
          .eq('empreendimento_id', emp.id)
          .eq('caminho_arquivo', storagePath);
          
        if (checkError) {
          console.error(`    ❌ Erro ao checar existência no banco:`, checkError.message);
          continue;
        }
        
        if (existingAnexos && existingAnexos.length > 0) {
          console.log(`    ℹ️  Registro no banco já existe (ID: ${existingAnexos[0].id}). Pulando inserção.`);
          
          // Opcional: garantir que disponivel_corretor esteja true
          await supabase
            .from('empreendimento_anexos')
            .update({ disponivel_corretor: true, pode_enviar_anexo: true })
            .eq('id', existingAnexos[0].id);
            
          continue;
        }
        
        // 3. Criar registro na tabela empreendimento_anexos
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
          console.error(`    ❌ Erro ao registrar no banco de dados:`, insertError.message);
        } else {
          console.log(`    ✅ Sucesso! Vinculado no banco (ID Anexo: ${newAnexo[0].id})`);
        }
      }
      console.log(`--------------------------------------------------`);
    }
    
    console.log(`\n🎉 Processamento concluído com sucesso para todos os vídeos e empreendimentos!`);
    
  } catch (error) {
    console.error("❌ Ocorreu um erro crítico no processo:", error.message);
  }
}

uploadVideos();
