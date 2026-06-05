const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- INSPECIONANDO DETALHES DE PAYLOAD ---');

  // Inspecionar o tipo da coluna
  const resCol = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'whatsapp_messages' AND column_name = 'raw_payload';
  `);
  console.log('Tipo da coluna no banco:', resCol.rows[0]);

  // Inspecionar mensagens específicas como a 8942
  const resMsg = await client.query(`
    SELECT id, pg_typeof(raw_payload) as pg_type, raw_payload
    FROM whatsapp_messages 
    WHERE id = 8942;
  `);
  
  if (resMsg.rows.length > 0) {
    const row = resMsg.rows[0];
    console.log('Mensagem 8942:', {
      id: row.id,
      pg_type: row.pg_type,
      raw_payload_typeof: typeof row.raw_payload,
      raw_payload_raw: row.raw_payload
    });
  } else {
    console.log('Mensagem 8942 não encontrada!');
  }

  // Verificar se há mensagens onde raw_payload->>'type' = 'template'
  const resQueryObj = await client.query(`
    WITH messages_parsed AS (
        SELECT 
            id,
            contato_id,
            direction,
            sent_at,
            status,
            CASE 
                WHEN jsonb_typeof(raw_payload) = 'string' THEN 
                    CASE 
                        WHEN (raw_payload#>>'{}') IS NULL OR (raw_payload#>>'{}') = '' THEN NULL
                        ELSE (raw_payload#>>'{}')::jsonb 
                    END
                ELSE raw_payload 
            END as payload
        FROM whatsapp_messages
        WHERE raw_payload IS NOT NULL
    ),
    messages_labeled AS (
        SELECT 
            id,
            contato_id,
            direction,
            sent_at,
            status,
            payload->'template'->>'name' as template_name,
            CASE WHEN direction = 'outbound' AND payload->>'type' = 'template' THEN 1 ELSE 0 END as is_template_boundary
        FROM messages_parsed
    ),
    messages_grouped AS (
        SELECT 
            id,
            contato_id,
            direction,
            sent_at,
            status,
            template_name,
            is_template_boundary,
            sum(is_template_boundary) OVER (PARTITION BY contato_id ORDER BY sent_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as group_id
        FROM messages_labeled
    ),
    group_summary AS (
        SELECT 
            contato_id,
            group_id,
            max(case when direction = 'outbound' and is_template_boundary = 1 then template_name else null end) as t_name,
            max(case when direction = 'outbound' and is_template_boundary = 1 then status else null end) as status,
            max(case when direction = 'outbound' and is_template_boundary = 1 then sent_at else null end) as template_sent_at,
            bool_or(direction = 'inbound') as has_reply
        FROM messages_grouped
        GROUP BY contato_id, group_id
        HAVING max(case when direction = 'outbound' and is_template_boundary = 1 then 1 else 0 end) = 1
    )
    SELECT 
      t_name as template_name,
      count(*) as total_sent,
      sum(case when status in ('delivered', 'read') then 1 else 0 end) as total_delivered,
      sum(case when status = 'read' then 1 else 0 end) as total_read,
      sum(case when has_reply then 1 else 0 end) as total_replied
    FROM group_summary
    GROUP BY 1
    ORDER BY total_sent DESC;
  `);
  console.log('Resultados de templates e respostas calculados (Otimizados):', resQueryObj.rows);

  await client.end();
}

main();
