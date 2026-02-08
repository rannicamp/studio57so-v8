// components/painel/ConstrutorKpiForm.js
"use client";

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFilter } from '@fortawesome/free-solid-svg-icons';
import FiltroFinanceiro from '../financeiro/FiltroFinanceiro';

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
    const { user, organizacao_id } = useAuth();

    const [module, setModule] = useState('financeiro');
    const [operation, setOperation] = useState('COUNT');
    const [genericFilters, setGenericFilters] = useState({});
    
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [grupo, setGrupo] = useState('');

    const [financialFilters, setFinancialFilters] = useState({
        searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
        etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', favorecidoId: null,
    });

    const isEditing = !!kpiToEdit;

    const { data: filterOptions, isLoading: isLoadingOptions } = useQuery({
        queryKey: ['financeFilterOptions', organizacao_id],
        queryFn: () => fetchFilterOptions(organizacao_id),
        enabled: !!organizacao_id,
    });
    
    useEffect(() => {
        if (isEditing) {
            setTitulo(kpiToEdit.titulo);
            setDescricao(kpiToEdit.descricao || '');
            setGrupo(kpiToEdit.grupo || '');

            if (kpiToEdit.tipo_kpi === 'generico') {
                setModule('generico');
                setOperation(kpiToEdit.operacao);
                setGenericFilters(kpiToEdit.filtros || {});
            } else {
                setModule('financeiro');
                setFinancialFilters(kpiToEdit.filtros || {});
            }
        } else {
            setTitulo('');
            setDescricao('');
            setGrupo('');
            setModule('financeiro');
            setOperation('COUNT');
            setGenericFilters({});
            setFinancialFilters({
                searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
                etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', favorecidoId: null,
            });
        }
    }, [kpiToEdit, isEditing]);

    const { mutate: saveKpi, isPending } = useMutation({
        mutationFn: async (kpiData) => {
            if (!user || !organizacao_id) throw new Error("Usuário ou organização não autenticada.");

            let dataToSave;

            if (module === 'financeiro') {
                 dataToSave = {
                    tipo_kpi: 'financeiro',
                    titulo: kpiData.titulo,
                    descricao: kpiData.descricao,
                    grupo: kpiData.grupo,
                    tipo_calculo: kpiData.tipoCalculo,
                    filtros: kpiData.filters,
                    operacao: null,
                    tabela_fonte: null,
                    coluna_alvo: null,
                    // ======================================================================
                    // CORREÇÃO AQUI
                    // O PORQUÊ: Adicionamos o campo 'modulo' obrigatório.
                    // ======================================================================
                    modulo: 'Financeiro',
                };
            } else {
                dataToSave = {
                    tipo_kpi: 'generico',
                    titulo: kpiData.titulo,
                    descricao: kpiData.descricao,
                    grupo: kpiData.grupo,
                    operacao: kpiData.operation,
                    tabela_fonte: 'contratos',
                    coluna_alvo: kpiData.operation === 'SUM' ? 'valor_final_venda' : null,
                    filtros: kpiData.genericFilters,
                    tipo_calculo: 'generico',
                    // ======================================================================
                    // CORREÇÃO AQUI
                    // O PORQUÊ: Adicionamos o campo 'modulo' obrigatório.
                    // ======================================================================
                    modulo: 'Contratos',
                };
            }
            
            dataToSave.usuario_id = user.id;
            dataToSave.organizacao_id = organizacao_id;
            
            if (isEditing) {
                const { error: deleteError } = await supabase.from('kpis_personalizados').delete().eq('id', kpiToEdit.id);
                if (deleteError) throw new Error(`Falha ao deletar o KPI antigo: ${deleteError.message}`);
                
                const { error: insertError } = await supabase.from('kpis_personalizados').insert([{ ...dataToSave, exibir_no_painel: kpiToEdit.exibir_no_painel }]);
                if (insertError) throw new Error(`Falha ao inserir o KPI atualizado: ${insertError.message}`);
            } else {
                const { error: insertError } = await supabase.from('kpis_personalizados').insert([{ ...dataToSave, exibir_no_painel: true }]);
                if (insertError) throw new Error(insertError.message);
            }
            
            return isEditing ? 'KPI atualizado com sucesso!' : 'KPI criado com sucesso!';
        },
        onSuccess: (message) => {
            toast.success(message);
            queryClient.invalidateQueries({ queryKey: ['kpisPersonalizados'] });
            queryClient.invalidateQueries({ queryKey: ['customKpiValue'] });
            onDone();
        },
        onError: (error) => toast.error(`Erro: ${error.message}`),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveKpi({ 
            titulo, 
            descricao, 
            grupo, 
            operation,
            filters: financialFilters, 
            genericFilters: genericFilters,
            tipoCalculo: 'resultado'
        });
    };
    
    const handleGenericFilterChange = (key, value) => {
        setGenericFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-lg border">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">{isEditing ? `Editando KPI: ${kpiToEdit.titulo}` : 'Criar Novo KPI'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                    <h3 className="text-lg font-bold text-gray-700">1. Detalhes do KPI</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="titulo" className="block text-sm font-medium">Título para o KPI *</label>
                            <input type="text" id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex: Total de Contratos Assinados" className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="grupo" className="block text-sm font-medium">Grupo</label>
                            <input type="text" id="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex: Financeiro, Comercial" className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="descricao" className="block text-sm font-medium">Descrição (Opcional)</label>
                            <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="2" placeholder="Uma breve explicação do que este indicador mede." className="mt-1 w-full p-2 border rounded-md"></textarea>
                        </div>
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                    <h3 className="text-lg font-bold text-gray-700">2. Fonte de Dados e Cálculo</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="module" className="block text-sm font-medium">Módulo</label>
                            <select id="module" value={module} onChange={(e) => setModule(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                <option value="financeiro">Financeiro (Lançamentos)</option>
                                <option value="generico">Comercial (Contratos)</option>
                            </select>
                        </div>
                        {module === 'generico' && (
                             <div>
                                <label htmlFor="operation" className="block text-sm font-medium">Operação</label>
                                <select id="operation" value={operation} onChange={(e) => setOperation(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                    <option value="COUNT">Contar Contratos</option>
                                    <option value="SUM">Somar Valor dos Contratos</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
                
                {module === 'financeiro' ? (
                    isLoadingOptions ? <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin /> Carregando filtros...</div> : <FiltroFinanceiro filters={financialFilters} setFilters={setFinancialFilters} {...filterOptions} />
                ) : (
                    <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                        <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2"><FontAwesomeIcon icon={faFilter}/> 3. Filtros para Contratos</h3>
                         <div>
                            <label htmlFor="status_contrato" className="block text-sm font-medium">Status do Contrato</label>
                            <select id="status_contrato" value={genericFilters.status_contrato || ''} onChange={(e) => handleGenericFilterChange('status_contrato', e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                <option value="">Todos</option>
                                <option value="Em assinatura">Em assinatura</option>
                                <option value="Assinado">Assinado</option>
                                <option value="Distratado">Distratado</option>
                                <option value="Finalizado">Finalizado</option>
                            </select>
                        </div>
                    </div>
                )}
                
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