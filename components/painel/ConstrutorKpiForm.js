"use client";

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import FiltroFinanceiro from '../financeiro/FiltroFinanceiro';

// O PORQUÊ: A função agora recebe 'organizacao_id' para garantir que apenas
// as opções da organização correta sejam carregadas nos filtros.
const fetchFilterOptions = async (organizacao_id) => {
    if (!organizacao_id) return { empresas: [], contas: [], categorias: [], empreendimentos: [], allContacts: [] };

    const supabase = createClient();
    const [empresasRes, contasRes, categoriasRes, empreendimentosRes, contatosRes] = await Promise.all([
        supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacao_id),
        supabase.from('contas_financeiras').select('id, nome').eq('organizacao_id', organizacao_id),
        supabase.from('categorias_financeiras').select('id, nome, parent_id').eq('organizacao_id', organizacao_id),
        supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacao_id),
        supabase.from('contatos').select('id, nome, razao_social').eq('organizacao_id', organizacao_id),
    ]);
    return {
        empresas: empresasRes.data || [],
        contas: contasRes.data || [],
        categorias: categoriasRes.data || [],
        empreendimentos: empreendimentosRes.data || [],
        allContacts: contatosRes.data || [],
    };
};

export default function ConstrutorKpiForm({ kpiToEdit, onDone }) {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user, organizacao_id } = useAuth(); // BLINDADO: Pegamos o usuário e a organização

    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [grupo, setGrupo] = useState('');
    const [tipoCalculo, setTipoCalculo] = useState('resultado');
    const [filters, setFilters] = useState({
        searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
        etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', favorecidoId: null,
    });

    const isEditing = !!kpiToEdit;

    const { data: filterOptions, isLoading: isLoadingOptions } = useQuery({
        // O PORQUÊ: Adicionamos 'organizacao_id' à chave da query para que o React Query
        // armazene em cache e busque os dados corretamente para cada organização.
        queryKey: ['financeFilterOptions', organizacao_id],
        queryFn: () => fetchFilterOptions(organizacao_id),
        enabled: !!organizacao_id, // A busca só é ativada quando a organização estiver disponível
    });

    useEffect(() => {
        if (isEditing) {
            setTitulo(kpiToEdit.titulo);
            setDescricao(kpiToEdit.descricao || '');
            setGrupo(kpiToEdit.grupo || '');
            setTipoCalculo(kpiToEdit.tipo_calculo);
            setFilters(kpiToEdit.filtros);
        } else {
            setTitulo('');
            setDescricao('');
            setGrupo('');
            setTipoCalculo('resultado');
            setFilters({
                searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
                etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', favorecidoId: null,
            });
        }
    }, [kpiToEdit, isEditing]);

    const { mutate: saveKpi, isPending } = useMutation({
        mutationFn: async (kpiData) => {
            if (!user || !organizacao_id) throw new Error("Usuário ou organização não autenticada.");

            // BLINDADO: Adicionamos 'organizacao_id' ao objeto que será salvo no banco.
            const dataToSave = {
                usuario_id: user.id,
                titulo: kpiData.titulo,
                descricao: kpiData.descricao,
                grupo: kpiData.grupo,
                tipo_calculo: kpiData.tipoCalculo,
                filtros: kpiData.filters,
                organizacao_id: organizacao_id, // <-- A "fechadura" de segurança
            };

            let error;
            if (isEditing) {
                const { error: updateError } = await supabase.from('kpis_personalizados').update(dataToSave).eq('id', kpiToEdit.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase.from('kpis_personalizados').insert([{ ...dataToSave, exibir_no_painel: true }]);
                error = insertError;
            }
            
            if (error) throw new Error(error.message);
            return isEditing ? 'KPI atualizado com sucesso!' : 'KPI criado com sucesso!';
        },
        onSuccess: (message) => {
            toast.success(message);
            queryClient.invalidateQueries({ queryKey: ['kpisPersonalizados'] });
            onDone();
        },
        onError: (error) => toast.error(`Erro: ${error.message}`),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveKpi({ titulo, descricao, grupo, tipoCalculo, filters });
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-lg border">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">{isEditing ? `Editando KPI: ${kpiToEdit.titulo}` : 'Criar Novo KPI'}</h2>
            
            {isLoadingOptions ? (
                <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin /> Carregando filtros...</div>
            ) : (
                <FiltroFinanceiro 
                    filters={filters} 
                    setFilters={setFilters} 
                    {...filterOptions} 
                />
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                    <h3 className="text-lg font-bold text-gray-700">Detalhes do KPI</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="titulo" className="block text-sm font-medium">Título para o KPI *</label>
                            <input type="text" id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex: Despesas com Obras (Mês Atual)" className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="grupo" className="block text-sm font-medium">Grupo</label>
                            <input type="text" id="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex: Financeiro, Comercial" className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="tipoCalculo" className="block text-sm font-medium">O que calcular?</label>
                            <select id="tipoCalculo" value={tipoCalculo} onChange={e => setTipoCalculo(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                <option value="resultado">Resultado (Receitas - Despesas)</option>
                                <option value="receitas">Apenas Receitas</option>
                                <option value="despesas">Apenas Despesas</option>
                                <option value="contagem">Nº de Lançamentos</option>
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label htmlFor="descricao" className="block text-sm font-medium">Descrição (Opcional)</label>
                            <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="2" placeholder="Uma breve explicação do que este indicador mede." className="mt-1 w-full p-2 border rounded-md"></textarea>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                    <button type="button" onClick={onDone} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancelar</button>
                    <button type="submit" disabled={isPending || !titulo} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center">
                        {isPending && <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />}
                        {isEditing ? 'Salvar Alterações' : 'Criar KPI'}
                    </button>
                </div>
            </form>
        </div>
    );
}