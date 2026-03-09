const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(l => {
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = l.split('=')[1].trim();
    if (l.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = l.split('=')[1].trim();
});

const s = createClient(url, key);

async function run() {
    console.log("Teste de conexao, lendo schema");
    // Ao invés de inserir UUID, pego uma org válida do banco
    const { data: users } = await s.from('usuarios').select('organizacao_id').limit(1);
    if (!users || !users[0]) return console.log('Sem usuarios');

    const orgId = users[0].organizacao_id;
    console.log("Org ID pra testar:", orgId);

    const { error } = await s
        .from('integracoes_meta')
        .upsert({
            organizacao_id: orgId,
            access_token: 'fake_token',
            nome_conta: 'Teste Ranni',
            meta_user_id: '123456789', // Talvez isso tem que ser BIGINT? ou String?
            status: 'pendente_pagina',
            updated_at: new Date()
        }, { onConflict: 'organizacao_id' });

    console.log(error ? 'ERRO NO BANCO: ' + JSON.stringify(error) : 'INSERÇÃO DE TESTE BEM SUCEDIDA NA ORG!');
}

run();
