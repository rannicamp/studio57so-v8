require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase...");
     await client.connect();
     
     // 1. Achar a Analia nos contatos
     const resContatos = await client.query("SELECT id, nome, tipo FROM contatos WHERE nome ILIKE '%analia%' OR nome ILIKE '%anália%'");
     console.log("Contatos Analia encontrados:", resContatos.rows);
     
     if (resContatos.rows.length === 0) {
         console.log("Nenhum contato Analia encontrado.");
         return;
     }
     
     const analiaContatoId = resContatos.rows[0].id;
     
     // 2. Achar a Analia nos usuarios e garantir o vinculo
     const resUsuarios = await client.query("SELECT id, full_name, contato_id FROM usuarios WHERE full_name ILIKE '%analia%' OR full_name ILIKE '%anália%'");
     console.log("Usuários Analia encontrados:", resUsuarios.rows);
     
     if (resUsuarios.rows.length > 0) {
         const analiaUsuarioId = resUsuarios.rows[0].id;
         if (resUsuarios.rows[0].contato_id !== analiaContatoId) {
             console.log(`Atualizando usuario Analia para apontar para o contato_id = ${analiaContatoId}`);
             await client.query("UPDATE usuarios SET contato_id = $1 WHERE id = $2", [analiaContatoId, analiaUsuarioId]);
         }
     }
     
     // 3. Atualizar pedidos sem corretor para o contato_id da Analia
     const resUpdatePedidos = await client.query("UPDATE pedidos SET corretor_id = $1 WHERE corretor_id IS NULL RETURNING id", [analiaContatoId]);
     console.log(`Cards (pedidos) atualizados para Analia: ${resUpdatePedidos.rowCount}`);
     
     console.log("Operação SQL homologada com sucesso!");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
