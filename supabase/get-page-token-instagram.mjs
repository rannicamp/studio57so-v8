// supabase/get-page-token-instagram.mjs
// Usa o token do Instagram para encontrar a página Facebook vinculada
// e pegar o Page Access Token correto para a Conversations API
// Execute: node supabase/get-page-token-instagram.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vhuvnutzklhskkwbpxdz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodXZudXR6a2xoc2trd2JweGR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkyNjY0NiwiZXhwIjoyMDY1NTAyNjQ2fQ.wprEVKNDXXIjHJ32fQQnTBGdMdGLBL7SrXUio5-dDXc';

// O token Instagram (IGAAK...) que nos deu o account ID
const INSTAGRAM_TOKEN = 'IGAAKwRebwD6BBZAFlCcXRRNk9ubkRIOGtlb091bmlwRjJzS2JNZAmdacGZAtWk4tV2k1SWlhcUc3SU5pa05kRWJvV0d2ellIMjdCdmhGaVlibUVQR1ZAjX1VIYTNlTnI5cldaZAVBwMHNLSFUtVG1UZAFFndkRwQl93RFNvLXp5Rjk2YwZDZD';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
    console.log('\n🔍 BUSCANDO PAGE ACCESS TOKEN CORRETO PARA INSTAGRAM\n');

    // 1. Buscar páginas Facebook do usuário via token Instagram
    // O token IGAAK... com escopo pages_read_engagement dá acesso às páginas
    console.log('1️⃣  Buscando páginas Facebook com instagram_business_account ...');
    const pagesUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,name,username}&access_token=${INSTAGRAM_TOKEN}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
        console.log('   ❌ Erro na API /me/accounts:', pagesData.error.message);
        console.log('\n   💡 O token IGAAK não tem permissão para acessar páginas FB.');
        console.log('   Você precisa gerar um token com as permissões: pages_manage_metadata, instagram_manage_messages');
        console.log('\n   SOLUÇÃO: No painel Meta do App CRM-Studio 57-IG:');
        console.log('   1. Vá em "Gere tokens de acesso" (Passo 1)');
        console.log('   2. Clique em adicionar sua conta Instagram');
        console.log('   3. O token gerado ali TEM as permissões corretas para Conversations API');
        return;
    }

    const pages = pagesData.data || [];
    console.log(`   ✅ ${pages.length} página(s) encontrada(s):`);

    let pageWithInsta = null;
    pages.forEach((page, i) => {
        const hasInsta = page.instagram_business_account ? '✅ Instagram vinculado' : '❌ Sem Instagram';
        console.log(`   [${i+1}] "${page.name}" (ID: ${page.id}) — ${hasInsta}`);
        if (page.instagram_business_account) {
            console.log(`         IG ID: ${page.instagram_business_account.id}`);
            console.log(`         IG Username: @${page.instagram_business_account.username || 'N/A'}`);
            pageWithInsta = page;
        }
    });

    if (!pageWithInsta) {
        console.log('\n   ⚠️  Nenhuma página com Instagram vinculado encontrada com este token.');
        return;
    }

    const pageToken = pageWithInsta.access_token;
    const instaId = pageWithInsta.instagram_business_account.id;

    console.log(`\n2️⃣  Testando Page Access Token da página "${pageWithInsta.name}"...`);
    const convUrl = `https://graph.facebook.com/v20.0/${instaId}/conversations?platform=instagram&fields=participants,snippet,unread_count&access_token=${pageToken}`;
    const convRes = await fetch(convUrl);
    const convData = await convRes.json();

    if (convData.error) {
        console.log('   ❌ Erro:', convData.error.message);
        console.log('   Código:', convData.error.code);
        return;
    }

    console.log(`   ✅ ${convData.data?.length || 0} conversa(s) encontrada(s)!`);

    // 3. Salvar no banco!
    console.log('\n3️⃣  Salvando no banco de dados...');
    const { error } = await supabase
        .from('integracoes_meta')
        .update({
            page_access_token: pageToken,
            instagram_business_account_id: instaId,
            updated_at: new Date().toISOString(),
        })
        .eq('is_active', true);

    if (error) {
        console.log('   ❌ Erro ao salvar:', error.message);
    } else {
        console.log('   ✅ Banco atualizado!');
        console.log('\n═══════════════════════════════════════════');
        console.log('🎉 TUDO CONFIGURADO! Clique em 🔄 Sincronizar na caixa de entrada.');
        console.log('═══════════════════════════════════════════\n');
    }
}

main().catch(console.error);
