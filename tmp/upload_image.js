require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadImage() {
  const bucketName = 'empreendimento-anexos';
  const storagePath = `5/anexos/beta_sunset_bairro.jpeg`;
  const localPath = 'C:\\Users\\ranni\\OneDrive\\Área de Trabalho\\A_photorealistic_cinematic_202604241025.jpeg';

  try {
    const fileBuffer = fs.readFileSync(localPath);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error(`Erro ao subir:`, error);
    } else {
      console.log(`Sucesso! URL: https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/${storagePath}`);
    }
  } catch (err) {
      console.error('File not found or error:', err);
  }
}
uploadImage();
