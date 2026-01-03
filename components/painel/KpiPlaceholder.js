// components/painel/KpiPlaceholder.js
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

export default function KpiPlaceholder({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="h-full min-h-[160px] w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-white hover:border-blue-300 hover:shadow-sm transition-all duration-300 group cursor-pointer"
    >
      <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-colors">
        <FontAwesomeIcon icon={faPlus} className="text-xl" />
      </div>
      <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">
        Novo Indicador
      </span>
    </button>
  );
}