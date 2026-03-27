require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Ignorar RLS para fazer cleanup
);

async function checkAndFixFaturas() {
  console.log("Iniciando varredura e limpeza de faturas fantasma...");

  try {
    // 1. Apagar todas as faturas VAZIAS e não pagas
    const { data: beforeFaturas, error: beforeErr } = await supabase
        .from('faturas_cartao')
        .select('id, mes_referencia');
    if(beforeErr) throw beforeErr;
    console.log(`Antes: ${beforeFaturas.length} faturas no banco.`);

    const { data: deletadas, error: delErr } = await supabase.rpc('query', { 
         query_text: "DELETE FROM public.faturas_cartao WHERE id NOT IN (SELECT DISTINCT fatura_id FROM public.lancamentos WHERE fatura_id IS NOT NULL) AND status != 'Pago' RETURNING id;"
    });
    
    // Fallback pra quando rpc(query) falhar (Supabase via JS pode não suportar se não ativado)
    // Vamos fazer direto via código então
    
    // Obter todas as IDs de faturas que tẽm dependentes
    const { data: faturasComDeps, error: depErr } = await supabase
       .from('lancamentos')
       .select('fatura_id')
       .not('fatura_id', 'is', 'null');
       
    const faturasParaManter = new Set(faturasComDeps.map(l => l.fatura_id));

    // Selecionar aquelas que vamos apagar
    const faturasParaApagar = beforeFaturas.filter(f => !faturasParaManter.has(f.id));

    console.log(`Encontrei ${faturasParaApagar.length} faturas fantasmas ou vazias para remover.`);

    if (faturasParaApagar.length > 0) {
        // Remover lotes pra não dar timeout
        const ids = faturasParaApagar.map(f => f.id);
        const chunkSize = 100;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            await supabase.from('faturas_cartao').delete().in('id', chunk).neq('status', 'Pago');
        }
    }
    console.log("🚀 Faturas fantasmas eliminadas do banco.");

    // Agora forçar update de todos os lançamentos que têm conta tipo "Cartão de Crédito" para o TRIGGER re-agrupar na Fatura Certa
    console.log("Atualizando TODOS os lançamentos de cartão para re-vincular pelas regras perfeitas do Trigger...");

    // Pega as contas que são de cartao
    const {data: contas} = await supabase.from('contas_financeiras').select('id').eq('tipo', 'Cartão de Crédito');
    const contasIds = contas.map(c => c.id);

    if (contasIds.length > 0) {
        const { data: cartaoLancamentos, error: clErr } = await supabase
           .from('lancamentos')
           .select('id, valor, descricao')
           .in('conta_id', contasIds);

        if (cartaoLancamentos && cartaoLancamentos.length > 0) {
            console.log(`Buscando ${cartaoLancamentos.length} transações de cartão para fazer re-merge.`);
            const lIds = cartaoLancamentos.map(l => l.id);

            // Re-fazer UPDATE falso para engatilhar `fn_vincular_lancamento_fatura`
            // Trigger `vincular_lancamento_fatura` roda em AFTER/BEFORE UPSERT e UPDATE.
            // Vou dar UPDATE "atualizado_em = now()" pra forçar o Postgres a acionar.
            const now = new Date().toISOString();
            
            for (let i = 0; i < lIds.length; i += 100) {
                const chunk = lIds.slice(i, i + 100);
                await supabase.from('lancamentos').update({ atualizado_em: now }).in('id', chunk);
            }
            console.log("⏳ Merge re-processado pelas Triggers!");
        }
    }

    console.log("✅ TUDO CONCLUÍDO COM SUCESSO!");

  } catch(e) {
    console.error("ERRO", e);
  }
}

checkAndFixFaturas();
