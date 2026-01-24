// Caminho: components/atividades/AtividadeModal.js
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createClient } from '../../utils/supabase/client';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { toast } from 'sonner';
import AtividadeAnexos from './AtividadeAnexos';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSitemap, faSpinner, faTimes, faPlus, faTrash, faCube, faLink } from '@fortawesome/free-solid-svg-icons';
// 1. IMPORTAÇÃO DO CARTEIRO
import { enviarNotificacao } from '@/utils/notificacoes';
import { useMutation, useQueryClient } from '@tanstack/react-query'; 

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) {
        return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 px-0 py-0 rounded">{part}</mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

function addBusinessDays(startDate, days) {
    if (!startDate || isNaN(days)) return startDate || '';
    if (days <= 1) return startDate;
    let currentDate = new Date(startDate.replace(/-/g, '/'));
    let daysToAdd = Math.ceil(parseFloat(days)) - 1;
    while (daysToAdd > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysToAdd--;
        }
    }
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return currentDate.toISOString().split('T')[0];
}

export default function AtividadeModal({ 
    isOpen, 
    onClose, 
    onActivityAdded, 
    activityToEdit, 
    initialData, 
    selectedEmpreendimento, 
    funcionarios, 
    allEmpresas, 
    initialContatoId 
}) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { empreendimentos: allEmpreendimentos, loading: empreendimentosLoading } = useEmpreendimento();
    const [etapas, setEtapas] = useState([]);
    const [subetapas, setSubetapas] = useState([]);
    const isEditing = Boolean(activityToEdit);
    const [type, setType] = useState('atividade');

    const [parentActivitySearch, setParentActivitySearch] = useState('');
    const [parentActivityOptions, setParentActivityOptions] = useState([]);
    const [isSearchingParent, setIsSearchingParent] = useState(false);
    const [selectedParent, setSelectedParent] = useState(null);

    const [subetapaSearch, setSubetapaSearch] = useState('');
    const [isSubetapaDropdownOpen, setIsSubetapaDropdownOpen] = useState(false);
    const [filteredSubetapas, setFilteredSubetapas] = useState([]);
    const [isCreatingSubetapa, setIsCreatingSubetapa] = useState(false);

    const getInitialState = useCallback(() => ({
        nome: '',
        descricao: '',
        etapa_id: '',
        subetapa_id: '',
        funcionario_id: null,
        data_inicio_prevista: '',
        duracao_dias: 1,
        status: 'Não Iniciado',
        data_fim_original: null,
        motivo_adiamento: null,
        responsavel_texto: null,
        hora_inicio: null,
        duracao_horas: null,
        empresa_id: selectedEmpreendimento?.empresa_proprietaria_id || null,
        empreendimento_id: selectedEmpreendimento?.id || null,
        is_recorrente: false,
        recorrencia_tipo: 'diaria',
        recorrencia_intervalo: 1,
        recorrencia_fim: null,
        contato_id: null,
        atividade_pai_id: null,
        tipo_atividade: 'Tarefa',
    }), [selectedEmpreendimento]);

    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        if (isOpen) {
            setParentActivitySearch('');
            setParentActivityOptions([]);
            setSelectedParent(null);
            setSubetapaSearch(''); 

            if (isEditing) {
                const initialFormData = { ...getInitialState(), ...activityToEdit };
                setFormData(initialFormData);
                if (activityToEdit.atividade_pai) {
                    setSelectedParent(activityToEdit.atividade_pai);
                    setParentActivitySearch(activityToEdit.atividade_pai.nome);
                }
                if (activityToEdit.hora_inicio || activityToEdit.duracao_horas > 0) {
                    setType('evento');
                } else {
                    setType('atividade');
                }
            } else if (initialData) {
                setFormData({
                    ...getInitialState(),
                    ...initialData,
                    nome: initialData.nome || initialData.titulo || '', 
                    descricao: initialData.descricao || '',
                    tipo_atividade: initialData.tipo_atividade || 'Tarefa',
                    status: initialData.status || 'Não Iniciado',
                    contato_id: initialData.contato_id || initialContatoId || null
                });
                setType(initialData.tipo_atividade === 'Evento' ? 'evento' : 'atividade');
            } else {
                const initialState = getInitialState();
                if (initialContatoId) {
                    initialState.contato_id = initialContatoId;
                }
                setFormData(initialState);
                setType('atividade');
            }
        }
    }, [isOpen, isEditing, activityToEdit, initialData, getInitialState, initialContatoId]);

    // =========================================================================
    // BIM INTEGRATION: FUNÇÃO PARA SALVAR OS VÍNCULOS NA TABELA DE LIGAÇÃO
    // =========================================================================
    const saveBimLinks = async (activityId) => {
        // Verificamos se existem elementos BIM nos dados iniciais
        if (!initialData?.elementos_bim || initialData.elementos_bim.length === 0) return;

        const rowsToInsert = initialData.elementos_bim.map(extId => ({
            organizacao_id: organizacaoId,
            atividade_id: activityId,
            projeto_bim_id: initialData.projeto_bim_id,
            external_id: extId
        }));

        const { error } = await supabase
            .from('atividades_elementos')
            .insert(rowsToInsert);

        if (error) {
            console.error("Erro ao vincular elementos BIM:", error);
            throw new Error("Erro ao vincular ao modelo 3D: " + error.message);
        }
    };
    
    useEffect(() => {
        const fetchEtapas = async () => {
            if (formData.empreendimento_id && organizacaoId) {
                const { data: etapasData } = await supabase
                    .from('etapa_obra')
                    .select('id, nome_etapa, codigo_etapa')
                    .eq('organizacao_id', organizacaoId) 
                    .order('codigo_etapa', { ascending: true });
                setEtapas(etapasData || []);
            } else {
                setEtapas([]);
            }
        };
        fetchEtapas();
    }, [formData.empreendimento_id, supabase, organizacaoId]);

    useEffect(() => {
        const fetchSubetapas = async () => {
            if (formData.etapa_id && organizacaoId) {
                const { data: subetapasData, error } = await supabase
                    .from('subetapas')
                    .select('id, nome_subetapa')
                    .eq('etapa_id', formData.etapa_id)
                    .eq('organizacao_id', organizacaoId) 
                    .order('nome_subetapa');
                
                if (error) {
                    toast.error("Erro ao buscar subetapas.");
                    setSubetapas([]);
                } else {
                    setSubetapas(subetapasData || []);
                    if (isEditing && formData.subetapa_id) {
                        const selectedSub = subetapasData.find(s => s.id === formData.subetapa_id);
                        if (selectedSub) {
                            setSubetapaSearch(selectedSub.nome_subetapa);
                        }
                    }
                }
            } else {
                setSubetapas([]);
                setSubetapaSearch('');
                setFormData(prev => ({ ...prev, subetapa_id: null }));
            }
        };
        fetchSubetapas();
    }, [formData.etapa_id, supabase, isEditing, formData.subetapa_id, organizacaoId]);

    useEffect(() => {
        if (!subetapaSearch) {
            setFilteredSubetapas(subetapas);
        } else {
            const searchLower = subetapaSearch.toLowerCase();
            const filtered = subetapas.filter(s => s.nome_subetapa.toLowerCase().includes(searchLower));
            setFilteredSubetapas(filtered);
            const exactMatch = subetapas.find(s => s.nome_subetapa.toLowerCase() === searchLower);
            if (!exactMatch) {
                setFormData(prev => ({ ...prev, subetapa_id: null }));
            }
        }
    }, [subetapaSearch, subetapas]);

    const searchParentActivities = useCallback(async (searchTerm) => {
        if (searchTerm.length < 3 || !organizacaoId) return;
        setIsSearchingParent(true);
        let query = supabase
            .from('activities')
            .select('id, nome')
            .eq('organizacao_id', organizacaoId) 
            .ilike('nome', `%${searchTerm}%`)
            .limit(10);

        if (isEditing) {
            query = query.neq('id', activityToEdit.id);
        }

        const { data, error } = await query;
        if (error) {
            toast.error("Erro ao buscar atividades.");
        } else {
            setParentActivityOptions(data);
        }
        setIsSearchingParent(false);
    }, [supabase, isEditing, activityToEdit, organizacaoId]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (parentActivitySearch && !selectedParent) {
                searchParentActivities(parentActivitySearch);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [parentActivitySearch, selectedParent, searchParentActivities]);

    const handleSelectParent = (activity) => {
        setSelectedParent(activity);
        setFormData(prev => ({ ...prev, atividade_pai_id: activity.id }));
        setParentActivitySearch(activity.nome);
        setParentActivityOptions([]);
    };

    const handleClearParent = () => {
        setSelectedParent(null);
        setFormData(prev => ({ ...prev, atividade_pai_id: null }));
        setParentActivitySearch('');
        setParentActivityOptions([]);
    };

    const dataFimPrevistaCalculada = useMemo(() => {
        return addBusinessDays(formData.data_inicio_prevista, formData.duracao_dias);
    }, [formData.data_inicio_prevista, formData.duracao_dias]);
    
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let finalValue = type === 'checkbox' ? checked : (name === 'empresa_id' && value ? parseInt(value, 10) : value);
        
        if (name === 'parent_search') {
            setParentActivitySearch(value);
            if(selectedParent) {
                handleClearParent();
            }
        } else {
            setFormData(prevState => {
                const newState = { ...prevState, [name]: finalValue };
                if (name === 'empresa_id') {
                    newState.empreendimento_id = null;
                    newState.etapa_id = '';
                    newState.subetapa_id = '';
                    setSubetapaSearch('');
                }
                if (name === 'empreendimento_id') {
                    newState.etapa_id = '';
                    newState.subetapa_id = '';
                    setSubetapaSearch('');
                }
                if (name === 'etapa_id') {
                    newState.subetapa_id = '';
                    setSubetapaSearch('');
                }
                return newState;
            });
        }
    };

    const handleSelectSubetapa = (subetapa) => {
        setFormData(prev => ({ ...prev, subetapa_id: subetapa.id }));
        setSubetapaSearch(subetapa.nome_subetapa);
        setIsSubetapaDropdownOpen(false);
    };

    const handleCreateSubetapa = async () => {
        if (!subetapaSearch.trim() || !formData.etapa_id || !organizacaoId) {
             if (!organizacaoId) toast.error('Erro de segurança: Organização do usuário não encontrada.');
            return;
        }
        const subetapaNome = subetapaSearch.trim();
        setIsCreatingSubetapa(true);
        const promise = supabase
            .from('subetapas')
            .insert({ 
                nome_subetapa: subetapaNome, 
                etapa_id: formData.etapa_id,
                organizacao_id: organizacaoId
            })
            .select()
            .single()
            .throwOnError();
        
        toast.promise(promise, {
            loading: 'Criando nova subetapa...',
            success: (newSubetapa) => {
                setIsCreatingSubetapa(false);
                setSubetapas(prev => [...prev, newSubetapa]);
                handleSelectSubetapa(newSubetapa);
                return 'Subetapa criada com sucesso!';
            },
            error: (err) => {
                setIsCreatingSubetapa(false);
                return `Erro ao criar subetapa: ${err.message}`;
            },
        });
    };

    const syncWithGoogleCalendar = async (activityData) => { /* Placeholder */ };

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('activities').delete().eq('id', activityToEdit.id);
            if (error) throw error;
        },
        onSuccess: async () => {
            await enviarNotificacao({
                userId: user.id,
                titulo: "🗑️ Atividade Excluída",
                mensagem: `A atividade "${activityToEdit.nome}" foi removida.`,
                link: '/atividades',
                organizacaoId: organizacaoId,
                canal: 'operacional'
            });

            toast.success("Atividade excluída!");
            if (onActivityAdded) onActivityAdded();
            onClose();
        },
        onError: (err) => toast.error("Erro ao excluir: " + err.message)
    });

    const handleDelete = () => {
        if (confirm("Tem certeza que deseja excluir esta atividade?")) {
            deleteMutation.mutate();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user?.id || !organizacaoId) {
            toast.error("Erro: Usuário não autenticado.");
            return;
        }

        const promise = new Promise(async (resolve, reject) => {
            try {
                const selectedFuncionario = funcionarios.find(f => f.id == formData.funcionario_id);
                const responsavelNome = selectedFuncionario ? selectedFuncionario.full_name : null;
                const etapaSelecionada = etapas.find(etapa => etapa.id == formData.etapa_id);
                
                const dadosParaSalvar = {
                    nome: formData.nome,
                    descricao: formData.descricao,
                    status: formData.status,
                    is_recorrente: formData.is_recorrente,
                    responsavel_texto: responsavelNome,
                    funcionario_id: formData.funcionario_id || null,
                    etapa_id: formData.etapa_id || null,
                    subetapa_id: formData.subetapa_id || null,
                    tipo_atividade: etapaSelecionada ? etapaSelecionada.nome_etapa : (formData.tipo_atividade || 'Tarefa'),
                    empreendimento_id: formData.empreendimento_id || null,
                    contato_id: formData.contato_id,
                    atividade_pai_id: formData.atividade_pai_id || null,
                    organizacao_id: organizacaoId, 
                };

                if (dadosParaSalvar.empreendimento_id) {
                    const emp = allEmpreendimentos.find(e => e.id == dadosParaSalvar.empreendimento_id);
                    dadosParaSalvar.empresa_id = emp?.empresa_proprietaria_id || null;
                } else {
                    dadosParaSalvar.empresa_id = formData.empresa_id || null;
                }

                if (type === 'atividade') {
                    dadosParaSalvar.data_inicio_prevista = formData.data_inicio_prevista;
                    dadosParaSalvar.duracao_dias = formData.duracao_dias;
                    dadosParaSalvar.data_fim_prevista = dataFimPrevistaCalculada;
                } else { 
                    dadosParaSalvar.data_inicio_prevista = formData.data_inicio_prevista;
                    dadosParaSalvar.data_fim_prevista = formData.data_inicio_prevista;
                    dadosParaSalvar.hora_inicio = formData.hora_inicio || null;
                    dadosParaSalvar.duracao_horas = formData.duracao_horas ? parseFloat(formData.duracao_horas) : null;
                    dadosParaSalvar.duracao_dias = 0;
                }
                
                if (formData.is_recorrente) {
                    dadosParaSalvar.recorrencia_tipo = formData.recorrencia_tipo;
                    dadosParaSalvar.recorrencia_intervalo = formData.recorrencia_intervalo;
                    dadosParaSalvar.recorrencia_fim = formData.recorrencia_fim || null;
                }

                let savedActivity;
                if (isEditing) {
                    const { data, error: updateError } = await supabase.from('activities').update(dadosParaSalvar).eq('id', activityToEdit.id).select().single();
                    if (updateError) throw updateError;
                    savedActivity = data;
                } else {
                    const dadosParaCriar = { ...dadosParaSalvar, criado_por_usuario_id: user.id };
                    const { data, error: insertError } = await supabase.from('activities').insert([dadosParaCriar]).select().single();
                    if (insertError) throw insertError;
                    savedActivity = data;

                    // BIM INTEGRATION: Se for criação, salvamos os vínculos
                    if (initialData?.elementos_bim) {
                        await saveBimLinks(savedActivity.id);
                    }
                }

                resolve({ action: isEditing ? 'update' : 'create', data: savedActivity });
            } catch (err) {
                reject(err);
            }
        });

        toast.promise(promise, {
            loading: 'Salvando atividade...',
            success: async (result) => {
                if (result.action === 'create') {
                    await enviarNotificacao({
                        userId: user.id,
                        titulo: "🏗️ Nova Atividade Criada",
                        mensagem: `Atividade "${result.data.nome}" vinculada e pronta.`,
                        link: '/atividades',
                        organizacaoId: organizacaoId,
                        canal: 'operacional'
                    });
                }
                queryClient.invalidateQueries(['atividades']);
                onActivityAdded();
                onClose();
                return `Sucesso!`;
            },
            error: (err) => `Erro: ${err.message}`,
        });
    };
    
    const filteredEmpreendimentos = useMemo(() => {
        if (!formData.empresa_id || !allEmpreendimentos) return [];
        return allEmpreendimentos.filter(e => e.empresa_proprietaria_id === formData.empresa_id);
    }, [formData.empresa_id, allEmpreendimentos]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Editar Atividade' : 'Adicionar Nova Atividade'}</h2>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Planejamento Studio 57</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-3xl">&times;</button>
                </div>

                {/* BIM INTEGRATION: BANNER DE VÍNCULO ATIVO */}
                {initialData?.elementos_bim?.length > 0 && (
                    <div className="bg-blue-600 px-6 py-2 flex items-center gap-3 text-white">
                        <FontAwesomeIcon icon={faCube} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Vínculo 4D: {initialData.elementos_bim.length} elementos selecionados no modelo
                        </span>
                        <FontAwesomeIcon icon={faLink} className="ml-auto opacity-50" />
                    </div>
                )}
                
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex p-1 bg-gray-200 rounded-lg mb-6">
                        <button type="button" onClick={() => setType('atividade')} className={`w-1/2 p-2 rounded-md font-semibold text-sm ${type === 'atividade' ? 'bg-white shadow' : 'text-gray-600'}`}>
                            Atividade (Dias)
                        </button>
                        <button type="button" onClick={() => setType('evento')} className={`w-1/2 p-2 rounded-md font-semibold text-sm ${type === 'evento' ? 'bg-white shadow' : 'text-gray-600'}`}>
                            Evento (Horas)
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium">Nome</label>
                                <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                            <div className="md:col-span-2 relative">
                                <label className="block text-sm font-medium">Atividade-Pai (WBS)</label>
                                 <div className="relative">
                                      <FontAwesomeIcon icon={faSitemap} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                      <input 
                                        type="text" 
                                        name="parent_search"
                                        value={parentActivitySearch} 
                                        onChange={handleChange}
                                        placeholder="Buscar pai..." 
                                        className="mt-1 w-full p-2 pl-10 border rounded-md"
                                       />
                                      {selectedParent && (
                                          <button type="button" onClick={handleClearParent} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-600">
                                              <FontAwesomeIcon icon={faTimes} />
                                          </button>
                                      )}
                                </div>
                                {parentActivityOptions.length > 0 && !selectedParent && (
                                    <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                                        {isSearchingParent ? <li className="px-4 py-2 text-gray-500">Buscando...</li> : parentActivityOptions.map(activity => (
                                            <li key={activity.id} onClick={() => handleSelectParent(activity)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                                                {activity.nome}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium">Empresa</label>
                                <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                    <option value="">Geral</option>
                                    {allEmpresas?.map(emp => <option key={emp.id} value={emp.id}>{emp.razao_social}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Empreendimento</label>
                                <select name="empreendimento_id" value={formData.empreendimento_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empresa_id}>
                                    <option value="">Nenhum</option>
                                    {filteredEmpreendimentos.map(emp => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium">Etapa</label>
                                <select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empreendimento_id}>
                                    <option value="">Selecione...</option>
                                    {etapas.map(etapa => <option key={etapa.id} value={etapa.id}>{etapa.codigo_etapa} - {etapa.nome_etapa}</option>)}
                                </select>
                            </div>
                            
                            <div className="relative">
                                <label className="block text-sm font-medium">Subetapa</label>
                                <input
                                    type="text"
                                    value={subetapaSearch}
                                    onChange={(e) => setSubetapaSearch(e.target.value)}
                                    onFocus={() => setIsSubetapaDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsSubetapaDropdownOpen(false), 200)}
                                    disabled={!formData.etapa_id}
                                    className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100"
                                    autoComplete="off"
                                />
                                {isSubetapaDropdownOpen && formData.etapa_id && (
                                    <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                        {filteredSubetapas.map(sub => (
                                            <li key={sub.id} onMouseDown={() => handleSelectSubetapa(sub)} className="p-2 border-b hover:bg-gray-100 cursor-pointer">
                                                <HighlightedText text={sub.nome_subetapa} highlight={subetapaSearch} />
                                            </li>
                                        ))}
                                        {subetapaSearch && !filteredSubetapas.some(s => s.nome_subetapa.toLowerCase() === subetapaSearch.toLowerCase()) && (
                                            <li onMouseDown={handleCreateSubetapa} className="p-2 border-t bg-green-50 hover:bg-green-100 cursor-pointer flex items-center gap-2">
                                                {isCreatingSubetapa ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} className="text-green-600" />}
                                                <span className="text-green-800 font-semibold">Criar: "{subetapaSearch}"</span>
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium">Descrição</label>
                                <textarea name="descricao" value={formData.descricao || ''} onChange={handleChange} rows="2" className="mt-1 w-full p-2 border rounded-md"></textarea>
                            </div>

                            {type === 'atividade' ? (
                                <>
                                    <div><label className="block text-sm font-medium">Início</label><input type="date" name="data_inicio_prevista" value={formData.data_inicio_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                    <div><label className="block text-sm font-medium">Duração (Dias)</label><input type="number" name="duracao_dias" min="0.5" step="0.5" value={formData.duracao_dias || 1} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                    <div className="md:col-span-2"><label className="block text-sm font-medium opacity-50">Término Estimado</label><input type="date" value={dataFimPrevistaCalculada} readOnly className="mt-1 w-full p-2 border bg-gray-50 rounded-md cursor-not-allowed"/></div>
                                </>
                            ) : (
                                <>
                                    <div><label className="block text-sm font-medium">Data</label><input type="date" name="data_inicio_prevista" value={formData.data_inicio_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                    <div><label className="block text-sm font-medium">Hora</label><input type="time" name="hora_inicio" value={formData.hora_inicio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                    <div className="md:col-span-2"><label className="block text-sm font-medium">Duração (Horas)</label><input type="number" name="duracao_horas" min="0.5" step="0.5" value={formData.duracao_horas || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                </>
                            )}
                            
                            <div><label className="block text-sm font-medium">Responsável</label><select name="funcionario_id" value={formData.funcionario_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhum</option>{funcionarios?.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}</select></div>
                            <div><label className="block text-sm font-medium">Status</label><select name="status" value={formData.status} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option></select></div>
                        </div>

                        <fieldset className="border-t pt-4">
                            <legend className="text-lg font-semibold text-gray-700">Recorrência</legend>
                            <div className="mt-2 space-y-3">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="is_recorrente" name="is_recorrente" checked={formData.is_recorrente} onChange={handleChange} className="h-4 w-4 rounded" />
                                    <label htmlFor="is_recorrente" className="text-sm font-medium">Repetir esta tarefa</label>
                                </div>
                                {formData.is_recorrente && (
                                    <div className="p-4 bg-gray-50 rounded-md grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium">Intervalo</label>
                                            <div className="flex items-center gap-2">
                                                <input type="number" name="recorrencia_intervalo" value={formData.recorrencia_intervalo || 1} onChange={handleChange} min="1" className="w-16 p-2 border rounded-md"/>
                                                <select name="recorrencia_tipo" value={formData.recorrencia_tipo} onChange={handleChange} className="w-full p-2 border rounded-md">
                                                    <option value="diaria">Dias</option>
                                                    <option value="semanal">Semanas</option>
                                                    <option value="mensal">Meses</option>
                                                    <option value="anual">Anos</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium">Encerrar em</label>
                                            <input type="date" name="recorrencia_fim" value={formData.recorrencia_fim || ''} onChange={handleChange} className="w-full p-2 border rounded-md"/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </fieldset>
                        
                        {isEditing && (
                            <fieldset className="border-t pt-4">
                                <legend className="text-lg font-semibold text-gray-700 px-2">Anexos</legend>
                                <AtividadeAnexos activityId={activityToEdit.id} />
                            </fieldset>
                        )}
                        
                        <div className="flex justify-between gap-4 pt-6 border-t sticky bottom-0 bg-white">
                            {isEditing ? (
                                <button type="button" onClick={handleDelete} className="bg-red-50 text-red-700 px-4 py-2 rounded-md hover:bg-red-100 flex items-center gap-2 font-bold text-sm">
                                    <FontAwesomeIcon icon={faTrash} /> Excluir
                                </button>
                            ) : <div></div>}
                            
                            <div className="flex gap-2">
                                <button type="button" onClick={onClose} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-md hover:bg-gray-200 font-bold text-sm">Cancelar</button>
                                <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 shadow-lg shadow-blue-200 font-bold text-sm transition-all">
                                    Salvar Atividade
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}