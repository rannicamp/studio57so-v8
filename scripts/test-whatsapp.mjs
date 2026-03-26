async function run() {
  console.log("⏳ Iniciando teste de disparo outbound...");
  try {
    const response = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+5533991912291',
        type: 'text',
        text: 'Teste final na Filial 2! Devonildo reportando da nave mãe... Câmbio! 🚀 (Pode responder de volta para vermos se cai direto aqui!)',
        organizacao_id: 2
      })
    });
    
    const resText = await response.text();
    console.log(`Status HTTP: ${response.status}`);
    
    try {
        const json = JSON.parse(resText);
        console.log("Resposta da API (JSON):", JSON.stringify(json, null, 2));
    } catch(e) {
        console.log("Resposta da API (Texto):", resText);
    }
  } catch (err) {
    console.error("❌ Erro fatal ao testar:", err.message);
  }
}

run();
