const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('=== INSPEÇÃO DE AUTOMAÇÕES E LEADS ===');

  // 1. Buscar automações de WhatsApp ativas
  const automacoesRes = await client.query(`
    SELECT id, nome, gatilho_tipo, gatilho_config, acao_tipo, acao_config, ativo, organizacao_id
    FROM automacoes
    WHERE ativo = true;
  `);
  console.log('\n--- Automações Ativas ---');
  automacoesRes.rows.forEach(a => {
    console.log({
      id: a.id,
      nome: a.nome,
      gatilho_tipo: a.gatilho_tipo,
      gatilho_config: JSON.stringify(a.gatilho_config),
      acao_tipo: a.acao_tipo,
      acao_config: JSON.stringify(a.acao_config),
      organizacao_id: a.organizacao_id
    });
  });

  // 2. Buscar configurações do WhatsApp
  const configsRes = await client.query(`
    SELECT *
    FROM configuracoes_whatsapp;
  `);
  console.log('\n--- Configurações do WhatsApp ---');
  configsRes.rows.forEach(c => {
    console.log({
      id: c.id,
      organizacao_id: c.organizacao_id,
      whatsapp_phone_number_id: c.whatsapp_phone_number_id,
      whatsapp_business_account_id: c.whatsapp_business_account_id,
      whatsapp_permanent_token_present: !!c.whatsapp_permanent_token
    });
  });

  // 3. Buscar os 10 últimos leads cadastrados
  const leadsRes = await client.query(`
    SELECT c.id, c.nome, c.origem, c.created_at, c.organizacao_id, c.meta_lead_id,
           t.telefone,
           cf.coluna_id,
           col.nome as nome_coluna,
           f.nome as nome_funil
    FROM contatos c
    LEFT JOIN telefones t ON t.contato_id = c.id
    LEFT JOIN contatos_no_funil cf ON cf.contato_id = c.id
    LEFT JOIN colunas_funil col ON col.id = cf.coluna_id
    LEFT JOIN funis f ON f.id = col.funil_id
    WHERE c.tipo_contato = 'Lead'
    ORDER BY c.created_at DESC
    LIMIT 10;
  `);
  console.log('\n--- Últimos 10 Leads ---');
  leadsRes.rows.forEach(l => {
    console.log({
      id: l.id,
      nome: l.nome,
      origem: l.origem,
      created_at: l.created_at,
      organizacao_id: l.organizacao_id,
      meta_lead_id: l.meta_lead_id,
      telefone: l.telefone,
      coluna_id: l.coluna_id,
      nome_coluna: l.nome_coluna,
      nome_funil: l.nome_funil
    });
  });

  // 4. Buscar mensagens outbound enviadas por automação ultimamente
  const msgRes = await client.query(`
    SELECT id, contato_id, content, direction, status, sent_at, error_message
    FROM whatsapp_messages
    WHERE direction = 'outbound'
    ORDER BY sent_at DESC
    LIMIT 10;
  `);
  console.log('\n--- Últimas 10 Mensagens Outbound ---');
  msgRes.rows.forEach(m => {
    console.log({
      id: m.id,
      contato_id: m.contato_id,
      content: m.content,
      status: m.status,
      sent_at: m.sent_at,
      error_message: m.error_message
    });
  });

  await client.end();
}

main().catch(console.error);
