// scripts/sql_runner.js
// ─────────────────────────────────────────────────────────────────────────────
// 🔧 Executor Universal de SQL via Postgres Direto (Porta 6543)
// Método homologado do projeto quando o MCP Supabase está instável.
//
// COMO USAR:
//   1. Adicione ao .env.local: SUPABASE_DB_PASSWORD=sua_senha_aqui
//   2. Ou passe via argumento: node scripts/sql_runner.js SUA_SENHA
//
// ONDE PEGAR A SENHA:
//   Supabase Dashboard → Project: Studio 57 → Settings → Database
//   → Database Settings → Database password (clique em "Reveal" ou "Reset")
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

// Lê a senha de 3 fontes possíveis (em ordem de prioridade)
function getPassword() {
    // 1. Argumento de linha de comando
    const argPassword = process.argv[2];
    if (argPassword && argPassword.length > 5) return argPassword;

    // 2. Variável de ambiente padrão
    if (process.env.SUPABASE_DB_PASSWORD) return process.env.SUPABASE_DB_PASSWORD;
    if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;
    if (process.env.POSTGRES_PASSWORD) return process.env.POSTGRES_PASSWORD;

    // 3. Tentar ler de .env.db (arquivo auxiliar seguro)
    try {
        if (fs.existsSync('.env.db')) {
            const dbEnv = fs.readFileSync('.env.db', 'utf8');
            const match = dbEnv.match(/SUPABASE_DB_PASSWORD=(.+)/);
            if (match) return match[1].trim();
        }
    } catch { }

    return null;
}

async function runSQL(queries) {
    const password = getPassword();

    if (!password) {
        console.error('\n❌ SENHA NÃO ENCONTRADA!\n');
        console.error('Como resolver (escolha 1):');
        console.error('  OPÇÃO A: Adicione ao .env.local:');
        console.error('           SUPABASE_DB_PASSWORD=sua_senha_do_supabase\n');
        console.error('  OPÇÃO B: Passe como argumento:');
        console.error('           node scripts/sql_runner.js SUA_SENHA\n');
        console.error('  OPÇÃO C: Crie o arquivo .env.db com:');
        console.error('           SUPABASE_DB_PASSWORD=sua_senha_do_supabase\n');
        console.error('Onde pegar a senha:');
        console.error('  Supabase Dashboard → Studio 57 → Settings → Database');
        console.error('  → "Database password" → clique em "Reveal"\n');
        process.exit(1);
    }

    // Extrai o project ID da URL pública (ex: vhuvnutzklhskkwbpxdz)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const baseHost = supabaseUrl.replace('https://', '').split('/')[0];
    const projectId = baseHost.split('.')[0];

    if (!projectId) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL não encontrada no .env.local');
        process.exit(1);
    }

    const host = `db.${projectId}.supabase.co`;
    const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

    const client = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log(`🔌 Conectando a ${host}:6543...`);
        await client.connect();
        console.log('✅ Conectado!\n');

        for (const { sql, description } of queries) {
            try {
                process.stdout.write(`⚙️  ${description}... `);
                await client.query(sql);
                console.log('✅');
            } catch (e) {
                // Erros "já existe" são normais e seguros de ignorar
                if (e.message.includes('already exists') || e.message.includes('já existe')) {
                    console.log('⏭️  (já existia, ok)');
                } else {
                    console.log(`❌ ERRO: ${e.message}`);
                }
            }
        }

        console.log('\n🎉 Todas as operações SQL concluídas!');

    } catch (e) {
        if (e.message.includes('password') || e.message.includes('authentication')) {
            console.error('\n❌ Senha incorreta! Verifique a senha no Supabase Dashboard.');
            console.error('   Settings → Database → "Database password" → Reveal');
        } else if (e.message.includes('ENOTFOUND') || e.message.includes('timeout')) {
            console.error('\n❌ Falha de conexão! Verifique sua internet ou o host do banco.');
        } else {
            console.error('\n❌ Erro de conexão:', e.message);
        }
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Conexão encerrada.');
    }
}

// ─── QUERIES DO INSTAGRAM REALTIME ───────────────────────────────────────────
// Execute: node scripts/sql_runner.js [SUA_SENHA]
// ─────────────────────────────────────────────────────────────────────────────
const INSTAGRAM_REALTIME_QUERIES = [
    {
        description: 'REPLICA IDENTITY FULL em instagram_conversations',
        sql: `ALTER TABLE instagram_conversations REPLICA IDENTITY FULL;`
    },
    {
        description: 'REPLICA IDENTITY FULL em instagram_messages',
        sql: `ALTER TABLE instagram_messages REPLICA IDENTITY FULL;`
    },
    {
        description: 'Adicionar instagram_conversations à publication do Realtime',
        sql: `ALTER PUBLICATION supabase_realtime ADD TABLE instagram_conversations;`
    },
    {
        description: 'Adicionar instagram_messages à publication do Realtime',
        sql: `ALTER PUBLICATION supabase_realtime ADD TABLE instagram_messages;`
    },
    {
        description: 'Garantir coluna organizacao_id em instagram_messages',
        sql: `ALTER TABLE instagram_messages ADD COLUMN IF NOT EXISTS organizacao_id bigint;`
    },
    {
        description: 'Preencher organizacao_id nas mensagens existentes',
        sql: `
            UPDATE instagram_messages im
            SET organizacao_id = ic.organizacao_id
            FROM instagram_conversations ic
            WHERE im.conversation_id = ic.id
            AND im.organizacao_id IS NULL;
        `
    },
    {
        description: 'Índice: instagram_messages por organizacao_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_instagram_messages_org_id ON instagram_messages(organizacao_id);`
    },
    {
        description: 'Índice: instagram_messages por conversation_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_instagram_messages_conv_id ON instagram_messages(conversation_id);`
    },
    {
        description: 'Índice: instagram_conversations por organizacao_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_instagram_conv_org_id ON instagram_conversations(organizacao_id);`
    },
    {
        description: 'Índice: instagram_conversations por last_message_at',
        sql: `CREATE INDEX IF NOT EXISTS idx_instagram_conv_last_msg ON instagram_conversations(last_message_at DESC);`
    },
    {
        description: 'Verificando resultado final',
        sql: `
            SELECT 
                t.tablename,
                CASE WHEN p.tablename IS NOT NULL THEN '✅ No Realtime' ELSE '❌ Fora do Realtime' END as realtime_status
            FROM (VALUES ('instagram_conversations'), ('instagram_messages')) AS t(tablename)
            LEFT JOIN pg_publication_tables p 
                ON p.tablename = t.tablename AND p.pubname = 'supabase_realtime';
        `
    },
];

console.log('🚀 Instagram Realtime — Habilitando a "campainha" do banco\n');
console.log('   Tabelas: instagram_conversations + instagram_messages');
console.log('   Objetivo: Mensagens chegam instantaneamente (igual ao WhatsApp)\n');

runSQL(INSTAGRAM_REALTIME_QUERIES);
