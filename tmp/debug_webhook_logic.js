const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('=== DEPURAÇÃO DE LOGICA DO WEBHOOK ===');

  // 1. Inspecionar a mensagem 19815 (Rodrigo Munerat Latado)
  const msgDetails = await client.query(`
    SELECT * FROM whatsapp_messages WHERE id = '19815';
  `);
  console.log('\n--- Detalhes da Mensagem do Rodrigo (19815) ---');
  console.log(msgDetails.rows[0]);

  // 2. Inspecionar TODAS as automações do banco
  const allAutomacoes = await client.query(`
    SELECT id, nome, gatilho_tipo, gatilho_config, acao_tipo, acao_config, ativo, organizacao_id
    FROM automacoes;
  `);
  console.log('\n--- Todas as Automações Cadastradas ---');
  allAutomacoes.rows.forEach(a => {
    console.log({
      id: a.id,
      nome: a.nome,
      ativo: a.ativo,
      gatilho_tipo: a.gatilho_tipo,
      gatilho_config: a.gatilho_config,
      acao_tipo: a.acao_tipo,
      acao_config: a.acao_config
    });
  });

  // 3. Simular lógica de busca de automação do webhook para Janice Castro (5683)
  // Janice está na org_id = 2, coluna_id = 'a4e01138-fe34-4fd6-91fb-f40678b1db79' (ENTRADA)
  const orgId = 2;
  const actualColunaId = 'a4e01138-fe34-4fd6-91fb-f40678b1db79';
  const finalPhone = '5533997325772';
  const is_organic = false; // Supondo origem 'Meta Lead Ad'
  const leadDetails = { is_organic };

  console.log(`\n--- Simulando busca de automações para Janice (Org: ${orgId}, Coluna: ${actualColunaId}) ---`);
  
  // A query do webhook:
  const automacoesQuery = await client.query(`
    SELECT *
    FROM automacoes
    WHERE organizacao_id = $1
      AND ativo = true
      AND gatilho_tipo IN ('CRIAR_CARD', 'MOVER_CARD', 'MOVER_COLUNA')
      AND gatilho_config->>'coluna_id' = $2;
  `, [orgId, actualColunaId]);

  console.log(`Encontradas ${automacoesQuery.rows.length} automações.`);
  
  automacoesQuery.rows.forEach(regra => {
    console.log(`Analisando regra: ${regra.nome} (${regra.id})`);
    const condicoes = regra.gatilho_config?.condicoes;
    console.log('Condições da regra:', condicoes);
    
    if (condicoes) {
      let match = true;
      if (condicoes.tipo && condicoes.tipo.toLowerCase() !== 'lead') {
        console.log(`-> FALHOU: condicoes.tipo (${condicoes.tipo}) !== 'lead'`);
        match = false;
      }
      
      const origemContato = leadDetails.is_organic ? 'Meta Lead Organico' : 'Meta Lead Ad';
      if (condicoes.origem && condicoes.origem !== origemContato) {
        console.log(`-> FALHOU: condicoes.origem (${condicoes.origem}) !== origemContato (${origemContato})`);
        match = false;
      }
      
      if (condicoes.campanha_id && leadDetails.campaign_id !== condicoes.campanha_id) {
        console.log(`-> FALHOU: condicoes.campanha_id (${condicoes.campanha_id}) !== leadDetails.campaign_id (${leadDetails.campaign_id})`);
        match = false;
      }
      
      console.log('Resultado do match das condições:', match);
    } else {
      console.log('Sem condições configuradas. Match padrão = true.');
    }
  });

  await client.end();
}

main().catch(console.error);
