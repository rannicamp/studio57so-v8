const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const sourcePath = 'I:\\2025_002_PERO VAZ\\mapa.png';

(async () => {
  try {
    console.log('Lendo arquivo do drive I:...');
    const fileBuffer = fs.readFileSync(sourcePath);

    if (supabaseUrl && serviceKey) {
      console.log('Enviando para o Supabase...');
      const uploadUrl = `${supabaseUrl}/storage/v1/object/empreendimento-anexos/10/mapa_pero_vaz_manual.png`;
      const fetch = (await import('node-fetch')).default;

      // Deleta anterior
      await fetch(uploadUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${serviceKey}` } }).catch(() => {});

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: fileBuffer,
      });

      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/empreendimento-anexos/10/mapa_pero_vaz_manual.png`;
        console.log(`✅ Upload OK: ${publicUrl}`);
      } else {
        console.error('⚠️ Erro no upload:', await res.text());
      }
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
})();
