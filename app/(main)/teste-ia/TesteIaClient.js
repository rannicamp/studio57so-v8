'use client';

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faUser, faSpinner, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import SparklesIcon from '@/components/shared/SparklesIcon';

export default function TesteIaClient({ organizacaoId }) {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      parts: [{ text: "Olá, seu lindo! Sou o Devonildo. Pode me perguntar qualquer coisa sobre os nossos empreendimentos, como 'Quais as unidades disponíveis no Braúnas?' ou 'Quem é o responsável técnico pelo Alfa?' que eu pesquiso no banco na mesma hora!" }]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', parts: [{ text: input }] };
    
    // O Gemini exige que o histórico comece SEMPRE com o role 'user'. 
    // Como a nossa mensagem 0 é um 'model' (boas vindas), nós simplesmente tiramos ela do array que vai pra API.
    const currentHistory = messages.filter((_, idx) => idx !== 0);
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/teste-agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.parts[0].text,
          history: currentHistory,
          organizacao_id: organizacaoId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar mensagem.');
      }

      setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
      
    } catch (error) {
      toast.error(error.message);
      // Remove a mensagem do usuário em caso de erro para ele tentar de novo
      setMessages(prev => prev.filter((_, idx) => idx !== prev.length - 1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      
      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg, index) => {
          const isModel = msg.role === 'model';
          return (
            <div key={index} className={`flex ${isModel ? 'justify-start' : 'justify-end'}`}>
              <div className={`flex max-w-[85%] gap-4 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
                
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${isModel ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {isModel ? (
                    <SparklesIcon className="w-5 h-5" active={true} colorOverride="#FFFFFF" />
                  ) : (
                    <FontAwesomeIcon icon={faUser} />
                  )}
                </div>

                {/* Balão de Mensagem */}
                <div className={`p-4 rounded-2xl shadow-sm whitespace-pre-wrap ${
                  isModel 
                    ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-none' 
                    : 'bg-blue-600 text-white rounded-tr-none'
                }`}>
                  {msg.parts[0].text}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-4 max-w-[85%]">
               <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <SparklesIcon className="w-5 h-5" active={true} colorOverride="#FFFFFF" />
               </div>
               <div className="p-4 rounded-2xl bg-white border border-gray-100 text-gray-500 rounded-tl-none flex items-center gap-3">
                  <FontAwesomeIcon icon={faDatabase} className="animate-pulse text-blue-500" />
                  <span className="text-sm font-medium">Lendo banco de dados e pensando...</span>
                  <FontAwesomeIcon icon={faSpinner} spin className="ml-2 text-gray-400" />
               </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Pergunte sobre um empreendimento ou unidade..." 
            className="flex-1 p-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 transition-shadow shadow-sm"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:bg-blue-400 shadow-md transition-colors"
          >
            <FontAwesomeIcon icon={faPaperPlane} size="lg" />
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          O agente usará ferramentas do banco de dados para responder suas perguntas.
        </p>
      </div>

    </div>
  );
}
