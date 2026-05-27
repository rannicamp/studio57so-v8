const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Vamos buscar leads que foram criados perto do limite do dia (depois das 21:00 em GMT-3, que é no dia seguinte em UTC)
    const query = `
      SELECT 
        id, 
        created_at, 
        created_at::date as data_utc, 
        (created_at AT TIME ZONE 'America/Sao_Paulo')::date as data_sp,
        TO_CHAR(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') as data_hora_local
      FROM contatos 
      WHERE tipo_contato = 'Lead'
        AND created_at::time >= '21:00:00'
        OR created_at::time < '03:00:00'
      LIMIT 10;
    `;
    
    const res = await client.query(query);
    console.log("Amostra de Leads e diferença de fuso horário (UTC vs SP):");
    console.table(res.rows);
    
    // Verificando discrepâncias de contagem em um período
    // Por exemplo, de 2026-05-01 a 2026-05-31
    const p_start = '2026-05-01';
    const p_end = '2026-05-31';
    
    const queryDiff = `
      SELECT 
        COUNT(*) as total_com_utc,
        COUNT(*) FILTER (
          WHERE created_at >= '${p_start} 00:00:00-03'::timestamptz 
            AND created_at <= '${p_end} 23:59:59-03'::timestamptz
        ) as total_com_sp_offset
      FROM contatos
      WHERE organizacao_id = 2 
        AND tipo_contato = 'Lead'
        AND created_at >= '${p_start}'::timestamptz 
        AND created_at <= '${p_end} 23:59:59'::timestamptz;
    `;
    
    const resDiff = await client.query(queryDiff);
    console.log("\nDiferença de contagem de leads para Org 2 no período de maio 2026:");
    console.table(resDiff.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
