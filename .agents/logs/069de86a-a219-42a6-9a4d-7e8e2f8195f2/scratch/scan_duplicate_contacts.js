const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- VARREDURA DE TELEFONES DUPLICADOS NO BANCO ---');

  // 1. Encontrar telefones que possuem múltiplos contatos na mesma organização
  const resTels = await client.query(`
    SELECT 
      telefone,
      organizacao_id,
      count(distinct contato_id) as total_contatos,
      array_agg(contato_id::text) as contato_ids
    FROM telefones
    GROUP BY telefone, organizacao_id
    HAVING count(distinct contato_id) > 1
    ORDER BY total_contatos DESC;
  `);

  console.log(`Total de telefones com contatos duplicados encontrados: ${resTels.rows.length}\n`);

  const diagnostico = [];

  for (const row of resTels.rows) {
    const contatoIds = row.contato_ids;
    
    // Buscar detalhes dos contatos
    const resContatos = await client.query(`
      SELECT id, nome, created_at
      FROM contatos 
      WHERE id = ANY($1::bigint[]);
    `, [contatoIds]);

    // Buscar mensagens de whatsapp de todos esses contatos
    const resMsgs = await client.query(`
      SELECT contato_id, direction, count(*) as qtd
      FROM whatsapp_messages
      WHERE contato_id = ANY($1::bigint[])
      GROUP BY contato_id, direction;
    `, [contatoIds]);

    // Mapear distribuição de mensagens por contato
    const msgMap = {};
    contatoIds.forEach(id => {
      msgMap[id] = { inbound: 0, outbound: 0 };
    });
    resMsgs.rows.forEach(m => {
      if (msgMap[m.contato_id]) {
        msgMap[m.contato_id][m.direction] = parseInt(m.qtd) || 0;
      }
    });

    diagnostico.push({
      telefone: row.telefone,
      organizacao_id: row.organizacao_id,
      contatos: resContatos.rows.map(c => ({
        id: c.id,
        nome: c.nome,
        created_at: c.created_at,
        mensagens: msgMap[c.id]
      }))
    });
  }

  // Filtrar para mostrar apenas aqueles que possuem mensagens de fato divididas ou ativas no whatsapp
  const duplicadosComMensagens = diagnostico.filter(d => {
    return d.contatos.some(c => c.mensagens.inbound > 0 || c.mensagens.outbound > 0);
  });

  console.log(`--- DIAGNÓSTICO DETALHADO (Contatos ativos no WhatsApp com duplicação) ---`);
  console.log(JSON.stringify(duplicadosComMensagens, null, 2));

  // Contagem de duplicados sem mensagens (órfãos de conversa, que apenas existem na tabela contatos)
  const duplicadosSemMensagens = diagnostico.filter(d => {
    return !d.contatos.some(c => c.mensagens.inbound > 0 || c.mensagens.outbound > 0);
  });
  console.log(`\nContatos duplicados sem mensagens no WhatsApp (Apenas cadastros de leads órfãos): ${duplicadosSemMensagens.length}`);

  await client.end();
}

main();
