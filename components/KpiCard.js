//components\KpiCard.js

"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const KpiCard = ({ title, value, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm flex items-start gap-4">
      <div className={`w-12 h-12 flex items-center justify-center rounded-full flex-shrink-0 ${colorClasses[color]}`}>
        <FontAwesomeIcon icon={icon} className="text-xl" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

export default KpiCard;