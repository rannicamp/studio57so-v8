// components/whatsapp/ConversationList.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ConversationList({ conversations, isLoading, onSelectContact, selectedContactId }) {

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
      </div>
    )
  }

  // O componente agora é apenas a área de rolagem da lista.
  return (
    <div className="h-full overflow-y-auto">
        {conversations && conversations.length > 0 ? (
          conversations.map(convo => (
            <div
              key={convo.contato_id}
              onClick={() => onSelectContact(convo)}
              className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 ${selectedContactId === convo.contato_id ? 'bg-blue-100' : ''}`}
            >
              <div className="w-12 h-12 bg-gray-300 rounded-full mr-3 flex items-center justify-center font-bold text-white">
                {convo.nome?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold truncate">{convo.nome || 'Nome não encontrado'}</h3>
                  <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {convo.last_message_sent_at 
                      ? formatDistanceToNow(new Date(convo.last_message_sent_at), { addSuffix: true, locale: ptBR })
                      : ''}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-sm text-gray-600 truncate w-4/5">
                    {convo.last_message || 'Nenhuma mensagem'}
                  </p>
                  {convo.unread_count > 0 && (
                    <span className="bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {convo.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 mt-4">
            <p>Nenhuma conversa encontrada.</p>
          </div>
        )}
      </div>
  )
}