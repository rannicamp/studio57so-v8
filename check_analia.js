const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const query = `
    SELECT cw_base.conversation_record_id, 
           (k.kpis->>'lead_avg_minutes')::numeric as lead_avg,
           (k.kpis->>'lead_count')::int as lead_count
    FROM (
        SELECT 
            c.id AS contato_id,
            (SELECT corretor_id FROM contatos_no_funil WHERE contato_id::text = c.id::text LIMIT 1) as corretor_id,
            (SELECT id FROM whatsapp_conversations wc WHERE wc.contato_id = c.id LIMIT 1) as conversation_record_id
        FROM contatos c
        WHERE c.organizacao_id::integer = 2
          AND c.tipo_contato = 'Lead'
          AND c.created_at >= '2026-05-01'
    ) cw_base
    JOIN LATERAL (SELECT CASE WHEN cw_base.conversation_record_id IS NOT NULL 
                              THEN get_conversation_response_kpis(cw_base.conversation_record_id) 
                              ELSE NULL END as kpis) k ON true
    JOIN contatos u ON u.id::text = cw_base.corretor_id::text
    WHERE u.nome ILIKE '%Analia%'
      AND (k.kpis->>'lead_count')::int > 0
    ORDER BY (k.kpis->>'lead_avg_minutes')::numeric DESC
    LIMIT 5;
  `;

  try {
      const res = await client.query(query);
      console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();
