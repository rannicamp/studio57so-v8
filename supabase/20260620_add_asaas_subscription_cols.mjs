import pg from 'pg';
import fs from 'fs';
import path from 'path';
const { Client } = pg;

// Função simples para carregar variáveis do .env.local sem dependências
function loadEnv() {
    try {
        const envPath = path.resolve('.env.local');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1);
                    } else if (value.startsWith("'") && value.endsWith("'")) {
                        value = value.substring(1, value.length - 1);
                    }
                    process.env[key] = value;
                }
            });
        }
    } catch (e) {
        console.error('Erro ao ler .env.local:', e.message);
    }
}

loadEnv();

async function main() {
    // A senha real é 'REMOVED_PASSWORD' (decodificado de %40)
    const password = 'REMOVED_PASSWORD';
    
    // Extrai o subdomínio da URL do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhuvnutzklhskkwbpxdz.supabase.co';
    const projectId = supabaseUrl.replace('https://', '').split('.')[0];
    const host = `db.${projectId}.supabase.co`;

    // String de conexão direta usando o host padrão na porta 6543
    const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@${host}:6543/postgres`;

    console.log(`🔌 Conectando ao host: ${host}`);
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao banco de dados Supabase com sucesso!');

        console.log('⏳ Adicionando colunas de assinatura à tabela public.organizacoes...');
        await client.query(`
            ALTER TABLE public.organizacoes 
            ADD COLUMN IF NOT EXISTS asaas_customer_id text,
            ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
            ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing',
            ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT (now() + interval '15 days'),
            ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone DEFAULT (now() + interval '15 days');
        `);
        console.log('✅ Colunas de assinatura verificadas/criadas!');

        // Confirmar estrutura atual
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'organizacoes' 
              AND column_name IN ('asaas_customer_id', 'asaas_subscription_id', 'subscription_status', 'trial_ends_at', 'subscription_expires_at');
        `);
        console.log('\n📊 Colunas da tabela organizacoes configuradas:');
        console.table(res.rows);

    } catch (err) {
        console.error('❌ Erro durante a execução do SQL:', err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        await client.end();
        console.log('\n🔌 Conexão encerrada.');
    }
}

main();
