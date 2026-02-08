"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBell, faCheck, faInbox, faMoneyBillWave, faHardHat, 
  faExclamationTriangle, faBullhorn, faCheckCircle, faCommentDots 
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Ícones Modernos
const TIPO_CONFIG = {
  financeiro: { icon: faMoneyBillWave, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  obras:      { icon: faHardHat,       color: 'text-orange-600',  bg: 'bg-orange-50' },
  erro:       { icon: faExclamationTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  sucesso:    { icon: faCheckCircle,   color: 'text-blue-600',    bg: 'bg-blue-50' },
  alerta:     { icon: faBullhorn,      color: 'text-amber-600',   bg: 'bg-amber-50' },
  sistema:    { icon: faBell,          color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  whatsapp:   { icon: faCommentDots,   color: 'text-green-600',   bg: 'bg-green-50' },
  default:    { icon: faBell,          color: 'text-gray-500',    bg: 'bg-gray-50' }
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const lastIdRef = useRef(null);
  
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (notificacoes.length > 0) {
      const latest = notificacoes[0].id;
      if (lastIdRef.current && latest !== lastIdRef.current) {
        // Toca som suave (opcional)
        // new Audio('/sounds/pop.mp3').play().catch(() => {});
      }
      lastIdRef.current = latest;
    }
  }, [notificacoes]);

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const marcarLida = useMutation({
    mutationFn: async (id) => {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries(['notificacoes'])
  });

  const lerTodas = useMutation({
    mutationFn: async () => {
      await supabase.from('notificacoes').update({ lida: true }).eq('user_id', user.id).eq('lida', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes']);
      toast.success("Todas marcadas como lidas");
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

  const handleItemClick = (notif) => {
    if (!notif.lida) marcarLida.mutate(notif.id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-gray-500 hover:text-gray-800 transition-all rounded-full hover:bg-gray-100 active:scale-95"
      >
        <FontAwesomeIcon icon={faBell} className={`h-5 w-5 ${isOpen ? 'text-blue-600' : ''}`} />
        {naoLidas > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black/5 transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
          
          <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center bg-white">
            <h3 className="font-bold text-gray-800 text-base">Notificações</h3>
            {naoLidas > 0 && (
              <button
                onClick={() => lerTodas.mutate()}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
            ) : notificacoes.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <FontAwesomeIcon icon={faInbox} className="text-gray-300 text-xl" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Tudo limpo por aqui!</p>
                <p className="text-xs text-gray-400 mt-1">Nenhuma notificação recente.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notificacoes.map((notif) => {
                  const style = TIPO_CONFIG[notif.tipo] || TIPO_CONFIG.default;
                  const timeAgo = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR });
                  
                  return (
                    <li key={notif.id} className={`group relative transition-all duration-200 hover:bg-gray-50 ${!notif.lida ? 'bg-blue-50/30' : ''}`}>
                      {/* Link Wrapper */}
                      <Link 
                        href={notif.link || '#'} 
                        onClick={() => handleItemClick(notif)}
                        className="flex px-5 py-4 gap-4 items-start"
                      >
                        {/* Ícone */}
                        <div className={`mt-1 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg} ${style.color} shadow-sm group-hover:scale-105 transition-transform`}>
                          <FontAwesomeIcon icon={style.icon} className="text-sm" />
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <p className={`text-sm leading-tight ${!notif.lida ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                              {notif.titulo}
                            </p>
                            {!notif.lida && (
                              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0 shadow-sm"></span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                            {notif.mensagem}
                          </p>
                          
                          <p className="text-[11px] text-gray-400 font-medium pt-1">
                            {timeAgo}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          
          <div className="bg-gray-50/50 p-2 border-t border-gray-100 text-center">
            <Link href="/painel/notificacoes" onClick={() => setIsOpen(false)} className="block w-full py-2 text-xs text-gray-500 font-medium hover:text-blue-600 hover:bg-white rounded transition-all">
                Ver histórico completo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}