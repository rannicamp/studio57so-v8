"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheck, faInbox } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. CARREGAMENTO AUTOMÁTICO (Polling a cada 15s)
  // Busca as notificações direto do banco de dados
  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20); // Limita às últimas 20 para não pesar

      if (error) {
        console.error('Erro ao buscar notificações:', error);
        return [];
      }
      return data;
    },
    enabled: !!user, // Só busca se tiver usuário logado
    refetchInterval: 15000, // Atualiza sozinho a cada 15 segundos
  });

  // Conta quantas não foram lidas
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  // 2. AÇÃO: Marcar uma como lida
  const marcarComoLidaMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes']); // Atualiza a lista na hora
    }
  });

  // 3. AÇÃO: Marcar TODAS como lidas
  const marcarTodasLidasMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('user_id', user.id)
        .eq('lida', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes']);
      toast.success("Todas marcadas como lidas!");
    }
  });

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // Ao clicar em uma notificação
  const handleNotificationClick = (notificacao) => {
    if (!notificacao.lida) {
      marcarComoLidaMutation.mutate(notificacao.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do Sino */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors rounded-full hover:bg-gray-100"
        title="Notificações"
      >
        <FontAwesomeIcon icon={faBell} className={`h-5 w-5 ${isOpen ? 'text-blue-600' : ''}`} />
        
        {/* Bolinha Vermelha (Contador) */}
        {!isLoading && naoLidas > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden transform origin-top-right transition-all">
          
          {/* Cabeçalho do Dropdown */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700 text-sm">Notificações</h3>
            {naoLidas > 0 && (
              <button
                onClick={() => marcarTodasLidasMutation.mutate()}
                disabled={marcarTodasLidasMutation.isPending}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
              >
                <FontAwesomeIcon icon={faCheck} /> Ler todas
              </button>
            )}
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-6 text-center text-gray-400">
                <div className="animate-spin inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full mb-2"></div>
                <p className="text-xs">Atualizando...</p>
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <div className="bg-gray-100 p-3 rounded-full mb-3">
                    <FontAwesomeIcon icon={faInbox} className="text-gray-300 text-lg" />
                </div>
                <p className="text-sm">Tudo limpo por aqui!</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notificacoes.map((notif) => (
                  <li 
                    key={notif.id} 
                    className={`hover:bg-gray-50 transition-colors duration-150 ${!notif.lida ? 'bg-blue-50/60' : ''}`}
                  >
                    <div className="relative group">
                        {/* Se tiver link, usa Link do Next.js */}
                        {notif.link ? (
                            <Link 
                                href={notif.link} 
                                onClick={() => handleNotificationClick(notif)}
                                className="block px-4 py-3"
                            >
                                <div className="flex gap-3 items-start">
                                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!notif.lida ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm mb-0.5 ${!notif.lida ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>
                                            {notif.titulo}
                                        </p>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                            {notif.mensagem}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {new Date(notif.created_at).toLocaleString('pt-BR', { 
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            // Sem link, apenas texto
                            <div 
                                onClick={() => handleNotificationClick(notif)}
                                className="cursor-pointer px-4 py-3"
                            >
                                <div className="flex gap-3 items-start">
                                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!notif.lida ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm mb-0.5 ${!notif.lida ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>
                                            {notif.titulo}
                                        </p>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                            {notif.mensagem}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {new Date(notif.created_at).toLocaleString('pt-BR', { 
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Rodapé fixo */}
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