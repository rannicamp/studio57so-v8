// scratch/testar_acesso_url.js
async function run() {
  const url = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/book/Book_Investidor_Beta_Suites.pdf';
  console.log(`Testando acesso público à URL real: ${url}`);
  
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Status de retorno (HEAD): ${res.status} (${res.statusText})`);
    
    if (res.ok) {
      console.log("Headers do arquivo:");
      res.headers.forEach((val, key) => console.log(`  ${key}: ${val}`));
      
      const contentLength = res.headers.get('content-length');
      if (contentLength) {
        console.log(`Tamanho do arquivo: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB`);
      }
    } else {
      console.error("Erro: O arquivo real não está acessível publicamente!");
    }
  } catch (err) {
    console.error("Erro de rede:", err.message);
  }
}

run();
