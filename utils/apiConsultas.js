import axios from 'axios';

/**
 * Busca dados da empresa através do CNPJ
 * @param {string} cnpj - CNPJ apenas números ou formatado
 * @returns {Promise<Object>} Dados da empresa (Razão Social, Nome Fantasia, CEP, etc) ou Erro.
 */
export async function buscarCNPJ(cnpj) {
    try {
        const cleanCNPJ = cnpj.replace(/\D/g, '');
        if (cleanCNPJ.length !== 14) {
            throw new Error('CNPJ inválido.');
        }

        // Utilizando a Brasil API (Gratuita, sem CORS e sem Chave)
        const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
        return { data: response.data, error: null };
    } catch (error) {
        if (error.response?.status === 404) {
            return { data: null, error: 'CNPJ não encontrado na Receita Federal.' };
        }
        return { data: null, error: 'Erro ao consultar CNPJ. Tente novamente mais tarde.' };
    }
}

/**
 * Busca dados de endereço através do CEP
 * @param {string} cep - CEP apenas números ou formatado
 * @returns {Promise<Object>} Dados do endereço (Rua, Bairro, Cidade, Estado) ou Erro.
 */
export async function buscarCEP(cep) {
    try {
        const cleanCEP = cep.replace(/\D/g, '');
        if (cleanCEP.length !== 8) {
            throw new Error('CEP inválido.');
        }

        const response = await axios.get(`https://viacep.com.br/ws/${cleanCEP}/json/`);

        if (response.data.erro) {
            return { data: null, error: 'CEP não encontrado.' };
        }

        return { data: response.data, error: null };
    } catch (error) {
        return { data: null, error: 'Erro ao buscar o CEP.' };
    }
}
