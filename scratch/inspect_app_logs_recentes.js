// scratch/inspect_app_logs_recentes.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DATA_INICIO_ISO = '2026-06-25T19:00:00.000Z';
const ids = [5976, 6120, 6124, 6127, 6125];

async function main() {
  console.log("=== BUSCANDO APP_LOGS RECENTES DOS LEADS ATIVOS ===");

  const { data: logs, error: errLogs } = await supabase
    .from('app_logs')
    .select('*')
    .gte('created_at', DATA_INICIO_ISO)
    .order('created_at', { ascending: true });

  if (errLogs) {
    console.error("Erro ao carregar app_logs via Supabase-js:", errLogs.message);
    
    // Tentar via PG direto
    console.log("Tentando conexão direta via PG...");
    const { Client } = require('pg');
    const client = new Client({ 
      connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
      ssl: { rejectUnauthorized: false } 
    });
    
    try {
      await client.connect();
      const query = `
        SELECT *
        FROM app_logs
        WHERE created_at >= '${DATA_INICIO_ISO}'
        ORDER BY created_at ASC;
      `;
      const res = await client.query(query);
      processLogs(res.rows);
    } catch (pgErr) {
      console.error("Erro na conexão direta via PG:", pgErr.message);
    } finally {
      await client.end();
    }
  } else {
    processLogs(logs);
  }
}

function processLogs(logsList) {
  console.log(`Total de logs encontrados no período: ${logsList.length}`);
  
  let output = "=== APP_LOGS DE DETALHE DOS LEADS RECENTES ===\n\n";
  let count = 0;

  logsList.forEach(log => {
    // Verificar se o payload ou a mensagem cita algum de nossos leads
    const logStr = JSON.stringify(log).toLowerCase();
    const matchesLead = ids.some(id => logStr.includes(String(id)));
    
    if (matchesLead || logStr.includes("stella") || logStr.includes("autopilot") || logStr.includes("atendimento_ativo")) {
      const dateLocal = new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      output += `[${dateLocal}] ID: ${log.id} | Mensagem: "${log.mensagem}"\n`;
      if (log.payload) {
        output += `Payload: ${JSON.stringify(log.payload, null, 2)}\n`;
      }
      output += "-".repeat(80) + "\n";
      count++;
    }
  });

  console.log(`Logs filtrados relevantes: ${count}`);
  fs.writeFileSync('scratch/app_logs_recentes_filtrados.txt', output, 'utf-8');
  console.log("Salvo em scratch/app_logs_recentes_filtrados.txt");
}

main();
