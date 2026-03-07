require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixDocumentos() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar Service Role para bypass RLS

    if (!supabaseUrl || !supabaseKey) {
        console.error("Faltando variáveis de ambiente!");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Pega a organização atual do Ranniere
        const { data: usuario, error: errUser } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .limit(1)
            .single();

        if (errUser) throw errUser;
        const orgId = usuario.organizacao_id;
        console.log("Organização Encontrada:", orgId);

        // 2. Busca todos os tipos de documento que não têm organizacao_id
        const { data: tiposSemOrg, error: errBusca } = await supabase
            .from('documento_tipos')
            .select('*')
            .is('organizacao_id', null);

        if (errBusca) throw errBusca;

        console.log(`Encontrados ${tiposSemOrg.length} tipos de documento sem organização.`);

        if (tiposSemOrg.length > 0) {
            // 3. Atualiza todos para essa organização (ou duplica se o sistema tiver multi-orgs reais,
            // mas como é a conta primária, vamos só associar)
            const { error: errUpdate } = await supabase
                .from('documento_tipos')
                .update({ organizacao_id: orgId })
                .is('organizacao_id', null);

            if (errUpdate) throw errUpdate;
            console.log("Tipos de documento atualizados com sucesso!");
        } else {
            console.log("Nada para atualizar.");
        }

    } catch (e) {
        console.error("Erro:", e);
    }
}

fixDocumentos();
