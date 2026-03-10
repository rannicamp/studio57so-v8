// utils/bcbApi.js
/**
 * Utilitário para integração com a API de Dados Abertos do Banco Central do Brasil (SGS).
 * Documentação da API: https://dadosabertos.bcb.gov.br/
 */

// Mapeamento dos códigos de série temporal (SGS) para os índices comuns
const BCB_SERIES = {
    'IPCA': 433,  
    'IGP-M': 189, 
    'INCC': 192,  
    'INPC': 188,  
    'IGP-DI': 190,
    'IPC-FIPE': 73,
    'SELIC': 4390, 
    'CDI': 4391,   
    'TR': 226     
};

/**
 * Busca o último valor divulgado de um índice específico.
 * 
 * @param {string} nomeIndice - Nome do índice (ex: 'IPCA', 'IGP-M', 'INCC')
 * @returns {Promise<{ mes_ano: string, data_referencia: string, valor_mensal: number } | null>}
 */
export async function buscarUltimoIndice(nomeIndice) {
    const serieCode = BCB_SERIES[nomeIndice.toUpperCase()];
    
    if (!serieCode) {
        throw new Error(`Índice ${nomeIndice} não está mapeado no sistema BCB.`);
    }

    // /ultimos/1 garante que pegaremos apenas o dado mais recente divulgado
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieCode}/dados/ultimos/1?formato=json`;

    try {
        const resposta = await fetch(url, {
             next: { revalidate: 3600 } // Cache opcional de 1h
        });
        
        if (!resposta.ok) {
            throw new Error(`Erro de rede BCB: Status ${resposta.status}`);
        }

        const dados = await resposta.json();

        if (dados && dados.length > 0) {
            const dataOriginal = dados[0].data; // Formato DD/MM/YYYY ex: "01/02/2026"
            const valorIndice = parseFloat(dados[0].valor); // Ex: -0.73

            // Converte "01/02/2026" para o formato que guardamos no banco
            const [dia, mes, ano] = dataOriginal.split('/');
            
            // data_referencia formato ISO para o Postgres ordenar certinho: YYYY-MM-DD
            const dataReferenciaISO = `${ano}-${mes}-01`; 
            
            // mes_ano formato de exibição humano/chave: MM/YYYY
            const mesAno = `${mes}/${ano}`;

            return {
                nome_indice: nomeIndice,
                mes_ano: mesAno,
                data_referencia: dataReferenciaISO,
                valor_mensal: valorIndice
            };
        }
        
        return null;
    } catch (erro) {
        console.error(`Falha ao buscar o índice ${nomeIndice} no Banco Central:`, erro);
        throw erro;
    }
}

/**
 * Busca uma janela de tempo específica para um índice (uso futuro ou setup inicial).
 * 
 * @param {string} nomeIndice 
 * @param {string} dataInicial - formato DD/MM/YYYY
 * @param {string} dataFinal - formato DD/MM/YYYY
 */
export async function buscarHistoricoIndice(nomeIndice, dataInicial, dataFinal) {
    const serieCode = BCB_SERIES[nomeIndice.toUpperCase()];
    if (!serieCode) throw new Error(`Índice ${nomeIndice} não mapeado.`);
    
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieCode}/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
    
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error(`Erro BCB: ${resposta.status}`);
        
        const dados = await resposta.json();
        return dados.map(d => {
            const [dia, mes, ano] = d.data.split('/');
            return {
                nome_indice: nomeIndice,
                mes_ano: `${mes}/${ano}`,
                data_referencia: `${ano}-${mes}-01`,
                valor_mensal: parseFloat(d.valor)
            };
        });
    } catch (erro) {
        console.error(`Falha ao buscar histórico de ${nomeIndice}:`, erro);
        throw erro;
    }
}
