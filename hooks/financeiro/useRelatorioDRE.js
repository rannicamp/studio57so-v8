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

    // 2. Buscar Matriz DRE Agrupada (RPC) Geral Otimizada
    const { data: lancamentosAgrupados, isLoading: lancamentosLoading } = useQuery({
        queryKey: ['dre_operacional', filtros.organizacaoId, filtrosParaBanco],
        queryFn: async () => {
            if (!filtros.organizacaoId) return [];
            
            const { data, error } = await supabase.rpc('get_dre_operacional', {
                p_organizacao_id: filtros.organizacaoId,
                p_filtros: {
                    ...filtrosParaBanco,
                    ignoreTransfers: true
                }
            }).limit(50000); 

            if (error) {
                console.error("Erro ao buscar matriz DRE otimizada no servidor:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!filtros.organizacaoId,
        staleTime: 60000 // 1 minuto
    });

    // ============================================================================
    // 🧠 MOTOR DE PROCESSAMENTO DO DRE GERAL MATRIZ
    // ============================================================================

    const processarDRE = () => {
        if (!categorias || !lancamentosAgrupados) return null;

        const catMap = {};
        categorias.forEach(c => { catMap[c.id] = c; });

        const colunasSet = new Set();

        const dre = {
            receitaBruta: { mestre: categorias.find(c => c.nome.startsWith('1.')) || { nome: '1. Receita Bruta' }, total: 0, mensal: {}, filhas: {} },
            deducoes: { mestre: categorias.find(c => c.nome.startsWith('2.')) || { nome: '2. Deduções' }, subtrair: true, total: 0, mensal: {}, filhas: {} },
            custos: { mestre: categorias.find(c => c.nome.startsWith('3.')) || { nome: '3. Custos Operacionais' }, subtrair: true, total: 0, mensal: {}, filhas: {} },
            despesasOperacionais: { mestre: categorias.find(c => c.nome.startsWith('4.')) || { nome: '4. Despesas Operacionais' }, subtrair: true, total: 0, mensal: {}, filhas: {} },
            receitasFinanceiras: { mestre: categorias.find(c => c.nome.startsWith('5.1')) || { nome: '5.1 Receitas Financeiras' }, total: 0, mensal: {}, filhas: {} },
            despesasFinanceiras: { mestre: categorias.find(c => c.nome.startsWith('5.2')) || { nome: '5.2 Despesas Financeiras' }, subtrair: true, total: 0, mensal: {}, filhas: {} },
            impostosLucro: { mestre: categorias.find(c => c.nome.startsWith('6.')) || { nome: '6. IRPJ e CSLL' }, subtrair: true, total: 0, mensal: {}, filhas: {} },
            naoClassificado: { mestre: { nome: 'Não Classificado/Sem Categoria' }, total: 0, mensal: {}, filhas: {} }
        };

        let totaisMensais = {};

        const alocarLancamento = (lancamentoAgrupado, grupoString) => {
            const catId = lancamentoAgrupado.categoria_id;
            const categoria = catMap[catId];
            const nomeFilha = categoria ? categoria.nome : 'Sem Categoria';

            const chaveMes = lancamentoAgrupado.ano_mes;
            if(chaveMes) colunasSet.add(chaveMes);

            let alvo = dre[grupoString];

            if (!alvo.filhas[nomeFilha]) {
                alvo.filhas[nomeFilha] = {
                    id: catId,
                    nome: nomeFilha,
                    total: 0,
                    mensal: {}
                };
            }

            // BD envia Receitas (+), Despesas (-)
            // Porem num relatorio contabil DRE Geral, o normal é tratar positivo e acumular nas chaves pra soma.
            const valor = Number(lancamentoAgrupado.total) || 0;

            if(chaveMes) {
                // Adiciona na Filha
                alvo.filhas[nomeFilha].total += valor;
                if(!alvo.filhas[nomeFilha].mensal[chaveMes]) alvo.filhas[nomeFilha].mensal[chaveMes] = 0;
                alvo.filhas[nomeFilha].mensal[chaveMes] += valor;
    
                // Adiciona no Grupo Pai
                if(!alvo.mensal[chaveMes]) alvo.mensal[chaveMes] = 0;
                alvo.mensal[chaveMes] += valor;
            }

            alvo.total += valor;
        };

        lancamentosAgrupados.forEach(lanc => {
            const cat = catMap[lanc.categoria_id];

            if (!cat) {
                alocarLancamento(lanc, 'naoClassificado');
                return;
            }

            let raizId = cat.id;
            let iteracoes = 0;
            while (catMap[raizId] && catMap[raizId].parent_id && iteracoes < 5) {
                raizId = catMap[raizId].parent_id;
                iteracoes++;
            }

            const raiz = catMap[raizId];
            if (!raiz) {
                alocarLancamento(lanc, 'naoClassificado');
                return;
            }

            if (raiz.nome.startsWith('1.')) alocarLancamento(lanc, 'receitaBruta');
            else if (raiz.nome.startsWith('2.')) alocarLancamento(lanc, 'deducoes');
            else if (raiz.nome.startsWith('3.')) alocarLancamento(lanc, 'custos');
            else if (raiz.nome.startsWith('4.')) alocarLancamento(lanc, 'despesasOperacionais');
            else if (raiz.nome.startsWith('5.1')) alocarLancamento(lanc, 'receitasFinanceiras');
            else if (raiz.nome.startsWith('5.2')) alocarLancamento(lanc, 'despesasFinanceiras');
            else if (raiz.nome.startsWith('6.')) alocarLancamento(lanc, 'impostosLucro');
            else alocarLancamento(lanc, 'naoClassificado');
        });

        // Ordenar colunas baseadas nas chaves reais retornadas
        const colunasOrdenadas = Array.from(colunasSet).sort();

        // Object -> Array (Filhas)
        Object.keys(dre).forEach(key => {
            dre[key].filhasArray = Object.values(dre[key].filhas).sort((a,b) => b.total - a.total);
        });

        // Totais e Subtotalizações em Matriz
        const totais = {
            receitaLiquida: { total: 0, mensal: {} },
            lucroBruto: { total: 0, mensal: {} },
            resultadoOperacional: { total: 0, mensal: {} },
            resultadoAntesImpostos: { total: 0, mensal: {} },
            lucroLiquido: { total: 0, mensal: {} },
            margemLiquidaGlobal: 0
        };

        const somaAlgebrica = (c1, c2) => {
             const m = {};
             colunasOrdenadas.forEach(mes => {
                 m[mes] = (c1.mensal[mes] || 0) + (c2.mensal[mes] || 0);
             });
             return { total: c1.total + c2.total, mensal: m };
        };

        // Receita Liquida = 1 + 2
        totais.receitaLiquida = somaAlgebrica(dre.receitaBruta, dre.deducoes);
        
        // Lucro Bruto = RecLiquida + 3
        totais.lucroBruto = somaAlgebrica(totais.receitaLiquida, dre.custos);

        // Res Operacional = LucroBruto + 4
        totais.resultadoOperacional = somaAlgebrica(totais.lucroBruto, dre.despesasOperacionais);

        // Res Antes Impostos = ResOp + 5.1 + 5.2
        const prov1 = somaAlgebrica(totais.resultadoOperacional, dre.receitasFinanceiras);
        totais.resultadoAntesImpostos = somaAlgebrica(prov1, dre.despesasFinanceiras);

        // Lucro Liquido = Antes Impostos + 6
        totais.lucroLiquido = somaAlgebrica(totais.resultadoAntesImpostos, dre.impostosLucro);

        totais.margemLiquidaGlobal = dre.receitaBruta.total > 0 ? (totais.lucroLiquido.total / dre.receitaBruta.total) * 100 : 0;

        return {
            grupos: dre,
            colunasMeses: colunasOrdenadas,
            totais
        };
    };

    const dadosDRE = processarDRE();

    return {
        dadosDRE,
        isLoading: categoriasLoading || lancamentosLoading
    };
}