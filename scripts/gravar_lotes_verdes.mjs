import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function parseBrazilianFloat(str) {
    if(!str) return 0;
    const cleanStr = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanStr);
}

function parseBrazilianDate(str) {
    if(!str) return null;
    const match = str.match(/\d{2}\/\d{2}\/\d{4}/);
    if(!match) return null;
    const parts = match[0].split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
}

async function main() {
    console.log("🔨 Iniciando Gravador Oficial (Trincas 100% Verdes)");
    
    // Obter o ID da categoria destino ("Antecipação de Recebíveis" ou similar)
    const { data: categorias } = await supabase.from('categorias_financeiras')
        .select('id, nome')
        .ilike('nome', '%Antecipa%')
        .limit(1);

    if (!categorias || categorias.length === 0) {
        console.error("❌ Categoria de Antecipação não encontrada! Abortando...");
        return;
    }
    const catId = categorias[0].id;
    console.log(`✅ Categoria Base Selecionada: ${categorias[0].nome} (ID: ${catId})`);

    const dir = 'C:/Projetos/studio57so-v8/EMPRÉSTIMOS/CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS/TXT_EXTRAIDOS/';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.startsWith('_'));
    const borderos = [];

    // Parse files
    for (const filename of files) {
        if (filename.toUpperCase().includes('RELATÓRIO')) continue;
        if (filename.toUpperCase().includes('STUDIO 57.TXT')) continue; 
        
        const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
        const lines = content.split('\n');
        
        const bordero = { filename, dataOperacao: null, valorBruto: 0, boletos: [] };
        let inTable = false;

        for (const line of lines) {
            if (line.includes('DATA DA OPERAÇÃO:')) {
                const parts = line.split('DATA DA OPERAÇÃO:');
                if(parts[1]) bordero.dataOperacao = parseBrazilianDate(parts[1].trim());
            }
            if (line.includes('VALOR BRUTO TOTAL:')) {
                const parts = line.split('VALOR BRUTO TOTAL:');
                if(parts[1]) bordero.valorBruto = parseBrazilianFloat(parts[1].trim());
            }
            if (line.includes('|---|')) { inTable = true; continue; }
            if (inTable && line.startsWith('|') && !line.includes('===') && !line.includes('RESUMO')) {
                const cols = line.split('|').map(c => c.trim()).filter(c => c);
                if (cols.length >= 5 && cols[0].match(/^\d+$/)) { 
                    bordero.boletos.push({ vencimento: parseBrazilianDate(cols[3]), valor: parseBrazilianFloat(cols[4]) });
                }
            } else if (inTable && line.includes('=== RESUMO ===')) { inTable = false; }
        }
        borderos.push(bordero);
    }

    // Buscando banco base
    const { data: contasPassivo } = await supabase.from('contas_financeiras')
        .select('id, nome').ilike('tipo', '%Passivo%');
    const contaIds = contasPassivo ? contasPassivo.map(c => c.id) : [];

    // Todas as receitas para crivo Verde
    const { data: receitas } = await supabase.from('lancamentos')
        .select('id, valor, data_vencimento')
        .in('conta_id', contaIds).eq('tipo', 'Receita');
        
    // A despesa de lote completa (pode abater os centavos batendo a soma do borderô)
    const { data: despesas } = await supabase.from('lancamentos')
        .select('id, valor, transferencia_id')
        .in('conta_id', contaIds).eq('tipo', 'Despesa');

    const universoBoletos = [...(receitas || [])];
    let qtdGravados = 0;

    for (const bordero of borderos) {
        const somaValorFace = bordero.boletos.reduce((acc, b) => acc + b.valor, 0);

        let isPerfeito = true;
        let boletosMapeados = [];
        let tempClone = [...universoBoletos];

        for (const item of bordero.boletos) {
            let idxBoleto = tempClone.findIndex(r => Math.abs(Number(r.valor)) === item.valor && r.data_vencimento === item.vencimento);
            if (idxBoleto !== -1) {
                boletosMapeados.push(tempClone[idxBoleto]);
                tempClone.splice(idxBoleto, 1);
            } else {
                isPerfeito = false; break;
            }
        }

        if (!isPerfeito) continue;
        
        // Consome da lista global
        for(const b of boletosMapeados) {
            let i = universoBoletos.findIndex(r => r.id === b.id);
            if(i !== -1) universoBoletos.splice(i, 1);
        }

        const despesaMatches = (despesas || []).filter(d => 
            Math.abs(Number(d.valor)) === bordero.valorBruto || Math.abs(Number(d.valor)) === somaValorFace
        );

        if (despesaMatches.length === 1) {
            const despesa = despesaMatches[0];
            
            if (!despesa.transferencia_id) {
                console.warn(`Lote Verde ${bordero.dataOperacao}: ignorado por falta de transferencia_id na despesa ${despesa.id}`);
                continue;
            }
            
            // Fazer um Group_ID novinho em folha
            const novoGrupoId = crypto.randomUUID();
            
            // PEÇA 1 - Injetar o Grupo ID em todos os boletos
            const boletoIds = boletosMapeados.map(b => b.id);
            await supabase.from('lancamentos').update({ antecipacao_grupo_id: novoGrupoId }).in('id', boletoIds);
            
            // PEÇAS 2 e 3 - Injetar o Grupo ID E mudar a Categoria nas transferências "espelho" amarradas pelo identificador antigo
            const { error: erroTransf } = await supabase.from('lancamentos')
                .update({ 
                    antecipacao_grupo_id: novoGrupoId,
                    categoria_id: catId
                })
                .eq('transferencia_id', despesa.transferencia_id);
                
            if (erroTransf) {
                console.error(`Erro ao atualizar a transferência dupla ${despesa.transferencia_id}`, erroTransf);
            } else {
                qtdGravados++;
                console.log(`[SUCESSO] Lote ${bordero.dataOperacao} migrou 100%! UUID Lote: ${novoGrupoId}`);
            }
        }
    }

    console.log(`\n🎉 Operação concluída! ${qtdGravados} lotes verdes foram permanentemente agrupados e categorizados no Supabase.`);
}

main().catch(console.error);
