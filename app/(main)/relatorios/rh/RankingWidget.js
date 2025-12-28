"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrophy, 
  faMedal, 
  faSpinner, 
  faExclamationCircle, 
  faCalendarAlt 
} from '@fortawesome/free-solid-svg-icons';

export default function RankingWidget({ 
  title, 
  icon, 
  color, 
  data, 
  labelUnit, // ex: "faltas", "atrasos"
  periodoTexto, 
  isLoading, 
  isError 
}) {
  // Garante array
  const safeData = Array.isArray(data) ? data : [];
  const maxVal = safeData.length > 0 ? Math.max(...safeData.map(d => d.qtd), 10) : 10;

  const colorMap = {
    orange: {
      bgIcon: 'bg-orange-50', textIcon: 'text-orange-600',
      bar: 'bg-orange-500', textCount: 'text-orange-600'
    },
    red: {
      bgIcon: 'bg-red-50', textIcon: 'text-red-600',
      bar: 'bg-red-500', textCount: 'text-red-600'
    },
    blue: {
      bgIcon: 'bg-blue-50', textIcon: 'text-blue-600',
      bar: 'bg-blue-500', textCount: 'text-blue-600'
    }
  };
  
  const styles = colorMap[color] || colorMap.orange;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 relative overflow-hidden flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${styles.bgIcon} ${styles.textIcon}`}>
               <FontAwesomeIcon icon={icon} className="text-xl" />
            </div>
            <div>
               <h3 className="text-lg font-bold text-gray-800">{title}</h3>
               <p className="text-xs text-gray-400">Top 5 ocorrências</p>
            </div>
        </div>
        <div className="text-[10px] bg-gray-50 text-gray-500 px-2 py-1 rounded-md border border-gray-100 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-400" />
            {periodoTexto}
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1">
        {isLoading ? (
           <div className="h-40 flex flex-col items-center justify-center text-gray-400 gap-2">
             <FontAwesomeIcon icon={faSpinner} spin className="text-2xl opacity-30" />
             <span className="text-xs">Calculando...</span>
           </div>
        ) : isError ? (
           <div className="h-40 flex flex-col items-center justify-center text-red-400 gap-2 bg-red-50/50 rounded-lg">
             <FontAwesomeIcon icon={faExclamationCircle} className="text-xl" />
             <span className="text-xs">Erro ao calcular dados.</span>
           </div>
        ) : safeData.length > 0 ? (
          <div className="space-y-5">
            {safeData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-500" style={{animationDelay: `${idx * 100}ms`}}>
                <div className={`
                  w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm
                  ${idx === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200 shadow-sm' : 
                    idx === 1 ? 'bg-gray-100 text-gray-600' : 
                    idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400 border border-gray-100'}
                `}>
                  {idx === 0 ? <FontAwesomeIcon icon={faTrophy} className="text-xs" /> : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-end mb-1">
                    <span className={`text-sm font-medium truncate pr-2 ${idx === 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                      {item.nome}
                    </span>
                    <span className={`text-xs font-bold whitespace-nowrap ${idx === 0 ? styles.textCount : 'text-gray-500'}`}>
                      {item.qtd} {labelUnit}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${styles.bar}`}
                      style={{ width: `${(item.qtd / maxVal) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 truncate">{item.cargo || 'Cargo não definido'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm">
            <FontAwesomeIcon icon={faMedal} className="text-3xl mb-2 opacity-20" />
            <p>Nenhum registro encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}