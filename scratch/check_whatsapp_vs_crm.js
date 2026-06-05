const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Vamos buscar leads no funil
    const query = `
      WITH cards AS (
        SELECT 
          cnf.id as cnf_id,
          cnf.contato_id,
          c.nome as lead_nome,
          cnf.coluna_id as coluna_atual_id,
          col.nome as coluna_atual_nome,
          c.created_at
        FROM contatos_no_funil cnf
        INNER JOIN contatos c ON c.id::text = cnf.contato_id::text
        LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
        WHERE cnf.organizacao_id = 2
          AND c.tipo_contato = 'Lead'
          AND c.created_at >= '2026-05-01 00:00:00-03'::timestamptz
          AND c.created_at <= '2026-05-31 23:59:59-03'::timestamptz
      ),
      passagens_crm AS (
        -- Mapeia quem passou por "MENSAGEM ENVIADA" (seja atual ou historico)
        SELECT DISTINCT ha.cnf_id
        FROM (
          SELECT h.contato_no_funil_id as cnf_id, h.coluna_nova_id as coluna_id
          FROM historico_movimentacao_funil h
          INNER JOIN cards ON cards.cnf_id = h.contato_no_funil_id
          UNION
          SELECT cnf_id, coluna_atual_id as coluna_id
          FROM cards
        ) ha
        INNER JOIN colunas_funil col ON col.id = ha.coluna_id
        WHERE UPPER(TRIM(col.nome)) = 'MENSAGEM ENVIADA'
      ),
      whatsapp_status AS (
        -- Mapeia mensagens outbound e inbound para cada lead
        SELECT 
          c.id as contato_id,
          COUNT(*) FILTER (WHERE m.direction = 'outbound') as msg_outbound,
          COUNT(*) FILTER (WHERE m.direction = 'inbound') as msg_inbound
        FROM contatos c
        LEFT JOIN whatsapp_messages m ON m.contato_id::text = c.id::text
        WHERE c.organizacao_id = 2
          AND c.tipo_contato = 'Lead'
          AND c.created_at >= '2026-05-01 00:00:00-03'::timestamptz
          AND c.created_at <= '2026-05-31 23:59:59-03'::timestamptz
        GROUP BY c.id
      )
      SELECT 
        cards.lead_nome,
        cards.created_at,
        cards.coluna_atual_nome,
        (CASE WHEN pc.cnf_id IS NOT NULL THEN 'SIM' ELSE 'NÃO' END) as passou_coluna_msg_enviada,
        COALESCE(ws.msg_outbound, 0) as msgs_enviadas_whatsapp,
        COALESCE(ws.msg_inbound, 0) as msgs_recebidas_whatsapp
      FROM cards
      LEFT JOIN passagens_crm pc ON pc.cnf_id = cards.cnf_id
      LEFT JOIN whatsapp_status ws ON ws.contato_id::text = cards.contato_id::text
      ORDER BY cards.created_at DESC;
    `;
    
    const res = await client.query(query);
    console.log(`=== Análise Cruzada CRM vs WhatsApp para MAIO/2026 (Total de Leads: ${res.rows.length}) ===`);
    console.table(res.rows);
    
    // Contagem consolidada
    const total = res.rows.length;
    const comColunaMsg = res.rows.filter(r => r.passou_coluna_msg_enviada === 'SIM').length;
    const comMensagemZap = res.rows.filter(r => r.msgs_enviadas_whatsapp > 0).length;
    const comInboundZap = res.rows.filter(r => r.msgs_recebidas_whatsapp > 0).length;
    
    console.log("\n=== Resumo Consolidado ===");
    console.log(`Total de Leads no Período: ${total}`);
    console.log(`Leads que passaram pela coluna "MENSAGEM ENVIADA" no CRM: ${comColunaMsg} (${((comColunaMsg/total)*100).toFixed(1)}%)`);
    console.log(`Leads que de fato receberam mensagem de WhatsApp (outbound): ${comMensagemZap} (${((comMensagemZap/total)*100).toFixed(1)}%)`);
    console.log(`Leads que responderam por WhatsApp (inbound): ${comInboundZap} (${((comInboundZap/total)*100).toFixed(1)}%)`);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
