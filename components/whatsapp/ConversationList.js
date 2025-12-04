import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ConversationList({ conversations, isLoading, onSelectContact, selectedContactId }) {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Carregando conversas...</p>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Nenhuma conversa encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto">
      <ul>
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            onClick={() => onSelectContact(conversation)}
            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedContactId === conversation.contato_id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <div className="flex items-center">
              {/* Avatar */}
              <div className="relative">
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0">
                  {conversation.avatar_url ? (
                    <img src={conversation.avatar_url} alt={conversation.nome} className="w-full h-full object-cover" />
                  ) : (
                    (conversation.nome || '?').charAt(0).toUpperCase()
                  )}
                </div>
                {/* Indicador de não lidas */}
                {conversation.unread_count > 0 && (
                  <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {conversation.unread_count}
                  </div>
                )}
              </div>

              {/* Info da Conversa */}
              <div className="ml-4 flex-grow min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-semibold text-gray-900 truncate pr-2">
                    {conversation.nome || conversation.phone_number}
                  </h3>
                  {/* CORREÇÃO AQUI: Usando last_message_time */}
                  {conversation.last_message_time && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {format(new Date(conversation.last_message_time), 'HH:mm', { locale: ptBR })}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-sm text-gray-500 truncate w-full">
                    {conversation.last_message || 'Inicie uma conversa'}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}