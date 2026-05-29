'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

function ChatRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const openChatId = searchParams.get('open_chat');
    const chatName = searchParams.get('chat_name');

    if (openChatId && chatName) {
      // Redireciona para o painel com as query strings da conversa
      router.replace(`/painel?open_chat=${openChatId}&chat_name=${encodeURIComponent(chatName)}`);
    } else {
      // Caso não tenha parâmetros de chat específico, apenas redireciona para o painel principal
      router.replace('/painel');
    }
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center max-w-sm w-full text-center">
        <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600 text-3xl mb-4" />
        <h3 className="text-gray-800 font-semibold text-base mb-1">Carregando conversa...</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          Estamos te levando diretamente para a sala de chat interno no painel. Só um instante, seu lindo!
        </p>
      </div>
    </div>
  );
}

export default function ChatRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400 text-sm gap-2">
        <FontAwesomeIcon icon={faSpinner} spin />
        <span>Carregando redirecionamento...</span>
      </div>
    }>
      <ChatRedirectContent />
    </Suspense>
  );
}
