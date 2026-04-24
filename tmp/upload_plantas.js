require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function processAndUploadPlans() {
  const sourceDir = 'C:\\Users\\ranni\\OneDrive\\S57 INCORPORAÇÕES\\EMPREENDIMENTOS\\BETA SUÍTES\\MARKETING\\CONTEUDO FINAL\\plantas';
  const bucketName = 'empreendimento-anexos';
  
  if (!fs.existsSync(sourceDir)) {
      console.error('Diretório não encontrado:', sourceDir);
      return;
  }

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
  console.log(`Encontrados ${files.length} arquivos para processar.`);

  const results = [];

  for (const file of files) {
    const localPath = path.join(sourceDir, file);
    const fileNameWithoutExt = path.basename(file, path.extname(file));
    const newFileName = `${fileNameWithoutExt.replace(/ /g, '_').toLowerCase()}.webp`;
    const storagePath = `5/anexos/plantas/${newFileName}`;

    console.log(`\nProcessando: ${file}`);
    
    try {
      // Otimiza com Sharp
      const buffer = await sharp(localPath)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
        
      console.log(`Tamanho original: ${fs.statSync(localPath).size / 1024 / 1024} MB -> Novo tamanho: ${buffer.length / 1024 / 1024} MB`);

      // Faz upload
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, buffer, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error(`Erro ao subir ${file}:`, error);
      } else {
        const publicUrl = `https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/${storagePath}`;
        console.log(`Sucesso: ${publicUrl}`);
        results.push({ name: fileNameWithoutExt, url: publicUrl });
      }
    } catch (err) {
        console.error(`Falha no arquivo ${file}:`, err);
    }
  }
  
  // Salva o JSON com os links para usar no React
  fs.writeFileSync(path.join(__dirname, 'plantas_links.json'), JSON.stringify(results, null, 2));
  console.log('\nFinalizado! Links salvos em tmp/plantas_links.json');
}

processAndUploadPlans();
