"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBell, 
  faCheck, 
  faInbox, 
  faMoneyBillWave, 
  faHardHat, 
  faExclamationTriangle, 
  faBullhorn,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { toast } from 'sonner';

// Mapa de ícones e cores por tipo de notificação
const TIPO_CONFIG = {
  financeiro: { icon: faMoneyBillWave, color: 'text-green-600', bg: 'bg-green-100' },
  obras:      { icon: faHardHat,       color: 'text-orange-600', bg: 'bg-orange-100' },
  erro:       { icon: faExclamationTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  sucesso:    { icon: faCheckCircle,   color: 'text-teal-600',  bg: 'bg-teal-100' },
  alerta:     { icon: faBullhorn,      color: 'text-yellow-600', bg: 'bg-yellow-100' },
  sistema:    { icon: faBell,          color: 'text-blue-600',   bg: 'bg-blue-100' },
  default:    { icon: faBell,          color: 'text-gray-600',   bg: 'bg-gray-100' }
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const lastNotificationIdRef = useRef(null); // Para rastrear novidades
  
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. CARREGAMENTO MÁGICO (Polling + Cache)
  const { data: notificacoes = [], isLoading, isRefetching } = useQuery({
    queryKey: ['notificacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 15000, // Checa a cada 15s
    staleTime: 1000 * 60,   // Considera os dados "frescos" por 1 min (evita loading spinner desnecessário)
  });

  // 2. DETECTOR DE NOVIDADES
  useEffect(() => {
    if (notificacoes.length > 0) {
      const latestId = notificacoes[0].id;
      
      // Se tivermos um ID salvo e o novo for diferente, chegou coisa nova!
      if (lastNotificationIdRef.current && latestId !== lastNotificationIdRef.current) {
        toast.info("🔔 Novas notificações recebidas!");
        // Toca um som sutil se quiser (opcional)
        // new Audio('/sounds/notification.mp3').play().catch(() => {});
      }
      
      lastNotificationIdRef.current = latestId;
    }
  }, [notificacoes]);

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  // Mutations
  const marcarComoLidaMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries(['notificacoes'])
  });

  const marcarTodasLidasMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('notificacoes').update({ lida: true }).eq('user_id', user.id).eq('lida', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes']);
      toast.success("Tudo limpo!");
    }
  });

  // Click Outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const handleNotificationClick = (notificacao) => {
    if (!notificacao.lida) marcarComoLidaMutation.mutate(notificacao.id);
    setIsOpen(false);
  };

  // Helper para pegar estilo do ícone
  const getStyle = (tipo) => TIPO_CONFIG[tipo] || TIPO_CONFIG.default;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors rounded-full hover:bg-gray-100"
      >
        <FontAwesomeIcon icon={faBell} className={`h-5 w-5 ${isOpen ? 'text-blue-600' : ''}`} />
        {naoLidas > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
          
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700 text-sm">Notificações</h3>
            <div className="flex gap-3">
              {isRefetching && <span className="text-[10px] text-gray-400 animate-pulse">Atualizando...</span>}
              {naoLidas > 0 && (
                <button
                  onClick={() => marcarTodasLidasMutation.mutate()}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faCheck} /> Ler todas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {isLoading && !notificacoes.length ? (
              <div className="p-6 text-center text-gray-400">
                <p className="text-xs">Carregando...</p>
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <div className="bg-gray-100 p-3 rounded-full mb-3">
                    <FontAwesomeIcon icon={faInbox} className="text-gray-300 text-lg" />
                </div>
                <p className="text-sm">Nenhuma notificação recente.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notificacoes.map((notif) => {
                  const style = getStyle(notif.tipo);
                  return (
                    <li 
                      key={notif.id} 
                      className={`hover:bg-gray-50 transition-colors duration-150 ${!notif.lida ? 'bg-blue-50/40' : ''}`}
                    >
                      <div 
                        onClick={() => notif.link ? null : handleNotificationClick(notif)}
                        className="block w-full text-left"
                      >
                        {/* Wrapper condicional para Link */}
                        {notif.link ? (
                           <Link 
                             href={notif.link} 
                             onClick={() => handleNotificationClick(notif)}
                             className="flex px-4 py-3 gap-3 items-start"
                           >
                             <Content notif={notif} style={style} />
                           </Link>
                        ) : (
                           <div className="flex px-4 py-3 gap-3 items-start cursor-pointer">
                             <Content notif={notif} style={style} />
                           </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          
          <div className="bg-gray-50 p-2 border-t border-gray-100 text-center">
            <Link href="/painel/notificacoes" onClick={() => setIsOpen(false)} className="text-xs text-blue-600 font-semibold hover:underline">
                Ver histórico completo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-componente para renderizar o conteúdo interno da notificação
function Content({ notif, style }) {
  return (
    <>
      {/* Ícone do Tipo */}
      <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg} ${style.color}`}>
        <FontAwesomeIcon icon={style.icon} className="text-xs" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <p className={`text-sm mb-0.5 ${!notif.lida ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>
            {notif.titulo}
          </p>
          {!notif.lida && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 ml-2 flex-shrink-0"></span>}
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
          {notif.mensagem}
        </p>
        <p className="text-[10px] text-gray-400 mt-1">
          {new Date(notif.created_at).toLocaleString('pt-BR', { 
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
          })}
        </p>
      </div>
    </>
  );
}