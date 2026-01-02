// components/dashboard/NotificationTimeline.js
"use client";

import { useRef, useCallback, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from 'use-debounce'; // Certifique-se de ter instalado: npm install use-debounce
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faHome, faFileSignature, faBell, faMoneyBillWave, 
    faCheckCircle, faClock, faExclamationCircle, 
    faHistory, faSpinner, faSearch, faTimes
} from '@fortawesome/free-solid-svg-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 100;

// Função de busca com suporte a filtro de texto
async function fetchNotificationsLog({ pageParam = 0, queryKey }) {
    const [_key, organizacao_id, searchTerm] = queryKey; // Recebe o termo de busca da chave
    if (!organizacao_id) return [];
    
    const supabase = createClient();
    
    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
        .from('notificacoes')
        .select('*')
        .eq('organizacao_id', organizacao_id)
        .order('created_at', { ascending: false })
        .range(from, to);

    // Se houver termo de busca, filtra no banco
    if (searchTerm) {
        // Busca no título OU na mensagem
        query = query.or(`titulo.ilike.%${searchTerm}%,mensagem.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Erro ao buscar log:", error);
        throw new Error("Falha ao carregar notificações");
    }
    return data;
}

const getNotificationStyle = (titulo = '', mensagem = '') => {
    const text = (titulo + ' ' + mensagem).toLowerCase();
    if (text.includes('venda') || text.includes('vendida')) return { icon: faHome, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' };
    if (text.includes('contrato') || text.includes('assinado')) return { icon: faFileSignature, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' };
    if (text.includes('reserva') || text.includes('reservada')) return { icon: faClock, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' };
    if (text.includes('pagamento') || text.includes('financeiro') || text.includes('recebido')) return { icon: faMoneyBillWave, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' };
    if (text.includes('erro') || text.includes('falha') || text.includes('atenção')) return { icon: faExclamationCircle, color: 'text-red-500', bg: 'bg-red-100', border: 'border-red-200' };
    if (text.includes('criado') || text.includes('novo')) return { icon: faCheckCircle, color: 'text-indigo-500', bg: 'bg-indigo-100', border: 'border-indigo-200' };
    return { icon: faBell, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' };
};

export default function NotificationTimeline() {
    const { user } = useAuth();
    const scrollRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Debounce para não fazer requisição a cada letra digitada (espera 500ms)
    const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useInfiniteQuery({
        queryKey: ['notificationsLog', user?.organizacao_id, debouncedSearchTerm], // Termo na chave força recarregamento
        queryFn: fetchNotificationsLog,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
        },
        enabled: !!user?.organizacao_id,
        staleTime: 1000 * 30, 
    });

    const handleScroll = useCallback(() => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            if (scrollHeight - scrollTop - clientHeight < 50) {
                if (hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            }
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const notifications = data ? data.pages.flat() : [];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col max-h-[calc(100vh-120px)] sticky top-4">
            
            {/* Cabeçalho Fixo */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl backdrop-blur-sm z-10 space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <FontAwesomeIcon icon={faHistory} className="text-blue-500" />
                    Linha do Tempo
                </h3>
                
                {/* Campo de Pesquisa */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-xs" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Pesquisar log..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                            <FontAwesomeIcon icon={faTimes} className="text-xs" />
                        </button>
                    )}
                </div>
            </div>

            {/* Lista com Rolagem */}
            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="p-4 overflow-y-auto custom-scrollbar flex-1 scroll-smooth"
            >
                {isLoading ? (
                    <div className="space-y-6 animate-pulse px-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex gap-4">
                                <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0"></div>
                                <div className="flex-1 space-y-2 py-1">
                                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                    <div className="h-2 bg-gray-100 rounded w-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm flex flex-col items-center gap-2">
                        <FontAwesomeIcon icon={faSearch} className="text-2xl opacity-20" />
                        <p>{searchTerm ? 'Nenhum resultado encontrado.' : 'Nenhuma atividade recente.'}</p>
                    </div>
                ) : (
                    <div className="relative border-l-2 border-gray-100 ml-3.5 space-y-8 pb-4">
                        {notifications.map((notif) => {
                            const style = getNotificationStyle(notif.titulo, notif.mensagem);
                            
                            return (
                                <div key={notif.id} className="relative pl-8 group animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className={`absolute -left-[11px] top-0 w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 ${style.bg} ${style.color} z-10`}>
                                        <FontAwesomeIcon icon={style.icon} size="xs" />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className={`text-xs font-bold ${style.color}`}>
                                                {notif.titulo}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded">
                                                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                                            </span>
                                        </div>
                                        
                                        <p className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
                                            {notif.mensagem}
                                        </p>
                                        
                                        {notif.link && (
                                            <a href={notif.link} className="text-xs font-medium text-blue-500 hover:text-blue-700 hover:underline mt-1 w-fit transition-colors">
                                                Ver detalhes &rarr;
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {isFetchingNextPage && (
                            <div className="flex justify-center py-4">
                                <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}