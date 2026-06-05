async function testEnrichment() {
  const contato_id = 5125;
  const organizacao_id = 2;

  console.log(`Disparando chamada HTTP de teste de análise para o contato ${contato_id}...`);
  
  try {
    const response = await globalThis.fetch('http://localhost:3001/api/ai/chat-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contato_id,
        organizacao_id,
        force: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro na requisição (Status ${response.status}):`, errorText);
      return;
    }

    const data = await response.json();
    console.log('Análise retornada com sucesso pela Stella IA:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Falha ao conectar ou executar requisição:', error);
  }
}

testEnrichment();
