const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const to = '5533991912291';
  const type = 'video';
  const link = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/1774009421304_VIDEO_ORBITA_BETA.mp4';
  const caption = 'Vídeo Orbit A Beta (Otimizado)';
  const contact_id = 5598;
  const organizacao_id = 2;

  console.log(`Verificando se o arquivo está acessível e confirmando tamanho...`);
  try {
    const headRes = await fetch(link, { method: 'HEAD' });
    const contentLength = headRes.headers.get('content-length');
    if (contentLength) {
      const sizeMb = parseInt(contentLength, 10) / (1024 * 1024);
      console.log(`Confirmado! O tamanho atual do arquivo no Storage é de ${sizeMb.toFixed(2)} MB.`);
    } else {
      console.log('Não foi possível obter o tamanho do arquivo via HEAD request.');
    }
  } catch (err) {
    console.error('Erro ao verificar tamanho do arquivo:', err.message);
  }

  console.log(`Disparando requisição POST para a API local de envio...`);
  try {
    const response = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to,
        type,
        link,
        caption,
        contact_id,
        organizacao_id
      })
    });

    const responseData = await response.json();
    console.log(`Status de Retorno da API: ${response.status}`);
    console.log('Dados de Retorno:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n--- SUCESSO! O anexo de vídeo foi enviado com sucesso via API local! ---');
    } else {
      console.log('\n--- ERRO: A API local retornou uma falha no envio. ---');
    }
  } catch (err) {
    console.error('Erro ao fazer a requisição para a API local:', err.message);
  }
}

main();
