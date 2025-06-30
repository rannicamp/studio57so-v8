"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHistory } from '@fortawesome/free-solid-svg-icons';

// Função aprimorada para adicionar dias úteis
function addBusinessDays(startDate, days) {
    if (!startDate || isNaN(days) || days <= 0) return startDate || '';
    let currentDate = new Date(startDate.replace(/-/g, '/'));
    let daysToAdd = Math.ceil(parseFloat(days));
    
    if (daysToAdd <= 0) return startDate;

    while (daysToAdd > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        // Apenas decrementa o contador se não for Sábado (6) ou Domingo (0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysToAdd--;
        }
    }
  
    // Garante que a data final não seja um fim de semana, pulando para a próxima segunda se necessário
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

    const [isReprogramming, setIsReprogramming] = useState(false);
    const [reprogramData, setReprogramData] = useState({ newEndDate: '', reason: '' });

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
        responsavel_texto: null, // Incluído para garantir que o estado esteja completo
    }), []);

    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);
            if (selectedEmpreendimento) {
                const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa').order('nome_etapa');
                setEtapas(etapasData || []);
            }
        };

        if (isOpen) {
            fetchInitialData();
            if (isEditing) setFormData({ ...getInitialState(), ...activityToEdit });
            else setFormData(getInitialState());
            setIsReprogramming(false);
            setReprogramData({ newEndDate: '', reason: '' });
        }
    }, [isOpen, isEditing, activityToEdit, selectedEmpreendimento, getInitialState, supabase]);

    const dataFimPrevistaCalculada = useMemo(() => {
        return addBusinessDays(formData.data_inicio_prevista, formData.duracao_dias);
    }, [formData.data_inicio_prevista, formData.duracao_dias]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: value === 'null' ? null : value }));
    };

    const handleReprogramChange = (e) => {
        const { name, value } = e.target;
        setReprogramData(prev => ({ ...prev, [name]: value }));
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUserId) {
            setMessage("Erro: Usuário não autenticado.");
            return;
        }
        setMessage('Salvando...');

        // **A CORREÇÃO PRINCIPAL ESTÁ AQUI**
        // Encontra o nome completo do funcionário selecionado
        const selectedFuncionario = funcionarios.find(f => f.id == formData.funcionario_id);
        const responsavelNome = selectedFuncionario ? selectedFuncionario.full_name : null;

        const etapaSelecionada = etapas.find(etapa => etapa.id == formData.etapa_id);
        
        const dadosParaSalvar = {
            ...formData,
            responsavel_texto: responsavelNome, // Salva o nome na coluna correta
            etapa_id: formData.etapa_id || null,
            funcionario_id: formData.funcionario_id || null,
            tipo_atividade: etapaSelecionada ? etapaSelecionada.nome_etapa : 'Atividade Interna',
            data_fim_prevista: formData.data_fim_prevista || dataFimPrevistaCalculada,
        };

        if (isReprogramming && reprogramData.newEndDate && reprogramData.reason) {
            if (!dadosParaSalvar.data_fim_original) {
                dadosParaSalvar.data_fim_original = dadosParaSalvar.data_fim_prevista;
            }
            dadosParaSalvar.data_fim_prevista = reprogramData.newEndDate;
            dadosParaSalvar.motivo_adiamento = reprogramData.reason;
        }

        let error;
        if (isEditing) {
            const { error: updateError } = await supabase.from('activities').update(dadosParaSalvar).eq('id', activityToEdit.id);
            error = updateError;
        } else {
            const dadosParaCriar = { ...dadosParaSalvar, empreendimento_id: selectedEmpreendimento?.id || null, empresa_id: selectedEmpreendimento?.empresa_proprietaria_id || null, criado_por_usuario_id: currentUserId };
            const { error: insertError } = await supabase.from('activities').insert([dadosParaCriar]);
            error = insertError;
        }

        if (error) {
            setMessage(`Erro: ${error.message}`);
        } else {
            setMessage(`Atividade ${isEditing ? 'atualizada' : 'salva'} com sucesso!`);
            onActivityAdded();
            setTimeout(onClose, 1500);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">{isEditing ? 'Editar Atividade' : 'Adicionar Nova Atividade'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="block text-sm font-medium">Nome da Atividade</label><input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/></div><div className="md:col-span-2"><label className="block text-sm font-medium">Descrição</label><textarea name="descricao" value={formData.descricao || ''} onChange={handleChange} rows="3" className="mt-1 w-full p-2 border rounded-md"></textarea></div>{selectedEmpreendimento && ( <> <div><label className="block text-sm font-medium">Etapa da Obra</label><select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{etapas.map(etapa => <option key={etapa.id} value={etapa.id}>{etapa.nome_etapa}</option>)}</select></div><div><label className="block text-sm font-medium">Depende de (Tarefa Pai)</label><p className="text-xs text-gray-500 mt-1">(Funcionalidade em desenvolvimento)</p></div></>)}<div><label className="block text-sm font-medium">Atribuir a</label><select name="funcionario_id" value={formData.funcionario_id || 'null'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="null">Ninguém</option>{funcionarios?.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}</select></div><div><label className="block text-sm font-medium">Status</label><select name="status" value={formData.status} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option></select></div><div><label className="block text-sm font-medium">Data de Início</label><input type="date" name="data_inicio_prevista" value={formData.data_inicio_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div><div><label className="block text-sm font-medium">Duração (dias úteis)</label><input type="number" name="duracao_dias" min="1" value={formData.duracao_dias || 1} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div><div className="md:col-span-2"><label className="block text-sm font-medium">Data de Fim Prevista (Calculada)</label><input type="date" value={dataFimPrevistaCalculada} readOnly className="mt-1 w-full p-2 border bg-gray-100 rounded-md cursor-not-allowed"/></div></div>
                    {isEditing && (
                        <div className="border-t pt-4">
                            {!isReprogramming ? (
                                <button type="button" onClick={() => setIsReprogramming(true)} className="text-sm text-orange-600 hover:underline flex items-center gap-2">
                                    <FontAwesomeIcon icon={faHistory} /> Reprogramar / Adiar Tarefa
                                </button>
                            ) : (
                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                                    <h4 className="font-semibold text-orange-800">Reprogramar Tarefa</h4>
                                    <div>
                                        <label className="block text-sm font-medium">Nova Data de Fim</label>
                                        <input type="date" name="newEndDate" value={reprogramData.newEndDate} onChange={handleReprogramChange} className="mt-1 w-full p-2 border rounded-md" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Motivo do Adiamento</label>
                                        <textarea name="reason" value={reprogramData.reason} onChange={handleReprogramChange} rows="2" className="mt-1 w-full p-2 border rounded-md" placeholder="Seja claro sobre o motivo da alteração da data."></textarea>
                                    </div>
                                    <button type="button" onClick={() => setIsReprogramming(false)} className="text-xs text-gray-600 hover:underline">Cancelar Reprogramação</button>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Salvar Atividade</button>
                    </div>
                    {message && <p className="text-center mt-2">{message}</p>}
                </form>
            </div>
        </div>
    );
}