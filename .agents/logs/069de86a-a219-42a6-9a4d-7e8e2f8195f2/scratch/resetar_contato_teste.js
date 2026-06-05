const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  const contato_id = 5598;
  console.log(`Iniciando reset seguro simplificado do contato ID ${contato_id} (Ranniere)...`);

  try {
    // 1. Desvincular última mensagem na tabela de conversas para evitar quebras de FK
    console.log('1. Desvinculando última mensagem da conversa...');
    await client.query(`
      UPDATE whatsapp_conversations 
      SET last_message_id = NULL 
      WHERE contato_id = $1;
    `, [contato_id]);

    // 2. Deletar todas as mensagens do contato
    console.log('2. Deletando todas as mensagens de whatsapp_messages...');
    const delMsgRes = await client.query(`
      DELETE FROM whatsapp_messages 
      WHERE contato_id = $1;
    `, [contato_id]);
    console.log(`   -> Deletadas ${delMsgRes.rowCount} mensagens.`);

    // 3. Resetar dados cadastrais do contato na tabela contatos
    console.log('3. Resetando colunas cadastrais na tabela contatos...');
    await client.query(`
      UPDATE contatos
      SET 
        nome = 'Ranniere',
        cpf = NULL,
        cnpj = NULL,
        rg = NULL,
        nacionalidade = NULL,
        estado_civil = NULL,
        cargo = NULL,
        renda_familiar = NULL,
        fgts = NULL,
        mais_de_3_anos_clt = NULL,
        observations = 'Lead de teste resetado para simular primeiro contato',
        birth_date = NULL,
        cep = NULL,
        address_street = NULL,
        address_number = NULL,
        address_complement = NULL,
        neighborhood = NULL,
        city = NULL,
        state = NULL,
        ai_analysis = NULL,
        ia_atendimento_ativo = TRUE,
        objetivo = 'INVESTIMENTO'
      WHERE id = $1;
    `, [contato_id]);

    console.log('Reset seguro simplificado concluído com absoluto sucesso! O contato Ranniere está pronto para simular o primeiro contato do zero.');

  } catch (err) {
    console.error('Erro durante o reset:', err.message);
  }

  await client.end();
}

main();
