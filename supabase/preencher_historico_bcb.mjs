// supabase/preencher_historico_bcb.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurando as variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos em .env.local");
  process.exit(1);
}

// Bypassa as regras de RLS (Row Level Security) rodando como administrador
const supabase = createClient(supabaseUrl, supabaseKey);

const BCB_SERIES = {
    'IPCA': { codigo: 433, descricao: 'Índice Nacional de Preços ao Consumidor Amplo (IBGE)' },
    'INPC': { codigo: 188, descricao: 'Índice Nacional de Preços ao Consumidor (IBGE)' },
    'IGP-M': { codigo: 189, descricao: 'Índice Geral de Preços - Mercado (FGV)' },
    'IGP-DI': { codigo: 190, descricao: 'Índice Geral de Preços - Disponibilidade Interna (FGV)' },
    'INCC': { codigo: 192, descricao: 'Índice Nacional de Custo da Construção (FGV)' },
    'IPC-FIPE': { codigo: 73, descricao: 'Índice de Preços ao Consumidor do Município de São Paulo (FIPE)' },
    'SELIC': { codigo: 4390, descricao: 'Taxa SELIC acumulada no mês (% a.m.)' },
    'CDI': { codigo: 4391, descricao: 'CDI acumulado no mês (% a.m.)' },
    'TR': { codigo: 226, descricao: 'Taxa Referencial (BCB)' }
};

async function buscarHistorico(nomeIndice, dataInicial, dataFinal) {
    const config = BCB_SERIES[nomeIndice];
    const serieCode = config.codigo;
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieCode}/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
    
    console.log(`📡 Buscando ${nomeIndice} na API do Banco Central (${dataInicial} a ${dataFinal})...`);
    
    // fetch nativo no NodeJS
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const dados = await resp.json();
    
    // Para a TR (226), a API pode retornar dados para todos os dias do mês.
    // Vamos filtrar para pegar apenas o valor base associado ao dia "01".
    let dadosTratados = dados;
    if (nomeIndice === 'TR') {
         dadosTratados = dados.filter(d => d.data.startsWith('01/'));
    }

    return dadosTratados.map(d => {
        const [dia, mes, ano] = d.data.split('/');
        return {
            nome_indice: nomeIndice,
            mes_ano: `${mes}/${ano}`,
            data_referencia: `${ano}-${mes}-01`,
            valor_mensal: parseFloat(d.valor),
            descricao: config.descricao,
            organizacao_id: 1 // Pertence à Matriz Studio 57
        };
    });
}

async function main() {
    console.log("🚀 Iniciando motor de carga histórica do BCB...");
    
    // Vamos puxar mais de 2 anos de histórico para ter bastante base para o Simulador
    const dataInicial = '01/01/2024';
    
    // Pega a data de hoje no formato de lá (DD/MM/YYYY)
    const hoje = new Date();
    const dataFinal = `${hoje.getDate().toString().padStart(2, '0')}/${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;
    
    try {
        const indices = Object.keys(BCB_SERIES);
        let totalInseridos = 0;
        
        for (const indice of indices) {
            const historico = await buscarHistorico(indice, dataInicial, dataFinal);
            console.log(`✅ Recebidos ${historico.length} meses divulgados para o ${indice}. Injetando no banco...`);
            
            for (const item of historico) {
                const { data, error } = await supabase
                    .from('indices_governamentais')
                    .insert([item])
                    .select();
                
                if (error) {
                    // Ignora duplicações (pois já botamos constraint UNIQUE pra evitar sujeira)
                    if (error.code === '23505') {
                        // console.log(`Ignorando duplicado: ${item.nome_indice} - ${item.mes_ano}`);
                    } else {
                        console.error(`🚨 Erro ao salvar ${indice} de ${item.mes_ano}:`, error.message);
                    }
                } else {
                    totalInseridos++;
                }
            }
        }
        
        console.log(`\n🎉 Carga Total Concluída! Foram inseridos ${totalInseridos} índices com sucesso.`);
    } catch (e) {
        console.error("❌ Falha crítica no processamento:", e);
    }
}

main();
