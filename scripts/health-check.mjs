async function run() {
  const url1 = 'https://studio57.arq.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=Srbr19010720@&hub.challenge=teste';
  const url2 = 'https://studio57.netlify.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=Srbr19010720@&hub.challenge=teste';

  console.log("Testando URL 1:", url1);
  try {
    const res1 = await fetch(url1);
    console.log("Status 1:", res1.status, await res1.text());
  } catch(e) { console.error("Erro 1:", e.message); }

  console.log("\nTestando URL 2:", url2);
  try {
    const res2 = await fetch(url2);
    console.log("Status 2:", res2.status, await res2.text());
  } catch(e) { console.error("Erro 2:", e.message); }
}

run();
