// supabase/test-instagram-token.mjs
// Testa se o token Page Access Token funciona com a Conversations API
// Execute: node supabase/test-instagram-token.mjs

const PAGE_ACCESS_TOKEN = 'EAAVk8Espx2YBPJjuvZAqtFClRfet5MdsJXHyqtLbXtcrSUsAmKzwnXqguQNLlKmdQPqjTwunhyxVZBbzerMV01eZBqXZB1sanQrZC7DpIAyLumzZCmr6gChgbhdXyCJYA5Sf49FUIRZBczQOLQa9SnrO6DdrR0dgP2q9LI3uQCL7TcOFTdmv8IjQeAUgsh4AQZDZD';
const INSTAGRAM_ACCOUNT_ID = '26303959352628659';

async function testToken() {
    console.log('\n🔍 DIAGNÓSTICO DO TOKEN INSTAGRAM\n');

    // Teste 1: Verificar o próprio token
    console.log('1️⃣  Verificando o token com /debug_token ...');
    const debugRes = await fetch(
        `https://graph.facebook.com/v20.0/debug_token?input_token=${PAGE_ACCESS_TOKEN}&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const debugData = await debugRes.json();
    if (debugData.data) {
        console.log('   ✅ Token válido!');
        console.log(`   📛 App ID: ${debugData.data.app_id}`);
        console.log(`   👤 User ID: ${debugData.data.user_id}`);
        console.log(`   📋 Tipo: ${debugData.data.type}`);
        console.log(`   🔐 Scopes: ${debugData.data.scopes?.join(', ')}`);
    } else {
        console.log('   ❌ Erro:', JSON.stringify(debugData.error || debugData));
    }

    // Teste 2: Buscar páginas do Facebook associadas ao token
    console.log('\n2️⃣  Buscando páginas Facebook vinculadas ao token ...');
    const pagesRes = await fetch(
        `https://graph.facebook.com/v20.0/me/accounts?access_token=${PAGE_ACCESS_TOKEN}`
    );
    const pagesData = await pagesRes.json();
    if (pagesData.data?.length > 0) {
        console.log(`   ✅ ${pagesData.data.length} página(s) encontrada(s):`);
        pagesData.data.forEach((p, i) => {
            console.log(`   [${i+1}] Nome: "${p.name}" | Page ID: ${p.id}`);
        });
    } else {
        console.log('   ⚠️  Nenhuma página encontrada:', JSON.stringify(pagesData.error || pagesData));
    }

    // Teste 3: Buscar conversas do Instagram diretamente
    console.log('\n3️⃣  Tentando buscar conversas do Instagram...');
    const convRes = await fetch(
        `https://graph.facebook.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/conversations?platform=instagram&fields=participants,snippet,unread_count&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const convData = await convRes.json();
    if (convData.data) {
        console.log(`   ✅ ${convData.data.length} conversa(s) encontrada(s)!`);
        convData.data.slice(0, 3).forEach((c, i) => {
            const outros = c.participants?.data?.filter(p => p.id !== INSTAGRAM_ACCOUNT_ID);
            console.log(`   [${i+1}] ${outros?.[0]?.name || '?'}: "${c.snippet || 'sem prévia'}"`);
        });
    } else {
        console.log('   ❌ Erro na Conversations API:', JSON.stringify(convData.error || convData));
        console.log('\n   💡 DICA: Este token pode não ser um Page Access Token vinculado ao Instagram Business.');
        console.log('   Para usar a Conversations API, precisa de um Page Access Token da página do Facebook');
        console.log('   que está vinculada à conta @studio57 do Instagram.\n');
    }
}

testToken().catch(console.error);
