async function testarTempo() {
  console.log('Iniciando chamada direta de análise de chat em produção...');
  const start = Date.now();
  try {
    const response = await fetch('https://studio57.arq.br/api/ai/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contato_id: 5598, organizacao_id: 2, force: true })
    });

    const duration = (Date.now() - start) / 1000;
    console.log(`Resposta recebida em ${duration} segundos. Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Resultado da IA com sucesso!');
      console.log(`Próxima resposta: "${data.proxima_resposta_sugerida}"`);
    } else {
      console.error('Erro na resposta:', await response.text());
    }
  } catch (err) {
    console.error('Erro ao conectar:', err.message);
  }
}

testarTempo();
