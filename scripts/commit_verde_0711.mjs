import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🔒 Selando o Lote 07/11/2025 no Banco de Dados...");

    // 1. Achar a Conta Passivo
    const { data: cPassivo } = await supabase.from('contas_financeiras')
        .select('id').ilike('tipo', '%Passivo%').limit(1);
    const passivo_id = cPassivo[0].id;

    // 2. Achar a Categoria "Antecipação de Recebíveis"
    const { data: categorias } = await supabase.from('categorias_financeiras')
        .select('id, nome').ilike('nome', '%Antecipa%').limit(1);
    const catId = categorias[0].id;

    // TRANSFERÊNCIA ALVO (Saída Bruta do Lote 07/11)
    const transferenciaId = '0251957c-241c-4334-92a5-a2d3df427154'; // Pegamos do artefato anterior
    
    // Gerar UUID novo para o Grupo
    const novoGrupoId = crypto.randomUUID();

    console.log(`Gerado UUID de Grupo: ${novoGrupoId}`);

    // == PEÇA 2 e 3: Atualizar todas as pernas da Transferência para virar Antecipação ==
    const { error: erroT } = await supabase.from('lancamentos').update({
        antecipacao_grupo_id: novoGrupoId,
        categoria_id: catId
    }).eq('transferencia_id', transferenciaId);

    if (erroT) {
        console.error("Erro ao atualizar transferência:", erroT);
        return;
    }
    console.log("✅ Transferência (Crédito na Corrente e Débito no Passivo) atualizada com UUID e Categoria Antecipação!");

    // == PEÇA 1: Atualizar os Boletos (Receitas) exatos que pertencem a esse lote ==
    // Valores do Borderô 07/11:
    // 2x 4.333,33 (em 22/01/2026 e 22/12/2025)
    // 1x 26.000,00 (em 22/01/2026)
    // 2x 4.495,12 (em 20/01/2026 e 20/12/2025) - Os que patcheamos agorinha!
    // 2x 7.706,37 (em 15/01/2026 e 15/12/2025) - Os que vc editou a data na tela!
    
    const targets = [
        { v: 4333.33, d: '2026-01-22' },
        { v: 4333.33, d: '2025-12-22' },
        { v: 26000.00, d: '2026-01-22' },
        { v: 4495.12, d: '2026-01-20' },
        { v: 4495.12, d: '2025-12-20' },
        { v: 7706.37, d: '2026-01-15' },
        { v: 7706.37, d: '2025-12-15' }
    ];

    const boletosIdsAAtualizar = [];

    // Pegar todos as receitas do passivo
    const { data: bda } = await supabase.from('lancamentos')
        .select('id, valor, data_vencimento')
        .eq('conta_id', passivo_id).eq('tipo', 'Receita')
        .is('antecipacao_grupo_id', null);

    const dsC = [...bda];

    for (const t of targets) {
        const idx = dsC.findIndex(x => Math.abs(Number(x.valor)) === t.v && x.data_vencimento === t.d);
        if (idx !== -1) {
            boletosIdsAAtualizar.push(dsC[idx].id);
            dsC.splice(idx, 1);
        } else {
            console.error(`⚠️ ATENÇÃO: Não localizei no Passivo o boleto de R$ ${t.v} em ${t.d}`);
        }
    }

    if (boletosIdsAAtualizar.length === 7) {
        const { error: erroB } = await supabase.from('lancamentos').update({
            antecipacao_grupo_id: novoGrupoId
            // NOTA: NÃO MUDAMOS A CATEGORIA DOS BOLETOS (Mantém "Vendas" ou "Residencial Alfa").
        }).in('id', boletosIdsAAtualizar);

        if (!erroB) {
           console.log("✅ Todos os 7 boletos do lote foram oficializados com o UUID de agrupamento!");
        } else {
           console.error(erroB);
        }
    } else {
        console.log(`Pausando agrupamento dos boletos. Achei apenas ${boletosIdsAAtualizar.length} dos 7 esperados.`);
        console.log("IDs encontrados:", boletosIdsAAtualizar);
    }
}

main().catch(console.error);
