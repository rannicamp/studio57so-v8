// hooks/obras/useCustosObraDRE.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { formatarFiltrosParaBanco } from '@/utils/financeiro/formatarFiltros';

export function useCustosObraDRE(filtros) {
    const supabase = createClient();
    const filtrosParaBanco = formatarFiltrosParaBanco(filtros);

    // 1. Buscar TODAS as categorias da Organização
    const { data: categorias, isLoading: categoriasLoading } = useQuery({
        queryKey: ['categorias-dre-obras', filtros.organizacaoId],
        queryFn: async () => {
            if (!filtros.organizacaoId) return [];
            const { data, error } = await supabase
                .from('categorias_financeiras')
                .select('*')
                .in('organizacao_id', [filtros.organizacaoId, 1])
                .order('nome');

            if (error) {
                console.error("Erro ao buscar categorias para DRE Obras:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!filtros.organizacaoId,
        staleTime: 5 * 60 * 1000 // 5 minutos de cache
    });

    // 2. Buscar Matriz DRE Agrupada (RPC)
    const { data: lancamentosAgrupados, isLoading: lancamentosLoading } = useQuery({
        queryKey: ['lancamentos-dre-obras-matriz-rpc', filtros.organizacaoId, filtrosParaBanco],
        queryFn: async () => {
            if (!filtros.organizacaoId) return [];
            
            const { data, error } = await supabase.rpc('dre_matriz_agrupada_obras', {
                p_organizacao_id: filtros.organizacaoId,
                p_filtros: {
                    ...filtrosParaBanco,
                    ignoreTransfers: true
                }
            }).limit(50000); // 🛡️ BURLAR O LIMITE DE 1000 LINHAS DO REST API!

            if (error) {
                console.error("Erro ao buscar matriz DRE Obras no servidor:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!filtros.organizacaoId,
        staleTime: 60000 // 1 minuto
    });

    // ============================================================================
    // 🧠 MOTOR DE PROCESSAMENTO DO DRE DE OBRAS (MATRIZ / PLANILHA)
    // ============================================================================

    const processarDREObras = () => {
        if (!categorias || !lancamentosAgrupados) return null;

        // INJEÇÃO BRUTAL PARA INVESTIGAR NOVEMBRO/25 (MISTÉRIO DO ZERO)
        console.log("⚠️ [DEBUG DRE OBRAS] Total de lançamentos brutos recebidos da RPC:", lancamentosAgrupados.length);
        const debugFolha194 = lancamentosAgrupados.filter(l => Number(l.categoria_id) === 194 || l.categoria_id === '194');
        console.log("⚠️ [DEBUG DRE OBRAS] Lançamentos EXATOS da Categoria 194 (Folha):", debugFolha194);
        
        let foundNov25 = debugFolha194.find(l => l.ano_mes === '2025-11');
        if(!foundNov25) {
             console.log("🔴 URGENTE: O servidor NÃO ENTREGOU O MÊS 2025-11 para o navegador!");
        } else {
             console.log("🟢 OK: O servidor ENTREGOU o mês 2025-11! O valor é:", foundNov25.total);
        }

        // Dicionário rápido de categorias
        const catMap = {};
        categorias.forEach(c => { catMap[c.id] = c; });

        // Identificar a Categoria Mestre "Custo Obra"
        let rootCategory = categorias.find(c => 
            c.nome.toLowerCase().includes('custo') && c.nome.toLowerCase().includes('obra')
        );

        // Fallback para a principal de custos se não achar exato "Custo Obra"
        if (!rootCategory) {
            rootCategory = categorias.find(c => c.nome.startsWith('3.'));
        }

        if (!rootCategory) {
           return { grupos: {}, totais: { custoObraTotal: 0 } }; 
        }

        // Determinar colunas dinâmicas presentes nos lançamentos
        const colunasSet = new Set();

        const gruposFilhosDiretos = categorias.filter(c => c.parent_id === rootCategory.id);
        
        const dre = {};
        
        gruposFilhosDiretos.forEach(grupo => {
            dre[grupo.id] = {
                mestre: grupo,
                total: 0, // Total Horizontal (acumulado do período)
                mensal: {}, // ex: { '2026-01': 500, '2026-02': 100 }
                filhas: {}
            };
        });

        const dreNaoClassificado = { mestre: { nome: 'Outros Custos / Não Detalhado' }, total: 0, mensal: {}, filhas: {} };
        let custoObraTotal = 0;
        let totaisMensais = {}; // Rodapé com o total da coluna inteira da matriz

        const alocarLancamento = (lancamentoAgrupado, grupoPaiId) => {
            const catId = lancamentoAgrupado.categoria_id;
            const categoria = catMap[catId];
            let nomeFilha = categoria ? categoria.nome : 'Sem Categoria';

            if (catId === grupoPaiId) {
                nomeFilha = `${catMap[grupoPaiId].nome} (Geral)`;
            }

            const chaveMes = lancamentoAgrupado.ano_mes; // 'YYYY-MM' direto do servidor
            if(chaveMes) colunasSet.add(chaveMes);

            let alvo = dre[grupoPaiId];
            if (!alvo) {
                alvo = dreNaoClassificado;
            }

            if (!alvo.filhas[nomeFilha]) {
                alvo.filhas[nomeFilha] = {
                    id: catId,
                    nome: nomeFilha,
                    total: 0,
                    mensal: {}
                };
            }

            // Com o novo padrão estrutural, despesas vêm do banco negativas e receitas positivas.
            // Para o DRE de Custos (que deve exibir custos como positivos), nós espelhamos/invertemos o resultado bruto (* -1)
            const valor = (Number(lancamentoAgrupado.total) || 0) * -1;

            if(chaveMes) {
                // Adiciona na Filha
                alvo.filhas[nomeFilha].total += valor;
                if(!alvo.filhas[nomeFilha].mensal[chaveMes]) alvo.filhas[nomeFilha].mensal[chaveMes] = 0;
                alvo.filhas[nomeFilha].mensal[chaveMes] += valor;
    
                // Adiciona no Grupo Pai
                if(!alvo.mensal[chaveMes]) alvo.mensal[chaveMes] = 0;
                alvo.mensal[chaveMes] += valor;
    
                // Adiciona no Total Geral Mensal
                if(!totaisMensais[chaveMes]) totaisMensais[chaveMes] = 0;
                totaisMensais[chaveMes] += valor;
            }

            alvo.total += valor;
            custoObraTotal += valor;
        };

        lancamentosAgrupados.forEach(lanc => {
            const cat = catMap[lanc.categoria_id];
            if (!cat) return;

            let currentCatId = cat.id;
            let level2CatId = null; 
            let isCustoObra = false;
            let iteracoes = 0;

            while (currentCatId && catMap[currentCatId] && iteracoes < 6) {
                if (currentCatId === rootCategory.id) {
                    isCustoObra = true;
                    break;
                }
                if (catMap[currentCatId].parent_id === rootCategory.id) {
                    level2CatId = currentCatId;
                }
                currentCatId = catMap[currentCatId].parent_id;
                iteracoes++;
            }

            if (isCustoObra) {
                if (level2CatId) {
                    alocarLancamento(lanc, level2CatId);
                } else if (cat.id === rootCategory.id) {
                    alocarLancamento(lanc, 'naoClassificado');
                }
            }
        });

        // Ordenar colunas baseadas nas chaves reais retornadas
        const colunasOrdenadas = Array.from(colunasSet).sort();

        // Formatar para a visualização DRE
        const gruposArray = Object.values(dre).filter(g => g.total > 0).sort((a, b) => b.total - a.total);
        gruposArray.forEach(g => {
             g.filhasArray = Object.values(g.filhas).sort((a,b) => b.total - a.total);
        });

        if (dreNaoClassificado.total > 0) {
            dreNaoClassificado.filhasArray = Object.values(dreNaoClassificado.filhas).sort((a,b) => b.total - a.total);
            gruposArray.push(dreNaoClassificado);
        }

        return {
            rootCategory,
            gruposLista: gruposArray,
            colunasMeses: colunasOrdenadas,
            totais: {
                custoObraTotal,
                totaisMensais
            }
        };
    };

    const dadosDRE = processarDREObras();

    return {
        dadosDRE,
        isLoading: categoriasLoading || lancamentosLoading
    };
}
