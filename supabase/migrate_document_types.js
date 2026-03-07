const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Simple parser for .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const envLines = envFile.split('\n');
const envVars = {};
for (const line of envLines) {
    if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
            envVars[key.trim()] = value.trim();
        }
    }
}

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Iniciando migração de Tipos de Documento para a Organização 1 (Elo 57)...");

        // Atualiza todos os tipos de documento que têm organizacao_id nulo para 1
        const { data: atualizadosNulos, error: errNulos } = await supabase
            .from('documento_tipos')
            .update({ organizacao_id: 1 })
            .is('organizacao_id', null)
            .select();

        let totalAtualizados = 0;

        if (errNulos) {
            console.error("Erro ao atualizar os nulos:", errNulos);
        } else {
            console.log(`Tipos de documentos NULOS atualizados para Org 1: ${atualizadosNulos.length}`);
            totalAtualizados += atualizadosNulos.length;
        }

        // Se o usuário quiser forçar TODOS (até os que já têm org diferente de 1) 
        // a virar 1. Mas por segurança, primeiro atualizamos os nulos e vemos se 
        // temos mais a atualizar. Normalmente os globais eram nulos.
        // Vou forçar todos os tipos de documentos existentes antes da organização a serem 1.
        // Já que ele disse "mude todos os tipos de documentos para organização 1".
        const { data: forceAll, error: errForce } = await supabase
            .from('documento_tipos')
            .update({ organizacao_id: 1 })
            .neq('organizacao_id', 1) // apenas os que não são 1
            .select();

        if (errForce) {
            console.error("Erro ao forçar os restantes:", errForce);
        } else {
            console.log(`Outros Tipos de documentos atualizados para Org 1: ${forceAll.length}`);
            totalAtualizados += forceAll.length;
        }

        console.log(`Migração concluída! Total de documentos alterados: ${totalAtualizados}`);

    } catch (e) {
        console.error("Exibindo erro:", e);
    }
}

run();
