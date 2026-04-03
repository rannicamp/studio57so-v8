const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/projetos/studio57so-v8-main/.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  try {
    const fs = require('fs');
    let output = '';
    const log = (str) => { output += str + '\n'; };
    const { data: rotina, error: err } = await supabase.from('contas_financeiras')
       .select('id, nome, organizacao_id')
       .ilike('nome', '%6482%');
    if (!rotina || rotina.length === 0) { 
        log('Cartão não encontrado.'); fs.writeFileSync('c:/tmp/audit_results.md', output);
        return; 
    }
    
    const contaId = rotina[0].id;
    log("=== Conta Encontrada ===");
    log(`ID: ${contaId} | Nome: ${rotina[0].nome}`);
    
    const { data: faturas, error: errFat } = await supabase.from('faturas_cartao')
        .select('*')
        .eq('conta_id', contaId)
        .order('data_vencimento', { ascending: true });
    
    log("\n=== Faturas Cadastradas ===");
    faturas.forEach(f => log(`ID: ${f.id} Venc: ${f.data_vencimento} Fech: ${f.data_fechamento}`));
    
    const { data: lancs, error: errLan } = await supabase.from('lancamentos')
        .select('fatura_id, valor, tipo, descricao, data_transacao, categoria_id')
        .eq('conta_id', contaId)
        .order('data_transacao');
        
    log("\n=== Lançamentos Associados ===");
    const sumarioFaturas = {};
    for (const l of (lancs || [])) {
        if (!l.fatura_id) continue;
        if (!sumarioFaturas[l.fatura_id]) sumarioFaturas[l.fatura_id] = { gastos: 0, pagamentos: 0, extrato: [] };
        
        sumarioFaturas[l.fatura_id].extrato.push(`${l.data_transacao} - ${l.tipo} - R$ ${l.valor} - ${l.descricao.substring(0,20)} (CAT: ${l.categoria_id})`);
        
        const valorAbs = Math.abs(Number(l.valor) || 0);
        // Considerando 370 como pagamento de fatura, ou tipo receita/despesa dependendo
        if (l.categoria_id === 370) {
            if (l.tipo === 'Receita') sumarioFaturas[l.fatura_id].pagamentos += valorAbs;
            else if (l.tipo === 'Despesa') sumarioFaturas[l.fatura_id].pagamentos -= valorAbs;
        } else {
            if (l.tipo === 'Despesa') sumarioFaturas[l.fatura_id].gastos += valorAbs;
            if (l.tipo === 'Receita') sumarioFaturas[l.fatura_id].gastos -= valorAbs;
        }
    }
    
    for (const f of (faturas || [])) {
        log(`\n-- Fatura ID ${f.id} (Venc: ${f.data_vencimento}) --`);
        if (!sumarioFaturas[f.id]) {
            log(`Nenhum lançamento`);
            continue;
        }
        log(`Total Gastos: R$ ${sumarioFaturas[f.id].gastos.toFixed(2)}`);
        log(`Total Pagamentos: R$ ${sumarioFaturas[f.id].pagamentos.toFixed(2)}`);
        log(`Lançamentos:`);
        sumarioFaturas[f.id].extrato.forEach(ex => log("  " + ex));
    }
    fs.writeFileSync('c:/tmp/audit_results.md', output);
    
  } catch (err) {
      console.error(err);
  }
}
audit();
