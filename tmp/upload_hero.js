require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadVideos() {
  const bucketName = 'empreendimento-anexos';
  const folder = '5/anexos';

  const filesToUpload = [
    {
      localPath: 'c:\\Projetos\\studio57so-v8\\tmp\\1774009421304_VIDEO_ORBITA_BETA.mp4',
      storagePath: `${folder}/1774009421304_VIDEO_ORBITA_BETA.mp4`
    },
    {
      localPath: 'c:\\Projetos\\studio57so-v8\\tmp\\1774009421303_VIDEO_BETA_VERTICAL.mp4',
      storagePath: `${folder}/1774009421303_VIDEO_BETA_VERTICAL.mp4`
    }
  ];

  for (const file of filesToUpload) {
    console.log(`Lendo arquivo local: ${file.localPath}`);
    const fileBuffer = fs.readFileSync(file.localPath);

    console.log(`Fazendo upload para Supabase: ${file.storagePath}`);
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(file.storagePath, fileBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: true // Importante para sobrescrever os antigos!
      });

    if (error) {
      console.error(`Erro ao subir ${file.storagePath}:`, error);
    } else {
      console.log(`Sucesso! ${file.storagePath} atualizado.`);
    }
  }
}

uploadVideos().then(() => console.log('Processo de upload concluído.'));
