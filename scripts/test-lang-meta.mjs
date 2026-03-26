import fetch from 'node-fetch';

async function test(lang) {
  const payload = {
    to: '553391912291',
    type: 'template',
    templateName: 'novo_lead_beta_eua', 
    languageCode: lang,
    components: [{type: 'body', parameters: [{type: 'text', text: 'Devonildo'}]}],
    organizacao_id: 2
  };
  
  console.log(`\nEnviando req local com languageCode='${lang}' ...`);
  try {
    const res = await fetch('http://localhost:3000/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    // Ler o res.json() para pegar resposta exata do /api/send
    const data = await res.json();
    console.log(`Status HTTP Local: ${res.status}`);
    console.log(`Resposta Local:`, JSON.stringify(data));
  } catch(e) {
    console.error("Erro no fetch:", e);
  }
}

async function run() {
    await test('pt_BR');
    await test('en');
}
run();
