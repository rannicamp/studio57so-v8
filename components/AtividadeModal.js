"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';

function addBusinessDays(startDate, days) {
  if (!startDate || isNaN(days) || days <= 0) {
    return startDate || '';
  }
  let currentDate = new Date(startDate.replace(/-/g, '/'));
  let daysToAdd = Math.ceil(parseFloat(days)) - 1;
  if (daysToAdd < 0) {
    return startDate;
  }
  while (daysToAdd > 0) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysToAdd--;
    }
  }
  return currentDate.toISOString().split('T')[0];
}

export default function AtividadeModal({ isOpen, onClose, selectedEmpreendimento, existingActivities, onActivityAdded, activityToEdit }) {
  const supabase = createClient();
  const [etapas, setEtapas] = useState([]);

  // CORREÇÃO: Usando useCallback para memorizar o estado inicial e evitar o aviso do linter
  const getInitialState = useCallback(() => ({
    nome: '',
    etapa_id: '',
    data_inicio_prevista: '',
    duracao_dias: 0,
    dependencies: null,
    status: 'Não Iniciado',
  }), []);

  const [formData, setFormData] = useState(getInitialState());
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const isEditing = Boolean(activityToEdit);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      } else {
        console.error("Nenhum usuário logado encontrado.");
        setMessage("Erro: Usuário não autenticado.");
      }

      const { data: etapasData, error: etapasError } = await supabase
        .from('etapa_obra')
        .select('id, nome_etapa')
        .order('nome_etapa', { ascending: true });
      
      if (etapasError) {
        console.error("Erro ao buscar etapas:", etapasError);
        setMessage("Erro ao carregar as etapas da obra.");
      } else {
        setEtapas(etapasData);
      }
    };

    if (isOpen) {
      fetchInitialData();
      if (isEditing) {
        setFormData({
          nome: activityToEdit.nome || '',
          etapa_id: activityToEdit.etapa_id || '',
          data_inicio_prevista: activityToEdit.data_inicio_prevista || '',
          duracao_dias: activityToEdit.duracao_dias || 0,
          dependencies: activityToEdit.dependencies || null,
          status: activityToEdit.status || 'Não Iniciado',
        });
      } else {
        setFormData(getInitialState());
      }
    }
  }, [isOpen, supabase, isEditing, activityToEdit, getInitialState]);


  const dataFimPrevista = useMemo(() => {
    return addBusinessDays(formData.data_inicio_prevista, formData.duracao_dias);
  }, [formData.data_inicio_prevista, formData.duracao_dias]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value === '' ? null : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUserId && !isEditing) {
        setMessage("Erro: Não foi possível identificar o usuário. Tente novamente.");
        return;
    }
    
    if (!formData.etapa_id) {
        setMessage("Erro: Por favor, selecione uma etapa para a atividade.");
        return;
    }

    setMessage('Salvando...');

    const dadosParaSalvar = {
      nome: formData.nome,
      etapa_id: formData.etapa_id,
      tipo_atividade: etapas.find(etapa => etapa.id == formData.etapa_id)?.nome_etapa,
      data_inicio_prevista: formData.data_inicio_prevista,
      duracao_dias: formData.duracao_dias,
      dependencies: formData.dependencies,
      data_fim_prevista: dataFimPrevista,
      status: formData.status,
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
        empreendimento_id: selectedEmpreendimento.id,
        empresa_id: selectedEmpreendimento.empresa_proprietaria_id,
        criado_por_usuario_id: currentUserId,
      }
      const { error: insertError } = await supabase.from('activities').insert([dadosParaCriar]);
      error = insertError;
    }


    if (error) {
      setMessage(`Erro: ${error.message}`);
      console.error("Erro ao salvar atividade:", error);
    } else {
      setMessage(`Atividade ${isEditing ? 'atualizada' : 'salva'} com sucesso!`);
      onActivityAdded();
      setTimeout(() => onClose(), 1500);
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
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome da Atividade</label>
              <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md"/>
            </div>
            <div>
              <label htmlFor="etapa_id" className="block text-sm font-medium text-gray-700">Etapa da Obra</label>
              <select name="etapa_id" id="etapa_id" value={formData.etapa_id} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                <option value="">Selecione uma etapa...</option>
                {etapas.map(etapa => <option key={etapa.id} value={etapa.id}>{etapa.nome_etapa}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="data_inicio_prevista" className="block text-sm font-medium text-gray-700">Data de Início Prevista</label>
              <input type="date" name="data_inicio_prevista" id="data_inicio_prevista" value={formData.data_inicio_prevista || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md"/>
            </div>
            <div>
              <label htmlFor="duracao_dias" className="block text-sm font-medium text-gray-700">Duração (dias úteis)</label>
              <input type="number" name="duracao_dias" id="duracao_dias" step="0.5" min="0" value={formData.duracao_dias} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md"/>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="data_fim_prevista" className="block text-sm font-medium text-gray-700">Data de Fim Prevista (Calculada)</label>
              <input type="date" name="data_fim_prevista" id="data_fim_prevista" value={dataFimPrevista} readOnly className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"/>
            </div>
             <div>
              <label htmlFor="dependencies" className="block text-sm font-medium text-gray-700">Depende de (Tarefa Pai)</label>
              <select name="dependencies" id="dependencies" value={formData.dependencies || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                <option value="">Nenhuma</option>
                {existingActivities?.filter(act => act.id !== activityToEdit?.id).map(act => <option key={act.id} value={act.id}>{act.nome}</option>)}
              </select>
            </div>
            {isEditing && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                <select name="status" id="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                  <option value="Não Iniciado">Não Iniciado</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Pausado">Pausado</option>
                  <option value="Aguardando Material">Aguardando Material</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            )}
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