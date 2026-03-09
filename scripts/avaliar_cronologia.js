const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    try {
        const { data, error } = await supabase
            .from('lancamentos')
            .select(`
                id, descricao, data_vencimento, data_pagamento, valor,
                contrato_id,
                contratos ( 
                    produtos_empreendimento ( unidade, empreendimentos (nome) ) 
                )
            `)
            .not('contrato_id', 'is', null)
            .order('data_vencimento', { ascending: true });

        if (error) throw error;

        // Group by contrato
        const groups = {};
        for (const r of data) {
            const cid = r.contrato_id;
            if (!groups[cid]) groups[cid] = [];
            groups[cid].push(r);
        }

        const amostra = [];
        let count = 0;

        for (const cid in groups) {
            const items = groups[cid];

            // Tentar descobrir se a primeira é "Entrada" (ex, descricao origina tem 'entrada', 'sinal' ou é mt menor ou destoa).
            // Para ser 100% puro ao pedido do usuario: vamos enumerar pela ordem de VENCIMENTO.

            // Filtrar apenas o sufixo:
            const first = items[0];
            let empName = first.contratos?.produtos_empreendimento?.empreendimentos?.nome || '';
            let unStr = first.contratos?.produtos_empreendimento?.unidade || '';
            if (unStr && !unStr.toLowerCase().startsWith('ap') && !unStr.toLowerCase().startsWith('lote')) {
                if (/^\d+$/.test(unStr.split(' ')[0])) {
                    unStr = "AP " + unStr;
                }
            }
            const sufixo = `${unStr} | ${empName}`;

            // Contar as que sao parcelas ordinarias
            let normalItems = items; // por enquanto, renumera geral.

            normalItems.forEach((item, index) => {
                const total = normalItems.length;
                let novaDesc = `Parcela ${index + 1}/${total} - ${sufixo}`;

                // tenta manter termos chaves da velha desc
                const velha = item.descricao.toLowerCase();
                if (velha.includes('entrada') || velha.includes('sinal')) {
                    novaDesc = `Sinal/Entrada - ${sufixo}`;
                } else if (velha.includes('intermediária')) {
                    novaDesc = `Parcela Intermediária - ${sufixo}`;
                } else if (velha.includes('aditivo')) {
                    novaDesc = `Aditivo - ${sufixo}`;
                } else if (velha.includes('saldo remanescente')) {
                    novaDesc = `Saldo Remanescente - ${sufixo}`;
                }

                if (count < 15) {
                    amostra.push({
                        Contrato: cid,
                        Venc: item.data_vencimento,
                        Pag: item.data_pagamento,
                        De: item.descricao,
                        Para: novaDesc
                    });
                    count++;
                }
            });
        }

        fs.writeFileSync('cronologia_pura.json', JSON.stringify(amostra, null, 2), 'utf-8');

    } catch (e) {
        console.error(e);
    }
}
run();
