const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const sourcePath = 'I:\\2025_002_PERO VAZ\\Book_Residencial_Pero_Vaz .pdf';

(async () => {
  try {
    console.log('Lendo PDF do drive I:...');
    const fileBuffer = fs.readFileSync(sourcePath);

    if (supabaseUrl && serviceKey) {
      console.log('Enviando para o Supabase...');
      const uploadUrl = `${supabaseUrl}/storage/v1/object/empreendimento-anexos/10/book/Book_Residencial_Pero_Vaz.pdf`;
      const fetch = (await import('node-fetch')).default;

      // Deleta anterior
      await fetch(uploadUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${serviceKey}` } }).catch(() => {});

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/pdf',
          'x-upsert': 'true',
        },
        body: fileBuffer,
      });

      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/empreendimento-anexos/10/book/Book_Residencial_Pero_Vaz.pdf`;
        console.log(`✅ Upload OK: ${publicUrl}`);
      } else {
        console.error('⚠️ Erro no upload:', await res.text());
      }
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
})();
