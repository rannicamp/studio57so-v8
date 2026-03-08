require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltando variaveis de ambiente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTels() {
    console.log("🔍 Buscando amostras de telefones no banco (Tabela telefones)...\n");

    const { data, error } = await supabase
        .from('telefones')
        .select(`
            id, 
            telefone, 
            country_code, 
            tipo,
            contatos (nome, razao_social)
        `)
        .order('created_at', { ascending: false })
        .limit(25);

    if (error) {
        console.error("❌ Erro ao buscar telefones:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("Nenhum telefone encontrado na tabela.");
        return;
    }

    let comDDI = 0;
    let comNove = 0;

    data.forEach(t => {
        const nome = t.contatos ? (t.contatos.nome || t.contatos.razao_social) : 'Sem nome';
        console.log(`👤 ${nome.padEnd(25).substring(0, 25)} | 🌐 ${t.country_code || 'N/A'} | 📱 ${t.telefone}`);

        const digitos = t.telefone.replace(/\D/g, '');
        if (digitos.startsWith('55')) comDDI++;

        // Se começa com 55 e tem 13 dígitos
        if (digitos.startsWith('55') && digitos.length === 12) {
            // Fixo ou DDI + DDD + 8 = 12 digitos totais ex: 55 33 3271 1234
        }
        if (digitos.startsWith('55') && digitos.length === 13) {
            comNove++;
        }
    });

    console.log(`\n📊 Resumo da Amostra (25 registros):`);
    console.log(`- Começam com '55' no número: ${comDDI}`);
    console.log(`- Possuem o 9º dígito (13 dígitos com DDI 55): ${comNove}`);
    console.log(`- country_code padrão (+55): ${data.filter(t => t.country_code === '+55').length}`);
}

checkTels();
