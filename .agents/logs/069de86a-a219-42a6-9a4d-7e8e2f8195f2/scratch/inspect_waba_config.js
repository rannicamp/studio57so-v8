const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- BUSCANDO CONFIGURAÇÕES WABA E LEAD 3636 ---');

  // 1. Obter WABA phone_number_id
  const resConfig = await client.query(`
    SELECT organizacao_id, whatsapp_phone_number_id
    FROM configuracoes_whatsapp;
  `);
  console.log('Configurações WABA:', resConfig.rows);

  // 2. Marcar ia_atendimento_ativo = true para o contato 3636 (Fernanda Alves de Oliveira)
  const resUpdate = await client.query(`
    UPDATE contatos 
    SET ia_atendimento_ativo = true 
    WHERE id = 3636
    RETURNING id, nome, ia_atendimento_ativo;
  `);
  console.log('Contato 3636 atualizado:', resUpdate.rows);

  // 3. Obter telefone e conversa do lead 3636
  const resTel = await client.query(`
    SELECT c.id, c.nome, t.telefone, c.conversation_id
    FROM contatos c
    LEFT JOIN telefones t ON t.contato_id = c.id
    WHERE c.id = 3636;
  `);
  console.log('Dados de telefone/conversa do lead 3636:', resTel.rows);

  await client.end();
}

main();
