const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- INSPEÇÃO DE ESTRUTURA PARA FILTRO DE PAÍSES ---');

  // 1. Verificar colunas da tabela telefones
  const colsRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'telefones';
  `);
  console.log('\nColunas da tabela "telefones":');
  colsRes.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

  // 2. Verificar colunas da tabela whatsapp_conversations
  const convColsRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'whatsapp_conversations';
  `);
  console.log('\nColunas da tabela "whatsapp_conversations":');
  convColsRes.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

  // 3. Contar formatos de telefones armazenados
  const sampleRes = await client.query(`
    SELECT 
      left(regexp_replace(telefone, '[^0-9]', '', 'g'), 2) as prefix2,
      count(*) as qtd
    FROM telefones
    GROUP BY prefix2
    ORDER BY qtd DESC;
  `);
  console.log('\nDistribuição dos prefixos de telefone (primeiros 2 dígitos limpos):');
  sampleRes.rows.forEach(r => console.log(` Prefixo "${r.prefix2}": ${r.qtd} números`));

  await client.end();
}

main();
