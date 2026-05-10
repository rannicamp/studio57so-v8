const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
const host = 'db.' + baseHost.split('.')[0] + '.supabase.co';
const connStr = 'postgres://postgres:' + password + '@' + host + ':6543/postgres';
const client = new Client({ connectionString: connStr });
client.connect().then(() => {
  client.query(`
    DROP TABLE IF EXISTS public.sync_queue;
    CREATE TABLE public.sync_queue (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        contato_id BIGINT NOT NULL,
        organizacao_id BIGINT NOT NULL,
        user_id UUID,
        status TEXT NOT NULL DEFAULT 'pendente',
        tentativas INT DEFAULT 0,
        mensagem_erro TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON public.sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_org ON public.sync_queue(organizacao_id);
    
    -- CREATE TRIGGER TO AUTO ENQUEUE
    CREATE OR REPLACE FUNCTION trg_enqueue_sync_contact()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Ignore updates if they don't change core fields (like name, email, phone)
        -- We can just enqueue every time or check for differences. Let's enqueue every time for now,
        -- because the background worker will handle fetching the latest and syncing.
        INSERT INTO public.sync_queue (contato_id, organizacao_id, user_id, status)
        VALUES (
            NEW.id,
            NEW.organizacao_id,
            NEW.criado_por_usuario_id,
            'pendente'
        );
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_auto_enqueue_contact ON public.contatos;
    CREATE TRIGGER trg_auto_enqueue_contact
    AFTER INSERT OR UPDATE ON public.contatos
    FOR EACH ROW
    EXECUTE FUNCTION trg_enqueue_sync_contact();

  `).then(() => {
    console.log('Tabela recriada e Trigger configurado com sucesso.');
    client.end();
  }).catch(e => {
    console.error('Erro:', e);
    client.end();
  });
});
