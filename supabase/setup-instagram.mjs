// supabase/setup-instagram.mjs
// Script para descobrir o instagram_business_account_id e salvar no banco
// Execute: node supabase/setup-instagram.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vhuvnutzklhskkwbpxdz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodXZudXR6a2xoc2trd2JweGR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkyNjY0NiwiZXhwIjoyMDY1NTAyNjQ2fQ.wprEVKNDXXIjHJ32fQQnTBGdMdGLBL7SrXUio5-dDXc';

// Token que você forneceu (Instagram User Token)
const INSTAGRAM_TOKEN = 'IGAAKwRebwD6BBZAFlCcXRRNk9ubkRIOGtlb091bmlwRjJzS2JNZAmdacGZAtWk4tV2k1SWlhcUc3SU5pa05kRWJvV0d2ellIMjdCdmhGaVlibUVQR1ZAjX1VIYTNlTnI5cldaZAVBwMHNLSFUtVG1UZAFFndkRwQl93RFNvLXp5Rjk2YwZDZD';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

async function main() {
    console.log('\n🔍 SETUP INSTAGRAM — Descobrindo configurações...\n');

    // ──────────────────────────────────────────────────
    // PASSO 1: Validar o token e buscar o usuário
    // ──────────────────────────────────────────────────
    console.log('1️⃣  Validando token via /me ...');
    const meRes = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,name,username&access_token=${INSTAGRAM_TOKEN}`);
    const meData = await meRes.json();

    if (meData.error) {
        console.error('❌ Erro ao validar token:', meData.error.message);
        console.log('\n💡 Dica: O token pode ter expirado. Gere um novo no painel da Meta (Passo 1 > Gere tokens de acesso)');
        return;
    }

    console.log('✅ Token válido!');
    console.log(`   👤 ID: ${meData.id}`);
    console.log(`   📛 Nome: ${meData.name}`);
    console.log(`   🐾 Username: @${meData.username || 'N/A'}`);
    const instagramAccountId = meData.id;

    // ──────────────────────────────────────────────────
    // PASSO 2: Buscar integrações Meta no banco
    // ──────────────────────────────────────────────────
    console.log('\n2️⃣  Buscando integrações Meta no banco...');
    const { data: integracoes, error: intErr } = await supabase
        .from('integracoes_meta')
        .select('id, organizacao_id, instagram_business_account_id, nome_conta, is_active')
        .eq('is_active', true);

    if (intErr) {
        console.error('❌ Erro ao buscar integrações:', intErr.message);
        return;
    }

    if (!integracoes || integracoes.length === 0) {
        console.log('⚠️  Nenhuma integração Meta ativa encontrada no banco.');
        console.log('   Você precisa conectar o Meta Ads em Configurações > Integrações primeiro.\n');
        return;
    }

    console.log(`✅ ${integracoes.length} integração(ões) encontrada(s):`);
    integracoes.forEach((int, i) => {
        console.log(`   [${i + 1}] ID: ${int.id} | Org: ${int.organizacao_id} | Conta: ${int.nome_conta || 'sem nome'} | IG ID atual: ${int.instagram_business_account_id || '❌ VAZIO'}`);
    });

    // ──────────────────────────────────────────────────
    // PASSO 3: Atualizar TODAS as integrações ativas com o ID do Instagram
    // ──────────────────────────────────────────────────
    console.log(`\n3️⃣  Salvando instagram_business_account_id = "${instagramAccountId}" em todas as integrações ativas...`);

    for (const int of integracoes) {
        const { error: updErr } = await supabase
            .from('integracoes_meta')
            .update({
                instagram_business_account_id: instagramAccountId,
                page_access_token: INSTAGRAM_TOKEN, // Salva também o token atualizado
                updated_at: new Date().toISOString(),
            })
            .eq('id', int.id);

        if (updErr) {
            console.error(`   ❌ Erro ao atualizar integração ID ${int.id}:`, updErr.message);
        } else {
            console.log(`   ✅ Integração ID ${int.id} (Org ${int.organizacao_id}) atualizada!`);
        }
    }

    // ──────────────────────────────────────────────────
    // PASSO 4: Resumo final
    // ──────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ SETUP CONCLUÍDO!');
    console.log('═══════════════════════════════════════════');
    console.log(`\n📌 instagram_business_account_id: ${instagramAccountId}`);
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   1. No painel Meta (developers.facebook.com), vá até o App CRM-Studio 57-IG');
    console.log('   2. Em "Configure webhooks", preencha:');
    console.log('      URL de callback: https://studio57so-v8-main.netlify.app/api/instagram/webhook');
    console.log('      Verificar token:  4c0bb6cb22529dba96d56bf22b38028d');
    console.log('   3. Clique em "Verificar e salvar"');
    console.log('   4. Volte à caixa de entrada e clique no botão 🔄 Sincronizar\n');
}

main().catch(console.error);
