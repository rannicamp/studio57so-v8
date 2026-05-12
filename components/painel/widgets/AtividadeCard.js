// components/painel/widgets/AtividadeCard.js
// CÓDIGO COMPLETO

import React from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import { format, isBefore, startOfToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// O PORQUÊ: Este é um componente "filho", usado pelo MinhasAtividadesWidget.
// Ele apenas recebe uma atividade e a formata de um jeito bonito.
// Usamos a Regra 5c: a data_fim_prevista é uma data simples (YYYY-MM-DD),
// então NÃO usamos 'new Date()' para evitar erros de fuso.

const formatDate = (dateString) => {
  if (!dateString) return 'Sem data';
  // Regra 5c: Data Simples (YYYY-MM-DD) -> Tratar como texto
  try {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch (e) {
    console.error("Erro formatando data:", e);
    return dateString;
  }
};

export default function AtividadeCard({ atividade }) {
  // Mesmas cores usadas no painel de atividades (ActivityList)
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

  return (
    <Link href={`/atividades?id=${atividade.id}`}>
      <span className="block p-3 bg-white hover:bg-gray-50 border border-gray-100 rounded-lg mb-2 transition-all group shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-800 truncate" title={atividade.nome}>
            {atividade.nome}
          </span>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getBadgeColor(atividade.status)}`}>
            {atividade.status}
          </span>
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