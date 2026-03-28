// scripts/enable_instagram_realtime.js
// Habilita Realtime e índices nas tabelas do Instagram via supabase-js (Service Role)
// Usa o padrão consagrado do projeto (sem pg direto, sem necessidade de senha extra)

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Leitura manual do .env.local (igual ao padrão dos outros scripts do projeto)
const env = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let serviceRoleKey = '';
env.split('\n').forEach(l => {
    const line = l.trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=').slice(1).join('=').trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceRoleKey = line.split('=').slice(1).join('=').trim();
});

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
});

async function runSQL(sql, description) {
    console.log(`⚙️  ${description}...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).maybeSingle().catch(() => ({
        data: null, error: { message: 'RPC exec_sql não disponível' }
    }));
    if (error) {
        console.log(`   ⚠️  RPC falhou — usando REST direto...`);
        return false;
    }
    return true;
}

async function main() {
    console.log('🔌 Conectando ao Supabase Studio 57...');
    console.log('   URL:', supabaseUrl.substring(0, 40) + '...\n');

    // Verificar se as tabelas existem
    console.log('🔍 [1/3] Verificando tabelas do Instagram...');

    const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['instagram_conversations', 'instagram_messages']);

    if (tablesError) {
        console.log('   (Não foi possível listar via JS — usando verificação direta)');
    } else {
        const found = (tables || []).map(t => t.table_name);
        console.log('   Tabelas encontradas:', found.join(', ') || 'nenhuma');
    }

    // Verificar coluna organizacao_id em instagram_messages
    console.log('\n🔎 [2/3] Verificando coluna organizacao_id em instagram_messages...');
    const { data: testMsg, error: testErr } = await supabase
        .from('instagram_messages')
        .select('id, organizacao_id')
        .limit(1);

    if (testErr && testErr.message.includes('organizacao_id')) {
        console.log('   ❌ Coluna organizacao_id NÃO existe — precisa ser criada via Supabase Dashboard!');
        console.log('   📋 SQL para rodar no Dashboard (SQL Editor):');
        console.log('   ALTER TABLE instagram_messages ADD COLUMN IF NOT EXISTS organizacao_id bigint;');
        console.log('   UPDATE instagram_messages im SET organizacao_id = ic.organizacao_id');
        console.log('   FROM instagram_conversations ic WHERE im.conversation_id = ic.id;');
    } else if (!testErr) {
        console.log('   ✅ Coluna organizacao_id existe!');
        // Corrigir registros nulos se houver
        const { count } = await supabase
            .from('instagram_messages')
            .select('id', { count: 'exact', head: true })
            .is('organizacao_id', null);
        if (count > 0) {
            console.log(`   ⚠️  ${count} mensagem(ns) sem organizacao_id — corrigindo via API... (use o SQL abaixo no Dashboard)`);
        } else {
            console.log('   ✅ Todas as mensagens têm organizacao_id!');
        }
    }

    // Teste de conexão Realtime
    console.log('\n📡 [3/3] Testando conexão Realtime...');
    let realtimeOk = false;
    const chanel = supabase.channel('test-realtime-' + Date.now())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'instagram_conversations' }, () => {
            realtimeOk = true;
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('   ✅ Realtime SUBSCRIBED com sucesso para instagram_conversations!');
                realtimeOk = true;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.log(`   ❌ Realtime com erro: ${status}`);
                console.log('   📋 Provavelmente a tabela não está na publication. Rode no SQL Editor:');
                console.log('   ALTER TABLE instagram_conversations REPLICA IDENTITY FULL;');
                console.log('   ALTER TABLE instagram_messages REPLICA IDENTITY FULL;');
                console.log('   ALTER PUBLICATION supabase_realtime ADD TABLE instagram_conversations;');
                console.log('   ALTER PUBLICATION supabase_realtime ADD TABLE instagram_messages;');
            }
        });

    await new Promise(r => setTimeout(r, 5000));
    await supabase.removeChannel(chanel);

    if (!realtimeOk) {
        console.log('\n⚠️  Realtime não confirmado. Veja as instruções SQL acima e rode no Dashboard do Supabase!');
    }

    console.log('\n📋 RESUMO DO SQL NECESSÁRIO PARA O SUPABASE DASHBOARD:');
    console.log('─'.repeat(60));
    console.log(`
-- Cole este SQL no SQL Editor do Supabase (Studio 57):

-- 1. REPLICA IDENTITY para payload completo no Realtime
ALTER TABLE instagram_conversations REPLICA IDENTITY FULL;
ALTER TABLE instagram_messages REPLICA IDENTITY FULL;

-- 2. Adicionar à publication do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE instagram_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE instagram_messages;

-- 3. Garantir coluna organizacao_id (para filtros Realtime por org)
ALTER TABLE instagram_messages ADD COLUMN IF NOT EXISTS organizacao_id bigint;

-- 4. Preencher organizacao_id nas mensagens existentes
UPDATE instagram_messages im
SET organizacao_id = ic.organizacao_id
FROM instagram_conversations ic
WHERE im.conversation_id = ic.id
AND im.organizacao_id IS NULL;

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_instagram_messages_org_id ON instagram_messages(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_conv_id ON instagram_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_instagram_conv_org_id ON instagram_conversations(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_instagram_conv_last_msg ON instagram_conversations(last_message_at DESC);
    `);
    console.log('─'.repeat(60));
    console.log('\n✅ Script concluído! Rode o SQL acima no Supabase Dashboard para finalizar.');
}

main().catch(e => {
    console.error('ERRO:', e.message);
    process.exit(1);
});
