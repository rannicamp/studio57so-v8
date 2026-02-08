// components/painel/widgets/NotificacoesWidget.js
"use client";

import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheck, facheckDouble, faSpinner, faInbox } from '@fortawesome/free-solid-svg-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NotificacoesWidget({ userId }) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    // 1. Busca as notificações
    const { data: notificacoes, isLoading } = useQuery({
        queryKey: ['painel_notificacoes', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('notificacoes')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }) // As mais novas primeiro
                .limit(7); // Pega apenas as 7 últimas para não poluir o painel

            if (error) throw error;
            return data;
        },
        // Atualiza a cada 30 segundos sozinho
        refetchInterval: 30000 
    });

    // 2. Função para marcar como lida
    const markAsReadMutation = useMutation({
        mutationFn: async (notificacaoId) => {
            const { error } = await supabase
                .from('notificacoes')
                .update({ lida: true })
                .eq('id', notificacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            // Atualiza a lista visualmente
            queryClient.invalidateQueries(['painel_notificacoes']);
            queryClient.invalidateQueries(['notificacoes_nao_lidas']); // Atualiza o sininho do topo também
        },
        onError: () => {
            toast.error("Erro ao atualizar notificação.");
        }
    });

    if (isLoading) {
        return (
            <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-64 flex flex-col justify-center items-center gap-3">
                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-500" />
                <p className="text-gray-400 text-sm">Buscando novidades...</p>
            </div>
        );
    }

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100 flex flex-col h-full max-h-[500px]">
            {/* Cabeçalho do Widget */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2 text-gray-800">
                    <FontAwesomeIcon icon={faBell} className="text-yellow-500" />
                    <h3 className="font-bold">Últimos Avisos</h3>
                </div>
                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                    {notificacoes?.filter(n => !n.lida).length || 0} não lidos
                </span>
            </div>

            {/* Lista de Notificações */}
            <div className="overflow-y-auto p-2 space-y-2 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                {notificacoes?.length > 0 ? (
                    notificacoes.map((notif) => (
                        <div 
                            key={notif.id} 
                            className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-sm relative group ${
                                !notif.lida ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1">
                                    <h4 className={`text-sm ${!notif.lida ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>
                                        {notif.titulo}
                                    </h4>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {notif.mensagem}
                                    </p>
                                    
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] text-gray-400">
                                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                                        </span>
                                        {notif.link && (
                                            <Link href={notif.link} className="text-[10px] text-blue-600 hover:underline font-medium">
                                                Ver detalhes →
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Botão de Marcar como Lida */}
                                {!notif.lida && (
                                    <button
                                        onClick={() => markAsReadMutation.mutate(notif.id)}
                                        className="text-gray-400 hover:text-green-600 p-1"
                                        title="Marcar como lida"
                                    >
                                        <FontAwesomeIcon icon={faCheck} size="sm" />
                                    </button>
                                )}
                            </div>
                            
                            {/* Bolinha Azul indicando novo */}
                            {!notif.lida && (
                                <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full animate-pulse pointer-events-none"></div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <FontAwesomeIcon icon={faInbox} className="text-3xl mb-2 opacity-30" />
                        <p className="text-sm">Tudo limpo por aqui!</p>
                    </div>
                )}
            </div>
        </div>
    );
}