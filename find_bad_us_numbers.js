const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Numeros que comecam com 551 e tem tamanho suspeito (maior que 12 digitos geralmente)
  // Um US number é 1 + 10 = 11. Com 55 na frente fica 13: 55 1 XXX XXX XXXX
  const res1 = await client.query("SELECT id, contato_id, telefone, country_code FROM telefones WHERE telefone LIKE '551%' AND length(telefone) > 11");
  console.log('--- Suspeitos de serem EUA com 55 na frente (length > 11 e começam com 551) ---');
  let count = 0;
  for (const t of res1.rows) {
      // Filtrar celulares reais do BR que podem cair nisso?
      // Celular BR: 55 11 9XXXX XXXX = 13 digitos.
      // 55 (2) + DDD 1X (2) + 9 (1) + 8 = 13 digitos.
      // O terceiro dígito do DDI-telefone seria: 55 [1] [1] [9] -> o 5o char (index 4)
      const isBRMobile = t.telefone.length === 13 && t.telefone[4] === '9';
      if (!isBRMobile) {
          console.log(`ID: ${t.id}, Contato: ${t.contato_id}, Tel: ${t.telefone}, CountryCode: ${t.country_code}`);
          count++;
      }
  }
  console.log(`Total suspeitos encontrados (ignorando celulares de DDD 1x): ${count}`);

  // 2. Numeros com country_code = '+1' mas o telefone tem 55 na frente
  const res2 = await client.query("SELECT id, contato_id, telefone, country_code FROM telefones WHERE country_code = '+1' AND telefone LIKE '55%'");
  console.log('\n--- Numeros com country_code +1 mas que receberam 55 na frente ---');
  console.log(res2.rows);

  await client.end();
}
main();
