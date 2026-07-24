const { Client } = require('pg');

async function run() {
  const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase');

    const resSettings = await client.query(`
      SELECT s.id, s.organizacao_id, s.template_id, s.is_active, s.funcoes_ids, t.tabela_alvo, t.evento, t.titulo_template
      FROM public.sys_org_notification_settings s
      JOIN public.sys_notification_templates t ON s.template_id = t.id;
    `);
    console.table(resSettings.rows);

  } catch (error) {
    console.error('❌ Erro na consulta:', error);
  } finally {
    await client.end();
  }
}

run();
