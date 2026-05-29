const { Client } = require('pg'); 
const c = new Client({ 
  connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

async function run() { 
  await c.connect(); 
  console.log("Simulando sessão de Ranniere sob a role 'authenticated' com RLS ativo...");

  try {
    // Iniciamos transação
    await c.query('BEGIN');
    
    // Configuramos o role e os claims de JWT idênticos ao Supabase real
    await c.query("SET LOCAL role = 'authenticated'");
    await c.query("SET LOCAL request.jwt.claim.sub = '3bfde802-b916-4ea6-a871-7436481bfd3f'");
    await c.query("SET LOCAL request.jwt.claim.role = 'authenticated'");
    
    // Verificamos o que a função get_auth_user_org retorna agora
    const { rows: rOrg } = await c.query("SELECT get_auth_user_org() AS org");
    console.log("get_auth_user_org() simulado:", rOrg[0].org);

    // Fazemos o select na tabela contatos buscando a Amanda
    const { rows: contatos } = await c.query("SELECT id, nome, organizacao_id, criado_por_usuario_id FROM contatos WHERE nome ILIKE '%Amanda da Silva%'");
    console.log("SELECT contatos retornou:", contatos);

    await c.query('COMMIT');
  } catch(e) {
    await c.query('ROLLBACK');
    console.error("Erro na simulação do RLS:", e.message);
  } finally {
    c.end();
  }
} 
run().catch(console.error);
