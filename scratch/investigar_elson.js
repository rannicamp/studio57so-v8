const { Client } = require('pg');

const STUDIO_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };

async function investigateElson() {
  console.log('🔄 Buscando informações sobre Elson Lousada...');
  
  const client = new Client({
    connectionString: decodeURIComponent(STUDIO_URL),
    ssl: SSL
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco');

    // 1. Achar o contato Elson Lousada
    const resContato = await client.query(`
      SELECT 
        c.id, 
        c.nome, 
        c.tipo_contato, 
        c.ia_atendimento_ativo, 
        c.organizacao_id, 
        c.created_at,
        (SELECT corretor_id FROM contatos_no_funil WHERE contato_id::text = c.id::text LIMIT 1) as corretor_id
      FROM public.contatos c
      WHERE c.nome ILIKE '%Elson%' OR c.nome ILIKE '%Lousada%'
    `);

    console.log('\n📊 Contatos encontrados com nome Elson ou Lousada:');
    console.table(resContato.rows);

    if (resContato.rows.length === 0) {
      console.log('⚠️ Nenhum contato encontrado!');
      return;
    }

    const elsonId = resContato.rows[0].id;

    // 2. Buscar as últimas mensagens trocadas com o Elson
    const resMensagens = await client.query(`
      SELECT 
        id, 
        direction, 
        sent_at, 
        status, 
        content,
        raw_payload->'template'->>'name' as template_name
      FROM public.whatsapp_messages
      WHERE contato_id = $1
      ORDER BY sent_at DESC
      LIMIT 20;
    `, [elsonId]);

    console.log('\n💬 Últimas 20 mensagens com Elson Lousada:');
    console.table(resMensagens.rows);

    // 3. Vamos listar todas as tabelas criadas no banco de dados para ver qual guarda agendamentos ou filas
    const resAllTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('\n📂 Lista de Todas as Tabelas no Banco:');
    const tableNames = resAllTables.rows.map(r => r.table_name);
    console.log(tableNames.join(', '));

  } catch (e) {
    console.error('❌ Erro na investigação:', e.message);
  } finally {
    await client.end();
  }
}

investigateElson();
