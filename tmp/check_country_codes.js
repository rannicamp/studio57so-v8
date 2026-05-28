const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- CHECAGEM DA COLUNA COUNTRY_CODE ---');

  // 1. Contar null vs preenchidos
  const resCounts = await client.query(`
    SELECT 
      (country_code IS NULL) as is_null,
      count(*) as qtd
    FROM telefones
    GROUP BY is_null;
  `);
  console.log('Preenchimento de country_code na tabela "telefones":');
  resCounts.rows.forEach(r => {
    console.log(` - ${r.is_null ? 'NULO' : 'PREENCHIDO'}: ${r.qtd} registros`);
  });

  // 2. Mostrar os valores preenchidos
  const resValues = await client.query(`
    SELECT country_code, count(*) as qtd
    FROM telefones
    WHERE country_code IS NOT NULL
    GROUP BY country_code
    ORDER BY qtd DESC;
  `);
  console.log('\nValores encontrados em country_code:');
  resValues.rows.forEach(r => {
    console.log(` - "${r.country_code}": ${r.qtd} registros`);
  });

  // 3. Mostrar exemplos de telefones onde country_code é nulo
  const resNullSample = await client.query(`
    SELECT id, telefone, country_code
    FROM telefones
    WHERE country_code IS NULL
    LIMIT 20;
  `);
  console.log('\nAmostra de telefones com country_code NULO:');
  resNullSample.rows.forEach(r => {
    console.log(` - ID: ${r.id} | Telefone original: "${r.telefone}"`);
  });

  await client.end();
}

main();
