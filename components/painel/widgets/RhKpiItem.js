// components/painel/widgets/RhKpiItem.js
// O PORQUÊ: Este é um componente de layout de lista simples,
// inspirado no AtividadeCard.js, para substituir o KpiCard
// que estava causando problemas de layout.

"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function RhKpiItem({ icon, label, value, colorClass }) {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all">
      {/* Lado Esquerdo: Ícone e Título */}
      <div className="flex items-center gap-3">
        <FontAwesomeIcon
          icon={icon}
          className={`text-lg w-5 h-5 ${colorClass || 'text-gray-500'}`}
        />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>

      {/* Lado Direito: Valor */}
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}