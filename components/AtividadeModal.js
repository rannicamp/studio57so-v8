"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { toast } from 'sonner';
import AtividadeAnexos from './atividades/AtividadeAnexos';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSitemap, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

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

export default function AtividadeModal({ isOpen, onClose, onActivityAdded, activityToEdit, selectedEmpreendimento, funcionarios, allEmpresas, initialContatoId }) {
    const supabase = createClient();
    const { empreendimentos: allEmpreendimentos, loading: empreendimentosLoading } = useEmpreendimento();
    const [etapas, setEtapas] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(null);
    const isEditing = Boolean(activityToEdit);
    const [type, setType] = useState('atividade');

    const [parentActivitySearch, setParentActivitySearch] = useState('');
    const [parentActivityOptions, setParentActivityOptions] = useState([]);
    const [isSearchingParent, setIsSearchingParent] = useState(false);
    const [selectedParent, setSelectedParent] = useState(null);

    const getInitialState = useCallback(() => ({
        nome: '',
        descricao: '',
        etapa_id: '',
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
    }), [selectedEmpreendimento]);

    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);
        };

        if (isOpen) {
            fetchInitialData();
            setParentActivitySearch('');
            setParentActivityOptions([]);
            setSelectedParent(null);

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
            } else {
                const initialState = getInitialState();
                if (initialContatoId) {
                    initialState.contato_id = initialContatoId;
                }
                setFormData(initialState);
                setType('atividade');
            }
        }
    }, [isOpen, isEditing, activityToEdit, getInitialState, supabase, initialContatoId]);
    
    useEffect(() => {
        const fetchEtapas = async () => {
            if (formData.empreendimento_id) {
                const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa').order('nome_etapa');
                setEtapas(etapasData || []);
            } else {
                setEtapas([]);
            }
        };
        fetchEtapas();
    }, [formData.empreendimento_id, supabase]);

    const searchParentActivities = useCallback(async (searchTerm) => {
        if (searchTerm.length < 3) {
            setParentActivityOptions([]);
            return;
        }
        setIsSearchingParent(true);
        let query = supabase
            .from('activities')
            .select('id, nome')
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
    }, [supabase, isEditing, activityToEdit]);

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
                }
                return newState;
            });
        }
    };

    const syncWithGoogleCalendar = async (activityData) => { /* ... (código existente sem alteração) ... */ };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUserId) {
            toast.error("Erro: Usuário não autenticado.");
            return;
        }

        const promise = new Promise(async (resolve, reject) => {
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
                tipo_atividade: etapaSelecionada ? etapaSelecionada.nome_etapa : 'Atividade Interna',
                empreendimento_id: formData.empreendimento_id || null,
                contato_id: formData.contato_id,
                atividade_pai_id: formData.atividade_pai_id || null,
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
                dadosParaSalvar.hora_inicio = null;
                dadosParaSalvar.duracao_horas = null;
            } else { // Evento
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
            } else {
                dadosParaSalvar.recorrencia_tipo = null;
                dadosParaSalvar.recorrencia_intervalo = null;
                dadosParaSalvar.recorrencia_fim = null;
            }

            let error;
            if (isEditing) {
                const { error: updateError } = await supabase.from('activities').update(dadosParaSalvar).eq('id', activityToEdit.id);
                error = updateError;
            } else {
                const dadosParaCriar = { ...dadosParaSalvar, criado_por_usuario_id: currentUserId };
                const { error: insertError } = await supabase.from('activities').insert([dadosParaCriar]);
                error = insertError;
            }

            if (error) {
                reject(error);
            } else {
                if (!isEditing && type === 'atividade' && dadosParaSalvar.data_inicio_prevista && dadosParaSalvar.data_fim_prevista) {
                    await syncWithGoogleCalendar(dadosParaSalvar);
                }
                resolve();
            }
        });

        toast.promise(promise, {
            loading: 'Salvando atividade...',
            success: () => {
                onActivityAdded();
                onClose();
                return `Atividade ${isEditing ? 'atualizada' : 'criada'} com sucesso!`;
            },
            error: (err) => `Erro ao salvar: ${err.message}`,
        });
    };
    
    const filteredEmpreendimentos = useMemo(() => {
        if (!formData.empresa_id || !allEmpreendimentos) return [];
        return allEmpreendimentos.filter(e => e.empresa_proprietaria_id === formData.empresa_id);
    }, [formData.empresa_id, allEmpreendimentos]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">{isEditing ? 'Editar Atividade' : 'Adicionar Nova Atividade'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                </div>
                
                <div className="flex p-1 bg-gray-200 rounded-lg mb-4">
                    <button type="button" onClick={() => setType('atividade')} className={`w-1/2 p-2 rounded-md font-semibold text-sm ${type === 'atividade' ? 'bg-white shadow' : 'text-gray-600'}`}>
                        Atividade (Duração em dias)
                    </button>
                    <button type="button" onClick={() => setType('evento')} className={`w-1/2 p-2 rounded-md font-semibold text-sm ${type === 'evento' ? 'bg-white shadow' : 'text-gray-600'}`}>
                        Evento (Duração em horas)
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Nome da {type === 'atividade' ? 'Atividade' : 'Evento'}</label>
                            <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div className="md:col-span-2 relative">
                            <label className="block text-sm font-medium">Vincular à Atividade-Pai (Opcional)</label>
                             <div className="relative">
                                <FontAwesomeIcon icon={faSitemap} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    name="parent_search"
                                    value={parentActivitySearch} 
                                    onChange={handleChange}
                                    placeholder="Digite para buscar a atividade principal..." 
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
                                    {isSearchingParent ? (
                                        <li className="px-4 py-2 text-gray-500">Buscando...</li>
                                    ) : (
                                        parentActivityOptions.map(activity => (
                                            <li key={activity.id} onClick={() => handleSelectParent(activity)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                                                {activity.nome}
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium">Empresa</label>
                            <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                <option value="">Nenhuma (Atividade Geral)</option>
                                {allEmpresas?.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.razao_social}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Empreendimento</label>
                            <select 
                                name="empreendimento_id" 
                                value={formData.empreendimento_id || ''} 
                                onChange={handleChange} 
                                className="mt-1 w-full p-2 border rounded-md" 
                                disabled={!formData.empresa_id || empreendimentosLoading}
                            >
                                {empreendimentosLoading ? (
                                    <option>Carregando...</option>
                                ) : (
                                    <>
                                        <option value="">Nenhum</option>
                                        {filteredEmpreendimentos.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Descrição</label>
                            <textarea name="descricao" value={formData.descricao || ''} onChange={handleChange} rows="3" className="mt-1 w-full p-2 border rounded-md"></textarea>
                        </div>

                        {type === 'atividade' ? (
                            <>
                                <div><label className="block text-sm font-medium">Data de Início</label><input type="date" name="data_inicio_prevista" value={formData.data_inicio_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                <div><label className="block text-sm font-medium">Duração (dias úteis)</label><input type="number" name="duracao_dias" min="0.5" step="0.5" value={formData.duracao_dias || 1} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium">Data de Fim Prevista (Calculada)</label><input type="date" value={dataFimPrevistaCalculada} readOnly className="mt-1 w-full p-2 border bg-gray-100 rounded-md cursor-not-allowed"/></div>
                            </>
                        ) : (
                            <>
                                <div><label className="block text-sm font-medium">Data do Evento</label><input type="date" name="data_inicio_prevista" value={formData.data_inicio_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                <div><label className="block text-sm font-medium">Horário de Início</label><input type="time" name="hora_inicio" value={formData.hora_inicio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium">Duração (horas)</label><input type="number" name="duracao_horas" min="0.5" step="0.5" value={formData.duracao_horas || ''} onChange={handleChange} placeholder="Ex: 1.5 para 1h30" className="mt-1 w-full p-2 border rounded-md"/></div>
                            </>
                        )}
                        
                        <div><label className="block text-sm font-medium">Atribuir a</label><select name="funcionario_id" value={formData.funcionario_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Ninguém</option>{funcionarios?.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}</select></div>
                        <div><label className="block text-sm font-medium">Status</label><select name="status" value={formData.status} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option></select></div>
                    </div>

                    {/* ***** CÓDIGO DE RECORRÊNCIA REINSERIDO ***** */}
                    <fieldset className="border-t pt-4">
                        <legend className="text-lg font-semibold text-gray-700">Recorrência</legend>
                        <div className="mt-2 space-y-3">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="is_recorrente" name="is_recorrente" checked={formData.is_recorrente} onChange={handleChange} className="h-4 w-4 rounded" />
                                <label htmlFor="is_recorrente" className="text-sm font-medium">Esta é uma tarefa recorrente</label>
                            </div>
                            {formData.is_recorrente && (
                                <div className="p-4 bg-gray-50 rounded-md grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-medium">Repetir a cada</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" name="recorrencia_intervalo" value={formData.recorrencia_intervalo || 1} onChange={handleChange} min="1" className="mt-1 w-16 p-2 border rounded-md"/>
                                            <select name="recorrencia_tipo" value={formData.recorrencia_tipo} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                                <option value="diaria">Dia(s)</option>
                                                <option value="semanal">Semana(s)</option>
                                                <option value="mensal">Mês(es)</option>
                                                <option value="anual">Ano(s)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium">Até a data de (opcional)</label>
                                        <input type="date" name="recorrencia_fim" value={formData.recorrencia_fim || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
                                    </div>
                                </div>
                            )}
                        </div>
                    </fieldset>
                    
                    {isEditing && (
                        <fieldset className="border-t pt-4">
                            <legend className="text-lg font-semibold text-gray-700">Anexos</legend>
                            <div className="mt-2">
                                <AtividadeAnexos activityId={activityToEdit.id} />
                            </div>
                        </fieldset>
                    )}
                    
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}