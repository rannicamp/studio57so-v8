"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';

// Função para calcular dias úteis
function addBusinessDays(startDate, days) {
  if (!startDate || isNaN(days) || days <= 0) return startDate || '';
  let currentDate = new Date(startDate.replace(/-/g, '/'));
  let daysToAdd = Math.ceil(parseFloat(days));
  
  if (daysToAdd <= 0) return startDate;

  // Começa a contar a partir do dia seguinte
  currentDate.setDate(currentDate.getDate() + 1);

  while (daysToAdd > 1) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Ignora Sábado (6) e Domingo (0)
      daysToAdd--;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Ajuste final para garantir que a data final não seja um fim de semana
  while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
  }

  return currentDate.toISOString().split('T')[0];
}


export default function AtividadeModal({ isOpen, onClose, onActivityAdded, activityToEdit, selectedEmpreendimento, funcionarios }) {
    const supabase = createClient();
    const [etapas, setEtapas] = useState([]);
    const [message, setMessage] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);
    const isEditing = Boolean(activityToEdit);

    const getInitialState = useCallback(() => ({
        nome: '',
        descricao: '', // Adicionando descrição
        etapa_id: '',
        funcionario_id: null, // Campo para atribuir funcionário
        data_inicio_prevista: '',
        duracao_dias: 1,
        dependencies: null,
        status: 'Não Iniciado',
    }), []);

    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);

            // Só busca etapas se for uma atividade de empreendimento
            if (selectedEmpreendimento) {
                const { data: etapasData, error: etapasError } = await supabase
                    .from('etapa_obra')
                    .select('id, nome_etapa')
                    .order('nome_etapa');
                if (etapasError) console.error("Erro ao buscar etapas:", etapasError);
                else setEtapas(etapasData);
            }
        };

        if (isOpen) {
            fetchInitialData();
            if (isEditing) {
                setFormData({
                    nome: activityToEdit.nome || '',
                    descricao: activityToEdit.descricao || '',
                    etapa_id: activityToEdit.etapa_id || '',
                    funcionario_id: activityToEdit.funcionario_id || null,
                    data_inicio_prevista: activityToEdit.data_inicio_prevista || '',
                    duracao_dias: activityToEdit.duracao_dias || 1,
                    dependencies: activityToEdit.dependencies || null,
                    status: activityToEdit.status || 'Não Iniciado',
                });
            } else {
                setFormData(getInitialState());
            }
        }
    }, [isOpen, isEditing, activityToEdit, selectedEmpreendimento, getInitialState, supabase]);

    const dataFimPrevista = useMemo(() => {
        return addBusinessDays(formData.data_inicio_prevista, formData.duracao_dias);
    }, [formData.data_inicio_prevista, formData.duracao_dias]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: value === 'null' ? null : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUserId) {
            setMessage("Erro: Usuário não autenticado.");
            return;
        }
        setMessage('Salvando...');

        const etapaSelecionada = etapas.find(etapa => etapa.id == formData.etapa_id);

        const dadosParaSalvar = {
            ...formData,
            tipo_atividade: etapaSelecionada ? etapaSelecionada.nome_etapa : 'Atividade Interna',
            data_fim_prevista: dataFimPrevista,
        };

        let error;

        if (isEditing) {
            const { error: updateError } = await supabase
                .from('activities')
                .update(dadosParaSalvar)
                .eq('id', activityToEdit.id);
            error = updateError;
        } else {
            const dadosParaCriar = {
                ...dadosParaSalvar,
                // Associa ao empreendimento apenas se um for selecionado
                empreendimento_id: selectedEmpreendimento?.id || null,
                empresa_id: selectedEmpreendimento?.empresa_proprietaria_id || null,
                criado_por_usuario_id: currentUserId,
            };
            const { error: insertError } = await supabase.from('activities').insert([dadosParaCriar]);
            error = insertError;
        }

        if (error) {
            setMessage(`Erro: ${error.message}`);
            console.error("Erro ao salvar atividade:", error);
        } else {
            setMessage(`Atividade ${isEditing ? 'atualizada' : 'salva'} com sucesso!`);
            onActivityAdded();
            setTimeout(onClose, 1500);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">{isEditing ? 'Editar Atividade' : 'Adicionar Nova Atividade'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Nome da Atividade</label>
                            <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Descrição</label>
                            <textarea name="descricao" value={formData.descricao} onChange={handleChange} rows="3" className="mt-1 w-full p-2 border rounded-md"></textarea>
                        </div>

                        {/* Campos que só aparecem para atividades de empreendimentos */}
                        {selectedEmpreendimento && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium">Etapa da Obra</label>
                                    <select name="etapa_id" value={formData.etapa_id} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                                        <option value="">Selecione...</option>
                                        {etapas.map(etapa => <option key={etapa.id} value={etapa.id}>{etapa.nome_etapa}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Depende de (Tarefa Pai)</label>
                                    <p className="text-xs text-gray-500 mt-1">(Funcionalidade em desenvolvimento)</p>
                                </div>
                            </>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium">Atribuir a</label>
                            <select name="funcionario_id" value={formData.funcionario_id || 'null'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                <option value="null">Ninguém</option>
                                {funcionarios?.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                <option>Não Iniciado</option>
                                <option>Em Andamento</option>
                                <option>Concluído</option>
                                <option>Pausado</option>
                                <option>Aguardando Material</option>
                                <option>Cancelado</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Data de Início</label>
                            <input type="date" name="data_inicio_prevista" value={formData.data_inicio_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Duração (dias úteis)</label>
                            <input type="number" name="duracao_dias" min="1" value={formData.duracao_dias} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Data de Fim Prevista (Calculada)</label>
                            <input type="date" value={dataFimPrevista} readOnly className="mt-1 w-full p-2 border bg-gray-100 rounded-md cursor-not-allowed"/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Salvar Atividade</button>
                    </div>
                    {message && <p className="text-center mt-2">{message}</p>}
                </form>
            </div>
        </div>
    );
}