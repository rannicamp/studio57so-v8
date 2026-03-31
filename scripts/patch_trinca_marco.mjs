import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function arredondar(valor) {
    return Math.round(Number(valor) * 100) / 100;
}

const grupos = [
    {
        nome: "04/03/2026",
        data: '2026-03-04',
        alvo: 30688.02,
        boletos: [
            { id: 7752, original: 4333.333333, alvo: 4333.33 },
            { id: 9014, original: 8017.194444, alvo: 8017.19 },
            { id: 8797, original: 4276.91, alvo: 4276.91 },
            { id: 8054, original: 4170.833333, alvo: 4170.83 },
            { id: 10704, original: 4205.83, alvo: 4205.83 },
            { id: 16569, original: 1925.00, alvo: 1925.00 },
            { id: 6762, original: 1925.00, alvo: 1925.00 },
            { id: 7982, original: 1833.93, alvo: 1833.93 }
        ]
    },
    {
        nome: "06/03/2026",
        data: '2026-03-06',
        alvo: 30688.02,
        boletos: [
            { id: 7753, original: 4333.333333, alvo: 4333.33 },
            { id: 9015, original: 8017.194444, alvo: 8017.19 },
            { id: 8798, original: 4276.91, alvo: 4276.91 },
            { id: 8055, original: 4170.833333, alvo: 4170.83 },
            { id: 10705, original: 4205.83, alvo: 4205.83 },
            { id: 16560, original: 1925.00, alvo: 1925.00 },
            { id: 6763, original: 1925.00, alvo: 1925.00 },
            { id: 7983, original: 1833.93, alvo: 1833.93 }
        ]
    },
    {
        nome: "10/03/2026",
        data: '2026-03-10',
        alvo: 20386.36,
        boletos: [
            { id: 7754, original: 4333.333333, alvo: 4333.33 },
            { id: 9016, original: 8017.194444, alvo: 8017.19 },
            { id: 8799, original: 4276.91, alvo: 4276.91 },
            { id: 6764, original: 1925.00, alvo: 1925.00 },
            { id: 7984, original: 1833.93, alvo: 1833.93 }
        ]
    }
];

async function main() {
    console.log("=== INICIANDO A CRIAÇÃO DOS 3 MESTRES DE LASTRO ===");

    for (const grupo of grupos) {
        console.log(`\n\n--- Processando Lote ${grupo.nome} ---`);
        const groupUuid = crypto.randomUUID();
        
        // 1. Validando matemática dos filhos
        let soma = 0;
        for (const bola of grupo.boletos) {
            soma += bola.alvo;
        }
        soma = arredondar(soma);
        if(soma !== grupo.alvo) {
            console.error(`❌ MATEMÁTICA INVÁLIDA NO LOTE ${grupo.nome} (${soma} != ${grupo.alvo}). ABORTANDO LOTE!`);
            continue;
        }
        console.log(`✅ Soma matemática cravada em R$ ${soma}.`);

        // 2. Criar a Transferência Mestra na Conta 31
        const novoMestre = {
            tipo: 'Receita',
            valor: grupo.alvo,
            descricao: `TRANSFERÊNCIA - SICOOB (LOTE ${grupo.nome.substring(0,5)}) [Mestre Gerado via IA aguardando OFX]`,
            conta_id: 31,
            categoria_id: 351,
            data_vencimento: grupo.data,
            data_pagamento: grupo.data,
            antecipacao_grupo_id: groupUuid,
            transferencia_id: groupUuid,
            organizacao_id: 1,
            conciliado: false
        };
        
        const { data: res, error: err } = await supabase.from('lancamentos').insert(novoMestre).select('id');
        if (err || !res) {
            console.error("❌ ERRO AO CRIAR MESTRE:", err);
            continue;
        }
        console.log(`🎯 MESTRE CRIADO! ID: ${res[0].id} | Valor: R$ ${grupo.alvo} | Conta: 31`);

        // 3. Atualizar e migrar cada boleto para a Conta 33
        for(const bola of grupo.boletos) {
             const updates = {
                 valor: bola.alvo,
                 conta_id: 33,
                 categoria_id: 351,
                 antecipacao_grupo_id: groupUuid
             };
             const { error: errPupil } = await supabase.from('lancamentos').update(updates).eq('id', bola.id);
             if (errPupil) {
                 console.error(`   ❌ ERRO no Boleto ${bola.id}:`, errPupil);
             } else {
                 console.log(`   ✔️ Boleto ${bola.id} purificado p/ ${bola.alvo} e migrado à Conta 33!`);
             }
        }
        console.log(`🟢 LOTE ${grupo.nome} FINALIZADO E ENCAPSULADO COM SUCESSO!`);
    }

    console.log("\n✅ MATRIZ CONCLUÍDA!");
}
main().catch(console.error);
