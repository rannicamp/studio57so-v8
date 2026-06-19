const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const urlsToTest = [
  { name: 'Studios Beta Logo (Beta)', url: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944008469.png' },
  { name: 'Residencial Alfa Fachada (Alfa)', url: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759098853021.png' },
  { name: 'Studio 57 Logo Preto (Genérico)', url: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG' }
];

async function run() {
  console.log('=== AUDITORIA DE ATIVOS PÚBLICOS DE IMAGEM ===\n');
  
  for (const item of urlsToTest) {
    console.log(`Testando ativo: "${item.name}"`);
    console.log(`URL: ${item.url}`);
    try {
      const res = await fetch(item.url, { method: 'HEAD' });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        const contentLength = res.headers.get('content-length');
        console.log(` -> SUCESSO! Status: ${res.status}`);
        console.log(` -> Tipo: ${contentType} | Tamanho: ${contentLength} bytes`);
      } else {
        console.error(` -> FALHA! Status: ${res.status}`);
      }
    } catch (err) {
      console.error(` -> ERRO DE REDE: ${err.message}`);
    }
    console.log('----------------------------------------------------');
  }
}

run().catch(console.error);
