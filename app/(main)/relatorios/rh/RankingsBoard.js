"use client";

import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUserClock, 
  faUserSlash, 
  faTrophy, 
  faMedal,
  faSpinner,
  faExclamationTriangle,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Função de busca (Mantida igual)
async function fetchRankings(organizacao_id, dateRef) {
  if (!organizacao_id) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_rh_rankings', { 
    p_organizacao_id: organizacao_id, 
    p_mes_ref: dateRef 
  });
  if (error) throw new Error(error.message);
  return data;
}

// Sub-componente de Lista (Agora recebe 'periodoTexto')
const RankingList = ({ title, icon, color, data, type, periodoTexto }) => {
  const maxVal = data && data.length > 0 ? Math.max(...data.map(d => d.qtd), 10) : 10;

  const colorMap = {
    orange: {
      bgIcon: 'bg-orange-50', textIcon: 'text-orange-600',
      bar: 'bg-orange-500', textCount: 'text-orange-600'
    },
    red: {
      bgIcon: 'bg-red-50', textIcon: 'text-red-600',
      bar: 'bg-red-500', textCount: 'text-red-600'
    }
  };
  
  const styles = colorMap[color] || colorMap.orange;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 relative overflow-hidden">
      
      {/* Cabeçalho do Card */}
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
        
        {/* Período no Cantinho */}
        <div className="text-[10px] bg-gray-50 text-gray-500 px-2 py-1 rounded-md border border-gray-100 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-400" />
            {periodoTexto}
        </div>
      </div>

      <div className="space-y-5">
        {data && data.length > 0 ? (
          data.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {/* Medalha */}
              <div className={`
                w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm
                ${idx === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200 shadow-sm' : 
                  idx === 1 ? 'bg-gray-100 text-gray-600' : 
                  idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400 border border-gray-100'}
              `}>
                {idx === 0 ? <FontAwesomeIcon icon={faTrophy} className="text-xs" /> : idx + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-end mb-1">
                  <span className={`text-sm font-medium truncate pr-2 ${idx === 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                    {item.nome}
                  </span>
                  <span className={`text-xs font-bold whitespace-nowrap ${idx === 0 ? styles.textCount : 'text-gray-500'}`}>
                    {item.qtd} {type === 'atrasos' ? 'atrasos' : 'faltas'}
                  </span>
                </div>
                
                {/* Barra */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${styles.bar} transition-all duration-1000 ease-out`}
                    style={{ width: `${(item.qtd / maxVal) * 100}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 truncate">{item.cargo || 'Cargo não definido'}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm">
            <FontAwesomeIcon icon={faMedal} className="text-3xl mb-2 opacity-20" />
            <p>Nenhum registro encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function RankingsBoard({ mesRef }) {
  const { user } = useAuth();

  const { data: rankings, isLoading, isError } = useQuery({
    queryKey: ['rhRankings', user?.organizacao_id, mesRef],
    queryFn: () => fetchRankings(user?.organizacao_id, mesRef),
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 * 5,
  });

  // Formata o texto do período (Ex: 01/12/2024 a 31/12/2024)
  const getPeriodoTexto = () => {
    if (!mesRef) return '';
    const [ano, mes] = mesRef.split('-'); // mesRef vem como YYYY-MM-DD
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return `01/${mes}/${ano} a ${ultimoDia}/${mes}/${ano}`;
  };

  const periodoTexto = getPeriodoTexto();

  if (isLoading) return (
    <div className="w-full h-64 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 items-center justify-center mt-8">
      <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-gray-300" />
      <span className="text-xs text-gray-400">Calculando rankings...</span>
    </div>
  );

  if (isError) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-6 w-full animate-in fade-in duration-700">
      {/* Ranking de Atrasos */}
      <RankingList 
        title="Mais Atrasos" 
        icon={faUserClock} 
        color="orange" 
        data={rankings?.atrasos}
        type="atrasos"
        periodoTexto={periodoTexto}
      />

      {/* Ranking de Faltas */}
      <RankingList 
        title="Mais Faltas" 
        icon={faUserSlash} 
        color="red" 
        data={rankings?.faltas}
        type="faltas"
        periodoTexto={periodoTexto}
      />
    </div>
  );
}