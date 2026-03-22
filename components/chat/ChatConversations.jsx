"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCommentSlash } from '@fortawesome/free-solid-svg-icons';
import { useConversationsList } from './ChatHooks';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatConversations({ onSelectConversation }) {
    const { data: convs, isLoading, error } = useConversationsList();

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2" />
                <p className="text-sm">Carregando conversas...</p>
            </div>
        );
    }

    if (!convs || convs.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-4">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4 border border-gray-200 shadow-sm">
                    <FontAwesomeIcon icon={faCommentSlash} className="text-3xl text-gray-300" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">Nenhuma Conversa Ativa</h4>
                <p className="text-center text-sm px-4">Acesse a aba Contatos para iniciar uma conversa ou criar um Memorando.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto w-full p-2 space-y-1">
            {convs.map(conv => {
                const fullName = conv.other_user_sobrenome ? `${conv.other_user_nome} ${conv.other_user_sobrenome}` : conv.other_user_nome;
                const displayName = fullName || 'Usuário Desconhecido';
                const initial = displayName.charAt(0).toUpperCase();
                
                return (
                    <div 
                        key={conv.conversation_id}
                        onClick={() => onSelectConversation({ id: conv.other_user_id, nome: conv.other_user_nome, sobrenome: conv.other_user_sobrenome, avatar_url: conv.other_user_avatar })}
                        className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors group relative"
                    >
                        {/* Avatar */}
                        {conv.other_user_avatar ? (
                            <img src={conv.other_user_avatar} alt={displayName} className="w-12 h-12 rounded-full object-cover shadow-sm bg-white shrink-0" />
                        ) : (
                            <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center text-white font-bold shadow-sm group-hover:shadow-md transition-all">
                                {initial}
                            </div>
                        )}
                        
                        {/* Info */}
                        <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-[15px] font-semibold text-gray-800 truncate pr-2">{displayName}</h4>
                                <span className="text-[10px] text-gray-400 shrink-0 font-medium tracking-wide">
                                    {new Date(conv.last_message_created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <p className={`text-[13px] truncate ${conv.unread_count > 0 ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                    {conv.last_message_content}
                                </p>
                                {conv.unread_count > 0 && (
                                    <span className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm">
                                        {conv.unread_count}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
