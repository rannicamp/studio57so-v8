// Caminho: components/atividades/form/ActivityModalRoot.js
"use client";

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faTrash, faCheck } from '@fortawesome/free-solid-svg-icons';

import { useActivityFormOptions } from '@/hooks/useActivityFormOptions';
import { enviarNotificacao } from '@/utils/notificacoes';

// Componentes Filhos
import ActivityBimLink from './ActivityBimLink';
import ActivityContextFields from './ActivityContextFields';
import ActivityBasicInfo from './ActivityBasicInfo';
import ActivitySchedule from './ActivitySchedule';
import ActivityAssignment from './ActivityAssignment';

// Utilitário local para garantir data fim correta no submit
function addBusinessDays(startDate, days) {
    if (!startDate) return null;
    const numDays = parseFloat(days);
    if (isNaN(numDays) || numDays <= 1) return startDate;
    let currentDate = new Date(startDate.replace(/-/g, '/'));
    let daysToAdd = Math.ceil(numDays) - 1;
    while (daysToAdd > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) daysToAdd--;
    }
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return currentDate.toISOString().split('T')[0];
}

export default function ActivityModalRoot({
    isOpen,
    onClose,
    onSuccess,
    initialData,
    activityToEdit,
    allEmpresas,
    empreendimentos,
    funcionarios
}) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { 
        empresas: optionsEmpresas, 
        empreendimentos: optionsObras, 
        funcionarios: optionsFuncionarios 
    } = useActivityFormOptions(organizacaoId, { allEmpresas, empreendimentos, funcionarios });

    const isEditing = Boolean(activityToEdit);
    
    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        status: 'Não Iniciado',
        tipo_atividade: 'Tarefa',
        empresa_id: null,
        empreendimento_id: null,
        etapa_id: null,
        subetapa_id: null,
        atividade_pai_id: null,
        data_inicio_prevista: '',
        data_fim_prevista: '',
        duracao_dias: 1,
        hora_inicio: null,
        duracao_horas: null,
        is_recorrente: false,
        recorrencia_tipo: 'diaria',
        recorrencia_intervalo: 1,
        recorrencia_dias_semana: null,
        recorrencia_fim: null,
        funcionario_id: null,
        contato_id: null,
        responsavel_texto: ''
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && activityToEdit) {
                setFormData(prev => ({ ...prev, ...activityToEdit }));
            } else if (initialData) {
                let empresaPreenchida = initialData.empresa_id;
                if (!empresaPreenchida && initialData.empreendimento_id && optionsObras?.length > 0) {
                    const obra = optionsObras.find(o => o.id === initialData.empreendimento_id);
                    if (obra) empresaPreenchida = obra.empresa_proprietaria_id;
                }

                setFormData(prev => ({
                    ...prev,
                    ...initialData,
                    empresa_id: empresaPreenchida || prev.empresa_id,
                    duracao_dias: initialData.duracao_dias || 1,
                    status: initialData.status || 'Não Iniciado'
                }));
            } else {
                setFormData({
                    nome: '', descricao: '', status: 'Não Iniciado', tipo_atividade: 'Tarefa',
                    empresa_id: null, empreendimento_id: null, etapa_id: null, subetapa_id: null, atividade_pai_id: null,
                    data_inicio_prevista: '', data_fim_prevista: '', duracao_dias: 1,
                    is_recorrente: false, recorrencia_tipo: 'diaria', recorrencia_intervalo: 1,
                    funcionario_id: null, contato_id: null, responsavel_texto: ''
                });
            }
        }
    }, [isOpen, isEditing, activityToEdit, initialData, optionsObras]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setIsSaving(true);

        try {
            if (!organizacaoId) throw new Error("Sessão inválida.");
            if (!formData.nome) throw new Error("O nome é obrigatório.");

            const dataFimCalculada = formData.tipo_atividade === 'Evento' 
                ? formData.data_inicio_prevista 
                : addBusinessDays(formData.data_inicio_prevista, formData.duracao_dias);

            const selectedFuncionario = optionsFuncionarios?.find(f => f.id == formData.funcionario_id);

            // --- BLINDAGEM CONTRA COLUNAS DO SCHEMA CACHE ---
            // Criamos um payload contendo APENAS o que existe na tabela 'activities'
            const payload = {
                nome: formData.nome,
                descricao: formData.descricao,
                status: formData.status,
                tipo_atividade: formData.tipo_atividade,
                empresa_id: formData.empresa_id || null,
                empreendimento_id: formData.empreendimento_id || null,
                etapa_id: formData.etapa_id || null,
                subetapa_id: formData.subetapa_id || null,
                atividade_pai_id: formData.atividade_pai_id || null,
                funcionario_id: formData.funcionario_id || null,
                contato_id: formData.contato_id || null,
                diario_obra_id: formData.diario_obra_id || null,
                organizacao_id: organizacaoId,
                data_inicio_prevista: formData.data_inicio_prevista,
                data_fim_prevista: dataFimCalculada,
                duracao_dias: formData.duracao_dias,
                hora_inicio: formData.hora_inicio,
                duracao_horas: formData.duracao_horas,
                is_recorrente: formData.is_recorrente,
                recorrencia_tipo: formData.recorrencia_tipo,
                recorrencia_intervalo: formData.recorrencia_intervalo,
                recorrencia_dias_semana: formData.recorrencia_dias_semana,
                recorrencia_fim: formData.recorrencia_fim,
                responsavel_texto: selectedFuncionario ? selectedFuncionario.full_name : formData.responsavel_texto,
                progresso: formData.progresso || 0,
                custom_class: formData.custom_class || null,
                dependencies: formData.dependencies || null
            };

            // Regra original: Se mudou a obra, atualiza a empresa
            if (payload.empreendimento_id) {
                const emp = optionsObras?.find(e => e.id == payload.empreendimento_id);
                if (emp) payload.empresa_id = emp.empresa_proprietaria_id;
            }

            let resultActivity;

            if (isEditing) {
                const { data, error } = await supabase
                    .from('activities')
                    .update(payload)
                    .eq('id', activityToEdit.id)
                    .select()
                    .single();
                
                if (error) throw error;
                resultActivity = data;
                toast.success("Atualizado com sucesso!");
            } else {
                payload.criado_por_usuario_id = user.id;
                const { data, error } = await supabase
                    .from('activities')
                    .insert(payload)
                    .select()
                    .single();
                
                if (error) throw error;
                resultActivity = data;

                // Vínculo BIM
                if (initialData?.elementos_bim && initialData?.elementos_bim.length > 0 && initialData.projeto_bim_id) {
                    const vinculosBim = initialData.elementos_bim.map(extId => ({
                        organizacao_id: organizacaoId,
                        atividade_id: resultActivity.id,
                        projeto_bim_id: initialData.projeto_bim_id,
                        external_id: String(extId)
                    }));
                    await supabase.from('atividades_elementos').insert(vinculosBim);
                }

                await enviarNotificacao({
                    userId: user.id,
                    titulo: "Nova Atividade",
                    mensagem: `"${resultActivity.nome}" foi criada.`,
                    link: '/atividades',
                    organizacaoId,
                    canal: 'operacional'
                });
                toast.success("Criado com sucesso!");
            }

            queryClient.invalidateQueries(['atividades']);
            queryClient.invalidateQueries(['bimActivities']);
            queryClient.invalidateQueries(['bimElementLinks']);
            
            if (onSuccess) onSuccess(resultActivity);
            onClose();

        } catch (error) {
            console.error("Erro no Studio 57:", error);
            toast.error(error.message || "Erro ao salvar.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Tem certeza que deseja excluir?")) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('activities').delete().eq('id', activityToEdit.id);
            if (error) throw error;
            toast.success("Excluído!");
            queryClient.invalidateQueries(['atividades']);
            onClose();
        } catch (error) {
            toast.error("Erro ao excluir.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                
                <div className="flex items-center justify-between p-5 border-b bg-gray-50 rounded-t-2xl shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {isEditing ? 'Editar Atividade' : 'Nova Atividade'}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">
                            {isEditing ? `ID: #${activityToEdit.id}` : 'Planejamento e Controle'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {initialData?.elementos_bim && (
                        <div className="mb-6">
                            <ActivityBimLink count={initialData.elementos_bim.length} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-8 space-y-6">
                            <ActivityBasicInfo 
                                formData={formData} 
                                setFormData={setFormData} 
                                organizacaoId={organizacaoId}
                            />
                            <ActivityContextFields 
                                formData={formData} 
                                setFormData={setFormData}
                                options={{ empresas: optionsEmpresas, empreendimentos: optionsObras }}
                                organizacaoId={organizacaoId} 
                            />
                            <ActivitySchedule 
                                formData={formData} 
                                setFormData={setFormData} 
                            />
                        </div>
                        <div className="lg:col-span-4 space-y-6">
                            <ActivityAssignment 
                                formData={formData} 
                                setFormData={setFormData}
                                funcionarios={optionsFuncionarios}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-between items-center shrink-0">
                    <div>
                        {isEditing && (
                            <button type="button" onClick={handleDelete} className="text-red-600 hover:text-red-800 text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                                <FontAwesomeIcon icon={faTrash} /> Excluir
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                            Cancelar
                        </button>
                        <button onClick={handleSubmit} disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                            {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheck} />}
                            {isEditing ? 'Salvar' : 'Criar Atividade'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}