require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function checkChatSecurity() {
  const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@';
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const client = new Client({
    host: host,
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: password,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("Conectado ao Postgres.");

  // 1. Verificar se RLS esta ativado nas tabelas de chat
  const rlsRes = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('sys_chat_conversations', 'sys_chat_messages', 'sys_chat_participants');
  `);
  console.log("\n--- Estado de RLS nas tabelas de chat ---");
  console.log(rlsRes.rows);

  // 2. Verificar as politicas criadas para essas tabelas
  const policiesRes = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('sys_chat_conversations', 'sys_chat_messages', 'sys_chat_participants');
  `);
  console.log("\n--- Políticas de RLS ---");
  console.log(policiesRes.rows);

  // 3. Verificar o SECURITY DEFINER da funcao RPC get_user_conversations
  const rpcSecurityRes = await client.query(`
    SELECT proname, prosecdef, provolatile
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_user_conversations';
  `);
  console.log("\n--- Segurança da RPC get_user_conversations ---");
  console.log(rpcSecurityRes.rows);

  await client.end();
}

checkChatSecurity().catch(console.error);
