const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- DIAGNÓSTICO DE TEMPLATES DISPARADOS ---');

  // 1. Amostra de mensagens enviadas com raw_payload para inspecionar a estrutura
  const queryPayloads = `
    SELECT id, status, sent_at, raw_payload 
    FROM whatsapp_messages 
    WHERE direction = 'outbound' 
      AND raw_payload IS NOT NULL
      AND (raw_payload::jsonb->'template' IS NOT NULL OR raw_payload::text LIKE '%template%')
    LIMIT 20;
  `;

  // 2. Agrupamento de todas as mensagens outbound do banco para ver quais tipos e formatos temos
  const queryTipos = `
    SELECT 
      raw_payload->>'type' as type, 
      count(*) 
    FROM whatsapp_messages 
    WHERE direction = 'outbound'
    GROUP BY 1;
  `;

  // 3. Ver todos os nomes de templates que estão de fato gravados no raw_payload
  const queryNomesTemplates = `
    SELECT 
      raw_payload->'template'->>'name' as template_name,
      count(*)
    FROM whatsapp_messages
    WHERE direction = 'outbound'
      AND raw_payload IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC;
  `;

  try {
      const resPayloads = await client.query(queryPayloads);
      console.log('\n1. AMOSTRA DE PAYLOADS DE TEMPLATES:');
      resPayloads.rows.forEach(r => {
        try {
          const payload = typeof r.raw_payload === 'string' ? JSON.parse(r.raw_payload) : r.raw_payload;
          console.log(`ID: ${r.id} | Status: ${r.status} | SentAt: ${r.sent_at} | Type: ${payload?.type} | TemplateName: ${payload?.template?.name}`);
        } catch(e) {
          console.log(`ID: ${r.id} | Erro parse payload:`, e.message);
        }
      });

      const resTipos = await client.query(queryTipos);
      console.log('\n2. CONTAGEM POR TIPO DE MENSAGEM OUTBOUND:');
      console.log(resTipos.rows);

      const resNomes = await client.query(queryNomesTemplates);
      console.log('\n3. NOMES DE TEMPLATES ENCONTRADOS NO BANCO:');
      console.log(resNomes.rows);

  } catch(e) {
      console.error('Erro na consulta:', e);
  }

  await client.end();
}

main();
