const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhuvnutzklhskkwbpxdz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodXZudXR6a2xoc2trd2JweGR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjc1MDc5MywiZXhwIjoyMDQyMzI2NzkzfQ.wprEVKNDXXIjHJ32fQQnTBGdMdGLBL7SrXUio5-dDXc'; // Adicionei a key obtida

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Iniciando correção de Tipos de Documento...");

        // Pega a primeira organização disponível (geralmente só tem a do Studio 57)
        const { data: org, error: orgErr } = await supabase.from('organizacoes').select('id').limit(1).single();

        if (orgErr || !org) {
            console.error("Erro ao buscar organização:", orgErr);
            return;
        }

        console.log("Organização encontrada:", org.id);

        const { data: atualizados, error: updateErr } = await supabase
            .from('documento_tipos')
            .update({ organizacao_id: org.id })
            .is('organizacao_id', null)
            .select();

        if (updateErr) {
            console.error("Erro ao atualizar:", updateErr);
        } else {
            console.log(`Tipos de documentos atualizados com sucesso: ${atualizados.length}`);
        }
    } catch (e) {
        console.error("Excessão capturada:", e);
    }
}

run();
