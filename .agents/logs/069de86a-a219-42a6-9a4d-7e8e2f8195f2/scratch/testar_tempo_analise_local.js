async function testarTempoLocal() {
  console.log('Iniciando chamada direta de análise de chat local com MODO RÁPIDO (quickResponse: true)...');
  const start = Date.now();
  try {
    const response = await fetch('http://localhost:3000/api/ai/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contato_id: 5598, 
        organizacao_id: 2, 
        force: true, 
        quickResponse: true 
      })
    });

    const duration = (Date.now() - start) / 1000;
    console.log(`Resposta local recebida em ${duration} segundos. Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Resultado da IA com sucesso!');
      console.log('--- Resposta sugerida pela Stella ---');
      console.log(data.proxima_resposta_sugerida);
      console.log('------------------------------------');
      console.log('Anexo sugerido:', data.anexo_sugerido);
    } else {
      console.error('Erro na resposta:', await response.text());
    }
  } catch (err) {
    console.error('Erro ao conectar:', err.message);
  }
}

testarTempoLocal();
