import fetch from 'node-fetch';

async function test() {
  const payload = {
    to: '553391912291',
    type: 'template',
    templateName: 'hello_world', // Tem sempre esse aprovado
    languageCode: 'en_US',
    components: [],
    organizacao_id: 2
  };
  
  console.log("Enviando requisição local para /api/whatsapp/send ...");
  try {
    const res = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log("Status da API Local:", res.status);
    console.log("Resposta JSON:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("Erro no fetch local:", e);
  }
}
test();
