// hooks/financeiro/useRelatorioDRE.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { formatarFiltrosParaBanco } from '@/utils/financeiro/formatarFiltros';

export function useRelatorioDRE(filtros) {
    const supabase = createClient();
    const filtrosParaBanco = formatarFiltrosParaBanco(filtros);

    // 1. Buscar TODAS as categorias da Organização
    const { data: categorias, isLoading: categoriasLoading } = useQuery({
        queryKey: ['categorias-dre', filtros.organizacaoId],
        queryFn: async () => {
            if (!filtros.organizacaoId) return [];
            const { data, error } = await supabase
                .from('categorias_financeiras')
                .select('*')
                .eq('organizacao_id', filtros.organizacaoId)
                .order('nome');

            if (error) {
                console.error("Erro ao buscar categorias DRE:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!filtros.organizacaoId,
        staleTime: 5 * 60 * 1000 // 5 minutos de cache
    });

    // 2. Buscar Lançamentos Filtrados do Período
    const { data: lancamentos, isLoading: lancamentosLoading } = useQuery({
        queryKey: ['lancamentos-dre', filtros.organizacaoId, filtrosParaBanco],
        queryFn: async () => {
            if (!filtros.organizacaoId) return [];
            // Usamos a mesma RPC poderosa do painel para garantir que os filtros 
            // de data, conta bancária, pessoa, etc sejam rigorosamente respeitados.
            const { data, error } = await supabase.rpc('consultar_lancamentos_filtrados', {
                p_organizacao_id: filtros.organizacaoId,
                p_filtros: {
                    ...filtrosParaBanco,
                    // Ignorar transferências reais e estornos para não inflar DRE
                    ignoreTransfers: true
                }
            });

            if (error) {
                console.error("Erro ao buscar lançamentos DRE:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!filtros.organizacaoId,
        staleTime: 60000 // 1 minuto
    });

    // ============================================================================
    // 🧠 MOTOR DE PROCESSAMENTO DO DRE
    // ============================================================================

    const processarDRE = () => {
        if (!categorias || !lancamentos) return null;

        // Apenas lançamentos Pagos/Recebidos ("Realizado") para DRE de Caixa
        // Ou se quiser DRE de Competência, teria que validar a Data. 
        // Por padrão no financeiro, vamos somar os que estão PAGO/RECEBIDO
        const lancamentosEfetivos = lancamentos.filter(l =>
            l.status === 'Pago' || l.status === 'Conciliado' || l.conciliado === true
        );

        // Dicionário rápido de categorias para achar o Parent
        const catMap = {};
        categorias.forEach(c => { catMap[c.id] = c; });

        // Estrutura Base do DRE com Fallback (caso a mestre tenha sido deletada ou falha na rede)
        const dre = {
            receitaBruta: { mestre: categorias.find(c => c.nome.startsWith('1.')) || { nome: '1. Receita Bruta' }, total: 0, filhas: {} },
            deducoes: { mestre: categorias.find(c => c.nome.startsWith('2.')) || { nome: '2. Deduções da Receita Bruta' }, total: 0, filhas: {} },
            custos: { mestre: categorias.find(c => c.nome.startsWith('3.')) || { nome: '3. Custos Operacionais' }, total: 0, filhas: {} },
            despesasOperacionais: { mestre: categorias.find(c => c.nome.startsWith('4.')) || { nome: '4. Despesas Operacionais' }, total: 0, filhas: {} },
            receitasFinanceiras: { mestre: categorias.find(c => c.nome.startsWith('5.1')) || { nome: '5.1 Receitas Financeiras' }, total: 0, filhas: {} },
            despesasFinanceiras: { mestre: categorias.find(c => c.nome.startsWith('5.2')) || { nome: '5.2 Despesas Financeiras' }, total: 0, filhas: {} },
            impostosLucro: { mestre: categorias.find(c => c.nome.startsWith('6.')) || { nome: '6. IRPJ e CSLL' }, total: 0, filhas: {} },
            naoClassificado: { mestre: { nome: 'Não Classificado/Sem Categoria' }, total: 0, filhas: {} }
        };

        // Função auxiliar para somar e alocar
        const alocarLancamento = (lancamento, grupoString) => {
            // Pega o id da categoria filha
            const catId = lancamento.categoria_id;
            const categoria = catMap[catId];
            const nomeFilha = categoria ? categoria.nome : 'Sem Categoria';

            if (!dre[grupoString].filhas[nomeFilha]) {
                dre[grupoString].filhas[nomeFilha] = {
                    id: catId,
                    nome: nomeFilha,
                    total: 0,
                    // Aqui podemos guardar os lancamentos se quisermos um drill-down super detalhado no futuro
                    lancamentos: []
                };
            }

            const valor = Number(lancamento.valor) || 0;
            dre[grupoString].filhas[nomeFilha].total += valor;
            dre[grupoString].filhas[nomeFilha].lancamentos.push(lancamento);
            dre[grupoString].total += valor;
        };

        // Distribuir os lançamentos
        lancamentosEfetivos.forEach(lanc => {
            const cat = catMap[lanc.categoria_id];

            if (!cat) {
                alocarLancamento(lanc, 'naoClassificado');
                return;
            }

            // Descobrir a qual "Mestre" essa categoria pertence
            let raizId = cat.id;
            let iteracoes = 0;
            // Sobe na árvore até achar o pai null
            while (catMap[raizId] && catMap[raizId].parent_id && iteracoes < 5) {
                raizId = catMap[raizId].parent_id;
                iteracoes++;
            }

            const raiz = catMap[raizId];
            if (!raiz) {
                alocarLancamento(lanc, 'naoClassificado');
                return;
            }

            // Aloca conforme o nome ou ID da raiz
            if (raiz.nome.startsWith('1.')) alocarLancamento(lanc, 'receitaBruta');
            else if (raiz.nome.startsWith('2.')) alocarLancamento(lanc, 'deducoes');
            else if (raiz.nome.startsWith('3.')) alocarLancamento(lanc, 'custos');
            else if (raiz.nome.startsWith('4.')) alocarLancamento(lanc, 'despesasOperacionais');
            else if (raiz.nome.startsWith('5.1')) alocarLancamento(lanc, 'receitasFinanceiras');
            else if (raiz.nome.startsWith('5.2')) alocarLancamento(lanc, 'despesasFinanceiras');
            else if (raiz.nome.startsWith('6.')) alocarLancamento(lanc, 'impostosLucro');
            else alocarLancamento(lanc, 'naoClassificado');
        });

        // Converter 'filhas' de Objeto para Array ordenado (por valor decrescente ou nome)
        Object.keys(dre).forEach(key => {
            dre[key].filhasArray = Object.values(dre[key].filhas).sort((a, b) => b.total - a.total);
        });

        // Cálculos de Totalizações do DRE
        const receitaLiquida = dre.receitaBruta.total - dre.deducoes.total;
        const lucroBruto = receitaLiquida - dre.custos.total;

        // Resultado antes do Financeiro = Lucro Bruto - Despesas Operacionais
        const resultadoOperacional = lucroBruto - dre.despesasOperacionais.total;

        // Resultado antes do IR/CSLL
        const resultadoAntesImpostos = resultadoOperacional + dre.receitasFinanceiras.total - dre.despesasFinanceiras.total;

        // Lucro Líquido
        const lucroLiquido = resultadoAntesImpostos - dre.impostosLucro.total;

        // Margens
        const margemBruta = dre.receitaBruta.total > 0 ? (lucroBruto / dre.receitaBruta.total) * 100 : 0;
        const margemLiquida = dre.receitaBruta.total > 0 ? (lucroLiquido / dre.receitaBruta.total) * 100 : 0;

        return {
            grupos: dre,
            totais: {
                receitaLiquida,
                lucroBruto,
                resultadoOperacional,
                resultadoAntesImpostos,
                lucroLiquido,
                margemBruta,
                margemLiquida
            }
        };
    };

    const dadosDRE = processarDRE();

    return {
        dadosDRE,
        isLoading: categoriasLoading || lancamentosLoading
    };
}
