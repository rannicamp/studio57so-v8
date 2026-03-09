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

        // Agrupar por contrato
        const groups = {};
        for (const r of data) {
            const cid = r.contrato_id;
            if (!groups[cid]) groups[cid] = [];
            groups[cid].push(r);
        }

        const updates = [];

        for (const cid in groups) {
            const items = groups[cid];
            if (items.length === 0) continue;

            const first = items[0];
            let empName = first.contratos?.produtos_empreendimento?.empreendimentos?.nome || '';
            let unStr = first.contratos?.produtos_empreendimento?.unidade || '';

            if (unStr && !unStr.toLowerCase().startsWith('ap') && !unStr.toLowerCase().startsWith('lote')) {
                if (/^\d+$/.test(unStr.split(' ')[0])) {
                    unStr = "AP " + unStr;
                }
            }
            const sufixo = `${unStr} | ${empName}`;

            const normalItems = [];
            const execItems = [];

            // Separar normais de excecoes para nao afetar o denominador da proporcao (X/Total)
            items.forEach(item => {
                const desc = item.descricao.toLowerCase();
                let novaDesc = '';

                if (desc.includes('entrada') || desc.includes('sinal')) {
                    novaDesc = `Sinal/Entrada - ${sufixo}`;
                    execItems.push({ id: item.id, newDesc: novaDesc });
                } else if (desc.includes('intermediária')) {
                    novaDesc = `Parcela Intermediária - ${sufixo}`;
                    execItems.push({ id: item.id, newDesc: novaDesc });
                } else if (desc.includes('aditivo')) {
                    novaDesc = `Aditivo - ${sufixo}`;
                    execItems.push({ id: item.id, newDesc: novaDesc });
                } else if (desc.includes('saldo remanescente')) {
                    novaDesc = `Saldo Remanescente - ${sufixo}`;
                    execItems.push({ id: item.id, newDesc: novaDesc });
                } else if (desc.includes('correção') || desc.includes('complementar')) {
                    novaDesc = `Correção/Complementar - ${sufixo}`;
                    execItems.push({ id: item.id, newDesc: novaDesc });
                } else if (desc.includes('permuta')) {
                    novaDesc = `Permuta - ${sufixo}`;
                    execItems.push({ id: item.id, newDesc: novaDesc });
                } else {
                    normalItems.push(item);
                }
            });

            // Re-numerar as normais em ordem cronologica de vencimento
            const totalNormal = normalItems.length;
            normalItems.forEach((item, index) => {
                const novaDesc = `Parcela ${index + 1}/${totalNormal} - ${sufixo}`;
                updates.push({ id: item.id, descricao: novaDesc });
            });

            // Somar as excecoes
            execItems.forEach(e => {
                updates.push({ id: e.id, descricao: e.newDesc });
            });
        }

        console.log(`Aplicando ${updates.length} atualizações cronológicas super precisas...`);

        let successCount = 0;
        let errCount = 0;
        const CHUNK_SIZE = 50;

        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(async (upd) => {
                const { error: updErr } = await supabase
                    .from('lancamentos')
                    .update({ descricao: upd.descricao })
                    .eq('id', upd.id);

                if (updErr) {
                    errCount++;
                    console.error("Falha id", upd.id, updErr.message);
                } else {
                    successCount++;
                }
            });

            await Promise.all(promises);
            console.log(`Lote ${(i / CHUNK_SIZE) + 1} finalizado. Sucesso: ${successCount}. Erros: ${errCount}`);
        }

        console.log("Renomacao cronologica e categorica totalmente concluida com sucesso.");

    } catch (e) {
        console.error("Fatal Error", e);
    }
}
run();
