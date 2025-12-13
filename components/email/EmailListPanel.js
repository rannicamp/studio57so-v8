'use client';

import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faEnvelopeOpen, faEnvelope, faUserCircle, faCalendarAlt, faInbox } from '@fortawesome/free-solid-svg-icons';

// Função que chama a API que criamos no Passo 1
const fetchMessages = async (folderPath) => {
    if (!folderPath) return [];
    // Codifica a pasta para URL (ex: "Sent Items" vira "Sent%20Items")
    const res = await fetch(`/api/email/messages?folder=${encodeURIComponent(folderPath)}`);
    if (!res.ok) throw new Error('Erro ao carregar mensagens');
    const data = await res.json();
    return data.messages || [];
};

export default function EmailListPanel({ folder, onBack }) {
    
    const { data: messages = [], isLoading, isError } = useQuery({
        queryKey: ['emailMessages', folder?.path], // Recarrega se mudar a pasta
        queryFn: () => fetchMessages(folder?.path),
        enabled: !!folder,
        staleTime: 1000 * 60, // Cache de 1 minuto
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                <p>Buscando e-mails na Hostinger...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-400 p-6 text-center">
                <p>Não foi possível carregar os e-mails desta pasta.</p>
                <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">Voltar</button>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FontAwesomeIcon icon={faInbox} className="text-4xl mb-3 opacity-30" />
                <p>Esta pasta está vazia.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Cabeçalho da Pasta */}
            <div className="h-16 border-b flex items-center px-4 justify-between bg-gray-50 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-800">
                        ← Voltar
                    </button>
                    <h3 className="font-bold text-gray-700 text-lg">{folder.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {messages.length} msgs
                    </span>
                </div>
            </div>

            {/* Lista Scrollável */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-[#f0f2f5] p-2 space-y-2">
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className="bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-blue-200 group"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faUserCircle} className="text-gray-300 text-lg" />
                                <span className="font-semibold text-sm text-gray-800 truncate max-w-[200px]" title={msg.from}>
                                    {msg.from.replace(/<.*>/, '').trim()} {/* Limpa o <email> do nome */}
                                </span>
                            </div>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {new Date(msg.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                            </span>
                        </div>
                        
                        <div className="ml-7">
                            <p className={`text-sm text-gray-800 mb-1 ${!msg.flags.includes('\\Seen') ? 'font-bold' : ''}`}>
                                {msg.subject}
                            </p>
                            {/* Snippet virá na próxima versão (precisa baixar corpo) */}
                            <p className="text-xs text-gray-400 truncate">
                                Clique para ler o conteúdo da mensagem...
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}