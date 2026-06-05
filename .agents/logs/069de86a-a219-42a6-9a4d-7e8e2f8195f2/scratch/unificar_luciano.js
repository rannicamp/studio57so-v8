const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- UNIFICANDO CONTATOS DUPLICADOS (LUCIANO ALVERNAZ) ---');

  try {
    await client.query('BEGIN');

    // 1. Atualizar mensagens de whatsapp_messages
    const resMsg = await client.query(`
      UPDATE whatsapp_messages 
      SET contato_id = 5630 
      WHERE contato_id = 5629;
    `);
    console.log(`1. Mensagens atualizadas: ${resMsg.rowCount} registros.`);

    // 2. Atualizar whatsapp_conversations
    const resConv = await client.query(`
      UPDATE whatsapp_conversations 
      SET contato_id = 5630 
      WHERE contato_id = 5629;
    `);
    console.log(`2. Conversas atualizadas: ${resConv.rowCount} registros.`);

    // 3. Remover telefones do contato duplicado
    const resTel = await client.query(`
      DELETE FROM telefones 
      WHERE contato_id = 5629;
    `);
    console.log(`3. Telefones deletados: ${resTel.rowCount} registros.`);

    // 4. Remover o contato duplicado 5629
    const resContato = await client.query(`
      DELETE FROM contatos 
      WHERE id = 5629;
    `);
    console.log(`4. Contato duplicado (5629) deletado: ${resContato.rowCount} registros.`);

    await client.query('COMMIT');
    console.log('\n--- UNIFICAÇÃO CONCLUÍDA COM SUCESSO! ---');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao realizar a transação de unificação:', error);
  } finally {
    await client.end();
  }
}

main();
