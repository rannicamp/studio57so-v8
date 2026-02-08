// components/painel/widgets/AtividadeCard.js
// CÓDIGO COMPLETO

import React from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
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
  const statusColor = {
    'Não iniciado': 'text-gray-500',
    'Em andamento': 'text-blue-500',
    'Aguardando': 'text-yellow-500',
  };

  return (
    <Link href={`/atividades?id=${atividade.id}`}>
      <span className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg mb-2 transition-all">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-800 truncate" title={atividade.nome}>
            {atividade.nome}
          </span>
          <span className={`text-xs font-bold ${statusColor[atividade.status] || 'text-gray-500'}`}>
            {atividade.status}
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">
            {atividade.empreendimentos?.nome || 'Sem empreendimento'}
          </span>
          <span className="text-xs text-gray-500 flex items-center">
            <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
            {formatDate(atividade.data_fim_prevista)}
          </span>
        </div>
      </span>
    </Link>
  );
}