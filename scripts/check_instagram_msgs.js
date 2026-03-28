// scripts/check_instagram_msgs.js
// Verifica se as mensagens do Instagram chegaram no banco
// e diagnostica o Realtime

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '', serviceRoleKey = '';
env.split('\n').forEach(l => {
    const line = l.trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=').slice(1).join('=').trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceRoleKey = line.split('=').slice(1).join('=').trim();
});

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function main() {
    console.log('🔍 DIAGNÓSTICO INSTAGRAM — Verificando banco de dados...\n');

    // 1. Últimas 10 mensagens do Instagram
    console.log('📨 [1] Últimas 10 mensagens recebidas (inbound):');
    const { data: msgs, error: msgsErr } = await supabase
        .from('instagram_messages')
        .select('id, conversation_id, from_name, content, direction, sent_at, organizacao_id')
        .order('sent_at', { ascending: false })
        .limit(10);

    if (msgsErr) {
        console.error('   ❌ ERRO:', msgsErr.message);
    } else if (!msgs || msgs.length === 0) {
        console.log('   ⚠️  NENHUMA mensagem no banco! O webhook não está salvando.');
        console.log('   → Verifique se o webhook está configurado no App Instagram Meta.');
    } else {
        msgs.forEach(m => {
            const hora = new Date(m.sent_at).toLocaleString('pt-BR');
            const dir = m.direction === 'inbound' ? '📩 RECEBIDA' : '📤 ENVIADA';
            console.log(`   ${dir} | ${hora}`);
            console.log(`   De: ${m.from_name} | Org: ${m.organizacao_id}`);
            console.log(`   Conteúdo: "${m.content}"`);
            console.log(`   conversation_id: ${m.conversation_id}`);
            console.log('   ─────────────────────────────────────────');
        });
    }

    // 2. Mensagens dos últimos 10 minutos
    const dez_min_atras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    console.log('\n⏱️  [2] Mensagens nos últimos 10 minutos:');
    const { data: recentes, error: recentesErr } = await supabase
        .from('instagram_messages')
        .select('id, content, direction, sent_at, from_name')
        .gte('sent_at', dez_min_atras)
        .order('sent_at', { ascending: false });

    if (recentesErr) {
        console.error('   ❌ ERRO:', recentesErr.message);
    } else if (!recentes || recentes.length === 0) {
        console.log('   ⚠️  Nenhuma mensagem nos últimos 10 min → WEBHOOK NÃO ESTÁ RECEBENDO!');
        console.log('   → A Meta não está enviando os eventos para o nosso endpoint.');
    } else {
        console.log(`   ✅ ${recentes.length} mensagem(ns) nos últimos 10 min!`);
        recentes.forEach(m => {
            const hora = new Date(m.sent_at).toLocaleString('pt-BR');
            console.log(`   [${hora}] ${m.direction.toUpperCase()} - "${m.content}" (de: ${m.from_name})`);
        });
    }

    // 3. Verificar configuração da integração
    console.log('\n🔧 [3] Configuração da integração Meta (integracoes_meta):');
    const { data: integracoes, error: intErr } = await supabase
        .from('integracoes_meta')
        .select('id, organizacao_id, instagram_business_account_id, is_active, updated_at')
        .eq('is_active', true);

    if (intErr) {
        console.error('   ❌ ERRO:', intErr.message);
    } else if (!integracoes || integracoes.length === 0) {
        console.log('   ⚠️  NENHUMA integração ativa encontrada!');
        console.log('   → O webhook receberá a mensagem mas não saberá a qual org pertence.');
    } else {
        integracoes.forEach(i => {
            console.log(`   ✅ Org ${i.organizacao_id} | Instagram ID: ${i.instagram_business_account_id} | Ativo: ${i.is_active}`);
        });
    }

    // 4. Verificar se Realtime está nas publications
    console.log('\n📡 [4] Status do Realtime (via canal de escuta):');
    let canal_status = 'pendente...';
    const chanel = supabase.channel('diag-' + Date.now())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'instagram_conversations' }, () => {})
        .subscribe((status) => {
            canal_status = status;
            if (status === 'SUBSCRIBED') {
                console.log('   ✅ SUBSCRIBED! Realtime funcionando para instagram_conversations');
            } else {
                console.log(`   ❌ Status do canal: ${status}`);
                console.log('   → Verifique se a tabela está na publication supabase_realtime');
            }
        });

    await new Promise(r => setTimeout(r, 3000));
    await supabase.removeChannel(chanel);

    // 5. Total de mensagens no banco
    const { count } = await supabase
        .from('instagram_messages')
        .select('*', { count: 'exact', head: true });

    console.log(`\n📊 [5] Total de mensagens no banco: ${count || 0}`);

    console.log('\n─────────────────────────────────────────');
    console.log('DIAGNÓSTICO CONCLUÍDO');

    if (!recentes || recentes.length === 0) {
        console.log('\n🔴 CONCLUSÃO: Mensagens NÃO estão chegando no banco.');
        console.log('   O problema está no WEBHOOK (a Meta não está chamando nosso endpoint).');
        console.log('   Possíveis causas:');
        console.log('   1. O Netlify ainda não fez deploy da nova versão do webhook');
        console.log('   2. O webhook no Meta Developer Console está apontando para URL errada');
        console.log('   3. O campo "messages" não está subscrito no webhook do Instagram');
        console.log('   4. O token de verificação expirou ou está incorreto');
    } else {
        console.log('\n🟡 CONCLUSÃO: Mensagens CHEGAM no banco, mas o Realtime não atualiza o frontend.');
        console.log('   O problema está na conexão Realtime → verifique REPLICA IDENTITY e publication.');
    }
}

main().catch(e => console.error('ERRO FATAL:', e.message));
