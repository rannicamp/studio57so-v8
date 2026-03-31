require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function arrumarAbas() {
    console.log("Iniciando correção das tags de aba...");

    // 1. Atualiza Balance e DRE para aba 'contabil'
    const { data: q1, error: e1 } = await supabase
        .from('empresa_anexos')
        .update({ categoria_aba: 'contabil' })
        .eq('empresa_id', 4)
        .eq('categoria_aba', 'juridico_contabil') // O que eu inseri errado
        .eq('tipo_documento_id', 44);
        
    if (e1) console.error("Erro contábil:", e1.message);
    else console.log("Contábeis movidos para a Aba 'contabil'!");

    // 2. Atualiza CND, Requerimentos, CNPJ, Contrato para 'juridico'
    const { data: q2, error: e2 } = await supabase
        .from('empresa_anexos')
        .update({ categoria_aba: 'juridico' })
        .eq('empresa_id', 4)
        .eq('categoria_aba', 'juridico_contabil'); // Todo o resto que sobrou da minha injeção
        
    if (e2) console.error("Erro jurídico:", e2.message);
    else console.log("Jurídicos movidos para a Aba 'juridico'!");

    console.log("Banco de dados corrigido! Pode atualizar o F5 no painel web.");
}

arrumarAbas();
