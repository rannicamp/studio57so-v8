const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('=== LISTANDO CRONS NO BANCO DE DADOS ===\n');

  const client = new Client({ 
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // Listar jobs cadastrados
    const resJobs = await client.query('SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname FROM cron.job');
    console.log('Jobs de Cron Ativos:');
    console.log(JSON.stringify(resJobs.rows, null, 2));

    // Listar execuções recentes
    const resRuns = await client.query('SELECT jobid, runid, status, return_message, start_time, end_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10');
    console.log('\nExecuções Recentes de Cron:');
    console.log(JSON.stringify(resRuns.rows, null, 2));

  } catch (e) {
    console.error('Erro na query:', e.message);
  } finally {
    await client.end();
  }
}

main();
