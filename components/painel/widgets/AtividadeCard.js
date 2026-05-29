// components/painel/widgets/AtividadeCard.js
// CÓDIGO COMPLETO

import React from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faUser, faPen, faCheck } from '@fortawesome/free-solid-svg-icons';
import { format, isBefore, startOfToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '../../../utils/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// O PORQUÊ: Este é um componente "filho", usado pelo MinhasAtividadesWidget.
// Ele agora exibe botões inline para edição rápida, conclusão e alteração de status via dropdown diretamente da Home.
// Usamos a Regra 5c: as datas YYYY-MM-DD são tratadas como texto para evitar fuso horário.

const formatDate = (dateString) => {
  if (!dateString) return 'Sem data';
  try {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch (e) {
    console.error("Erro formatando data:", e);
    return dateString;
  }
};

export default function AtividadeCard({ atividade, onEdit }) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const getBadgeColor = (status) => {
    const normalizedStatus = status?.toLowerCase();
    if (normalizedStatus === 'não iniciado') return 'bg-gray-100 text-gray-800';
    if (normalizedStatus === 'em andamento') return 'bg-blue-100 text-blue-800';
    if (normalizedStatus === 'concluído') return 'bg-green-100 text-green-800';
    if (normalizedStatus === 'pausado') return 'bg-yellow-100 text-yellow-800';
    if (normalizedStatus === 'aguardando material') return 'bg-purple-100 text-purple-800';
    if (normalizedStatus === 'cancelado') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const dataConsiderada = atividade.data_inicio_real || atividade.data_inicio_prevista || atividade.data_fim_prevista;
  const isAtrasada = dataConsiderada && isBefore(parseISO(dataConsiderada), startOfToday()) && atividade.status !== 'Concluído';
  
  const responsavel = atividade.funcionarios?.full_name || atividade.responsavel_texto || 'Sem responsável';

  const handleComplete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('activities')
        .update({ 
          status: 'Concluído',
          data_inicio_real: atividade.data_inicio_real || new Date().toISOString().split('T')[0]
        })
        .eq('id', atividade.id);

      if (error) throw error;
      toast.success(`Atividade "${atividade.nome}" concluída com sucesso!`);
      
      queryClient.invalidateQueries({ queryKey: ['atividadesPainel'] });
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao concluir atividade: " + err.message);
    }
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus = e.target.value;
    try {
      const updatePayload = { status: newStatus };
      if (newStatus === 'Concluído') {
        updatePayload.data_inicio_real = atividade.data_inicio_real || new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('activities')
        .update(updatePayload)
        .eq('id', atividade.id);

      if (error) throw error;
      toast.success(`Status da atividade alterado para "${newStatus}"!`);

      queryClient.invalidateQueries({ queryKey: ['atividadesPainel'] });
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao alterar status: " + err.message);
    }
  };

  const handleEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(atividade);
    }
  };

  return (
    <Link href={`/atividades?id=${atividade.id}`}>
      <span className="block p-3 bg-white hover:bg-gray-50 border border-gray-100 rounded-lg mb-2 transition-all group shadow-sm relative">
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 truncate flex-1" title={atividade.nome}>
            {atividade.nome}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 z-10">
            {atividade.status !== 'Concluído' && (
              <button
                type="button"
                onClick={handleComplete}
                title="Concluir Atividade"
                className="w-6 h-6 rounded-full bg-green-50 hover:bg-green-600 hover:text-white text-green-600 flex items-center justify-center border border-green-200 transition-colors shadow-sm active:scale-90"
              >
                <FontAwesomeIcon icon={faCheck} className="text-[10px] font-bold" />
              </button>
            )}
            <button
              type="button"
              onClick={handleEdit}
              title="Editar Atividade"
              className="w-6 h-6 rounded-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 flex items-center justify-center border border-blue-200 transition-colors shadow-sm active:scale-90"
            >
              <FontAwesomeIcon icon={faPen} className="text-[10px]" />
            </button>
            
            {/* Dropdown de status interativo */}
            <select
              value={atividade.status}
              onChange={handleStatusChange}
              onClick={(e) => {
                e.stopPropagation(); // impede a navegação do Link ao abrir
              }}
              className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full border-0 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500/20 shadow-sm leading-none transition-all active:scale-95 ${getBadgeColor(atividade.status)}`}
            >
              <option value="Não Iniciado" className="bg-white text-gray-800">Não Iniciado</option>
              <option value="Em andamento" className="bg-white text-gray-800">Em andamento</option>
              <option value="Pausado" className="bg-white text-gray-800">Pausado</option>
              <option value="Aguardando material" className="bg-white text-gray-800">Aguardando material</option>
              <option value="Concluído" className="bg-white text-gray-800">Concluído</option>
              <option value="Cancelado" className="bg-white text-gray-800">Cancelado</option>
            </select>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">
              {atividade.empreendimentos?.nome || 'Geral'}
            </span>
            <span className="text-[11px] text-gray-500 flex items-center" title="Responsável">
              <FontAwesomeIcon icon={faUser} className="mr-1.5 text-gray-400" />
              {responsavel}
            </span>
          </div>
          <span className={`text-xs font-bold flex items-center ${isAtrasada ? 'text-red-500' : 'text-gray-500'}`}>
            <FontAwesomeIcon icon={faCalendarAlt} className="mr-1.5" />
            {formatDate(dataConsiderada)}
          </span>
        </div>
      </span>
    </Link>
  );
}