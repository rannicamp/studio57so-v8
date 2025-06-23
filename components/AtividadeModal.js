"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';

// Função auxiliar para adicionar dias úteis a uma data, AGORA CORRIGIDA
function addBusinessDays(startDate, days) {
  if (!startDate || isNaN(days) || days <= 0) {
    return startDate || '';
  }

  let currentDate = new Date(startDate.replace(/-/g, '/')); // Corrige problema de fuso horário
  
  // A duração inclui o dia de início, então adicionamos 'duração - 1' dias úteis.
  // Usamos Math.ceil para tratar os casos de meio dia (ex: 4.5 dias)
  let daysToAdd = Math.ceil(parseFloat(days)) - 1;
  
  // Se a duração for menor que 1 (ex: 0.5), a tarefa termina no mesmo dia.
  if (daysToAdd < 0) {
    return startDate;
  }
  
  while (daysToAdd > 0) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay();
    // Pula Sábado (6) e Domingo (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysToAdd--;
    }
  }
  // Formata a data para YYYY-MM-DD
  return currentDate.toISOString().split('T')[0];
}


export default function AtividadeModal({ isOpen, onClose, selectedEmpreendimento, existingActivities, onActivityAdded }) {
  const supabase = createClient();

  const categories = [
    "01 - SERVIÇOS PRELIMINARES E GERAIS", "02 - INFRAESTRUTURA", "03 - SUPRAESTRUTURA",
    "04 - PAREDES E PAINEIS", "05 - ESQUADRIAS", "06 - VIDROS E PLASTICOS", "07 - COBERTURAS",
    "08 – IMPERMEABILIZAÇÕES E PISOS", "09 - REVESTIMENTOS INTERNOS", "10 - FORROS", "11 -PINTURA",
    "12 - PISOS", "13 - ACABAMENTOS", "14 - INSTALAÇOES ELÉRICAS E TELEFONICAS",
    "15 - INSTALAÇÕES HIDRAULICAS", "16 - INSTALAÇOES DE ESGOTO E ÁGUAS PLUVIAIS",
    "17 - LOUÇAS E METAIS", "18 - MARCENÁRIA", "19 - ANOTAÇÃO DE PROJETO"
  ];

  const [formData, setFormData] = useState({
    nome: '',
    tipo_atividade: categories[0],
    data_inicio_prevista: '',
    duracao_dias: 0,
    dependencies: null,
  });
  
  const [message, setMessage] = useState('');

  // O cálculo agora usará a nova função corrigida
  const dataFimPrevista = useMemo(() => {
    return addBusinessDays(formData.data_inicio_prevista, formData.duracao_dias);
  }, [formData.data_inicio_prevista, formData.duracao_dias]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value === '' ? null : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Salvando...');

    const dadosParaSalvar = {
      nome: formData.nome,
      tipo_atividade: formData.tipo_atividade,
      data_inicio_prevista: formData.data_inicio_prevista,
      duracao_dias: formData.duracao_dias,
      dependencies: formData.dependencies,
      data_fim_prevista: dataFimPrevista,
      empreendimento_id: selectedEmpreendimento.id,
      empresa_id: selectedEmpreendimento.empresa_proprietaria_id,
      criado_por_usuario_id: 1, // VALOR FIXO TEMPORÁRIO!
      status: 'Não iniciado',
    };

    const { error } = await supabase.from('activities').insert([dadosParaSalvar]);

    if (error) {
      setMessage(`Erro: ${error.message}`);
    } else {
      setMessage('Atividade salva com sucesso!');
      onActivityAdded();
      setTimeout(() => onClose(), 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Adicionar Nova Atividade</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome da Atividade</label>
              <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md"/>
            </div>
            <div>
              <label htmlFor="tipo_atividade" className="block text-sm font-medium text-gray-700">Categoria</label>
              <select name="tipo_atividade" id="tipo_atividade" value={formData.tipo_atividade} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="data_inicio_prevista" className="block text-sm font-medium text-gray-700">Data de Início Prevista</label>
              <input type="date" name="data_inicio_prevista" id="data_inicio_prevista" value={formData.data_inicio_prevista} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md"/>
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
                {existingActivities?.map(act => <option key={act.id} value={act.id}>{act.nome}</option>)}
              </select>
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