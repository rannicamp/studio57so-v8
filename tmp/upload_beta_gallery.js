require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOCAL_DIR = 'C:\\Users\\ranni\\OneDrive\\S57 INCORPORAÇÕES\\EMPREENDIMENTOS\\BETA SUÍTES\\MARKETING\\CONTEUDO BASE\\RENDER\\REV 2';
const BUCKET = 'empreendimento-anexos';
const STORAGE_PREFIX = '5/anexos/galeria_rev2';

async function uploadGallery() {
  console.log('Iniciando upload das imagens para o Supabase...');
  try {
    const files = fs.readdirSync(LOCAL_DIR);
    const uploadedUrls = [];

    for (const file of files) {
      if (!file.match(/\.(jpeg|jpg|png|webp)$/i)) continue;

      const localPath = path.join(LOCAL_DIR, file);
      const fileBuffer = fs.readFileSync(localPath);
      
      // Sanitizar nome do arquivo para o storage
      const safeName = file.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase();
      const storagePath = `${STORAGE_PREFIX}/${safeName}`;

      console.log(`Fazendo upload de: ${file} ...`);

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: file.toLowerCase().endsWith('png') ? 'image/png' : 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error(`❌ Erro ao subir ${file}:`, error);
      } else {
        const publicUrl = `https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/${BUCKET}/${storagePath}`;
        console.log(`✅ Sucesso: ${publicUrl}`);
        
        uploadedUrls.push({
          id: uploadedUrls.length + 1,
          src: publicUrl,
          alt: file.replace(/\.[^/.]+$/, "").replace(/_/g, ' ')
        });
      }
    }
    
    console.log('\n--- ARRAY DE IMAGENS PARA O FRONTEND ---');
    console.log(JSON.stringify(uploadedUrls, null, 2));

  } catch (err) {
    console.error('Erro fatal:', err);
  }
}

uploadGallery();
