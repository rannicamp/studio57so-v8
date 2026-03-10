// supabase/preencher_selic_cdi_tr.mjs
// Script dedicado para carregar SELIC, CDI e TR — que usam séries diferentes do BCB.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: variáveis de ambiente não configuradas.");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Índices com séries MENSAIS do BCB e seus tratamentos especiais
const INDICES_ESPECIAIS = [
    {
        nome: 'SELIC',
        codigo: 4390, // Taxa SELIC acumulada no mês (% a.m.) - SÉRIE MENSAL
        descricao: 'Taxa SELIC acumulada no mês (% a.m.) - BCB',
        filtrarDia: false // Já é mensal, sem filtro
    },
    {
        nome: 'CDI',
        codigo: 4391, // CDI acumulado no mês (% a.m.) - SÉRIE MENSAL
        descricao: 'CDI acumulado no mês (% a.m.)',
        filtrarDia: false // Já é mensal, sem filtro
    },
    {
        nome: 'TR',
        codigo: 226,  // TR mensal (BCB publica 1 por mês, não diariamente aqui)
        descricao: 'Taxa Referencial (BCB)',
        filtrarDia: false
    }
];

async function buscarSerie(item, dataInicial, dataFinal) {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${item.codigo}/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
    console.log(`📡 Buscando ${item.nome} (Série ${item.codigo}): ${url}`);
    const resp = await fetch(url);
    if (!resp.ok) {
        console.log(`❌ HTTP ${resp.status} ao buscar ${item.nome}`);
        return [];
    }
    const dados = await resp.json();
    console.log(`   Retornou ${dados.length} registros. Primeiro: ${JSON.stringify(dados[0])}`);

    // Filtrar apenas registros mensais únicos
    const mesesVistos = new Set();
    const resultado = [];
    for (const d of dados) {
        const [dia, mes, ano] = d.data.split('/');
        const chaveMes = `${mes}/${ano}`;
        if (!mesesVistos.has(chaveMes)) {
            mesesVistos.add(chaveMes);
            resultado.push({
                nome_indice: item.nome,
                mes_ano: chaveMes,
                data_referencia: `${ano}-${mes}-01`,
                valor_mensal: parseFloat(d.valor),
                descricao: item.descricao,
                organizacao_id: 1
            });
        }
    }
    return resultado;
}

async function main() {
    const dataInicial = '01/01/2024';
    const hoje = new Date();
    const dataFinal = `${hoje.getDate().toString().padStart(2, '0')}/${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;

    console.log(`🚀 Iniciando carga de SELIC, CDI e TR (${dataInicial} a ${dataFinal})\n`);

    let totalInseridos = 0;
    for (const item of INDICES_ESPECIAIS) {
        const registros = await buscarSerie(item, dataInicial, dataFinal);
        console.log(`   ✅ ${registros.length} registros mensais únicos para ${item.nome}`);
        for (const reg of registros) {
            const { error } = await supabase.from('indices_governamentais').insert([reg]);
            if (error) {
                if (error.code === '23505') {
                    // já existe, ignorar
                } else {
                    console.error(`   🚨 Erro ao salvar ${item.nome} ${reg.mes_ano}: ${error.message}`);
                }
            } else {
                totalInseridos++;
            }
        }
        console.log(`\n`);
        // Pausa entre chamadas
        await new Promise(r => setTimeout(r, 500));
    }
    console.log(`\n🎉 Concluído! ${totalInseridos} registros inseridos no banco.`);
}

main();
