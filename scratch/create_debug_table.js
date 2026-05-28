const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- CRIANDO TABELA TEMP_DEBUG_LOGS ---');

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.temp_debug_logs (
      id serial primary key,
      created_at timestamp default now(),
      user_id uuid,
      params jsonb,
      result_count int,
      error text,
      message text
    );
  `);

  // Liberar permissões para que qualquer usuário autenticado possa inserir na tabela
  await client.query(`
    GRANT ALL ON public.temp_debug_logs TO authenticated;
    GRANT ALL ON public.temp_debug_logs TO anon;
    GRANT ALL ON public.temp_debug_logs TO service_role;
  `);

  // Desabilitar RLS temporariamente para essa tabela para não termos problemas com RLS no log
  await client.query(`
    ALTER TABLE public.temp_debug_logs DISABLE ROW LEVEL SECURITY;
  `);

  console.log('Tabela temp_debug_logs criada e permissões configuradas com sucesso!');

  await client.end();
}

main().catch(console.error);
