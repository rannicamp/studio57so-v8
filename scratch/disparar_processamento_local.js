// scratch/disparar_processamento_local.js
async function run() {
  const url = 'http://localhost:3000/api/ai/stella/process';
  const body = {
    contato_id: 6124,
    organizacao_id: 2
  };
  
  console.log(`Disparando POST local para a Stella: ${url}`);
  console.log("Body:", JSON.stringify(body, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    console.log(`Status de retorno: ${res.status} (${res.statusText})`);
    const data = await res.json();
    console.log("Resposta da API:", JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error("Erro de rede:", err.message);
  }
}

run();
