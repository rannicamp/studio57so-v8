const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Buscando conta SICOOB...");
    const { data: contas, error: errC } = await supabase
        .from('contas_financeiras')
        .select('id, nome')
        .ilike('nome', '%SICOOB%')
        .limit(10);
        
    if (errC) { console.error("Erro contas:", errC); return; }
    console.log("Contas encontradas:");
    console.table(contas);

    const sicoobId = contas.find(c => c.nome.includes('6482'))?.id || contas[0]?.id;
    if (!sicoobId) { console.log("Conta 6482 não encontrada."); return; }

    console.log(`\n============= CONTA ID: ${sicoobId} =============\n`);

    console.log("--- 1. ÚLTIMOS ARQUIVOS PROCESSADOS (banco_arquivos_ofx) ---");
    const { data: arquivos } = await supabase
        .from('banco_arquivos_ofx')
        .select('id, nome_arquivo, data_upload, status, registros_importados, arquivo_url')
        .eq('conta_id', sicoobId)
        .order('data_upload', { ascending: false })
        .limit(5);
    console.table(arquivos || []);

    console.log("\n--- 2. ÚLTIMAS TRANSAÇÕES DA IA (banco_transacoes_ofx) ---");
    const { data: transacoes } = await supabase
        .from('banco_transacoes_ofx')
        .select('data_transacao, memorando, valor, tipo_transacao')
        .eq('conta_id', sicoobId)
        .order('created_at', { ascending: false })
        .limit(30);
    console.log(`Encontradas ${transacoes?.length || 0} transações recentes.`);
    if (transacoes && transacoes.length > 0) {
        console.table(transacoes);
    }

    console.log("\n--- 3. DETALHES DE FATURAS CARTÃO (faturas_cartao) ---");
    const { data: faturas } = await supabase
        .from('faturas_cartao')
        .select('id, mes_referencia, ano_referencia, valor_total, status, data_vencimento')
        .eq('conta_id', sicoobId)
        .order('ano_referencia', { ascending: false })
        .order('mes_referencia', { ascending: false })
        .limit(5);
    console.table(faturas || []);
}

run();
