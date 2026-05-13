const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT * FROM public.regras_notificacao;
  `);
  console.log("Regras na tabela antiga:");
  console.log(res.rows.map(r => ({id: r.id, tabela: r.tabela_alvo})));
  
  const res2 = await client.query(`
    SELECT * FROM public.sys_notification_templates;
  `);
  console.log("Regras na tabela nova:");
  console.log(res2.rows.map(r => ({id: r.id, tabela: r.tabela_alvo})));
  await client.end();
}
run();
