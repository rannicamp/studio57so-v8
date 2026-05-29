const { createClient } = require('@supabase/supabase-js');

async function setupBucket() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Erro: Variáveis do Supabase não encontradas no process.env!");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Inserindo bucket 'chat-interno' no banco...");
  const sql = `
    -- Inserir o bucket se não existir
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('chat-interno', 'chat-interno', true) 
    ON CONFLICT (id) DO NOTHING;

    -- Remover políticas antigas para evitar erro de duplicidade
    DROP POLICY IF EXISTS "Permitir leitura de chat-interno para autenticados" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir criacao de chat-interno para autenticados" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir delecao de chat-interno para autenticados" ON storage.objects;

    -- Criar novas políticas de acesso para usuários autenticados
    CREATE POLICY "Permitir leitura de chat-interno para autenticados" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'chat-interno');

    CREATE POLICY "Permitir criacao de chat-interno para autenticados" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-interno');

    CREATE POLICY "Permitir delecao de chat-interno para autenticados" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'chat-interno');
  `;

  const { data, error } = await supabase.rpc('execute_sql_query', { query: sql });
  if (error) {
    console.error("Erro ao rodar SQL de configuração de bucket:", error);
  } else {
    console.log("Bucket 'chat-interno' e políticas RLS criados com sucesso!", data);
  }
}

setupBucket().catch(console.error);
