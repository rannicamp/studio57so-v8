// Caminho: app/(landingpages)/elo57/components/StellaSection.js
'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble } from '@fortawesome/free-solid-svg-icons';

export default function StellaSection() {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);

  const fullConversation = [
    { type: 'bot', text: 'Olá! Vi que demonstrou interesse no Residencial Vista Parque. As unidades de 2 quartos começam em R$ 320 mil. Para te ajudar melhor, você busca para morar ou investir?' },
    { type: 'user', text: 'Busco para morar, mas preciso parcelar a entrada de 50 mil.' },
    { type: 'bot', text: 'Perfeito! Conseguimos montar um plano com entrada facilitada e parcelas mensais que cabem no seu orçamento. Que tal batermos um papo com nosso especialista financeiro amanhã às 14h?' },
    { type: 'user', text: 'Pode ser! Fico no aguardo.' },
    { type: 'bot', text: 'Agendado com sucesso! O corretor Felipe enviou o convite e vai te ligar amanhã. Posso te ajudar com mais alguma informação por enquanto?' }
  ];

  useEffect(() => {
    let currentIdx = 0;
    setMessages([fullConversation[0]]);

    const runChatSimulator = () => {
      if (currentIdx < fullConversation.length - 1) {
        currentIdx++;
        setTyping(true);
        setTimeout(() => {
          setTyping(false);
          setMessages(prev => [...prev, fullConversation[currentIdx]]);
        }, 2200);
      } else {
        setTimeout(() => {
          setMessages([fullConversation[0]]);
          currentIdx = 0;
        }, 6000);
      }
    };

    const interval = setInterval(runChatSimulator, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section 
      id="stella" 
      className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden relative"
    >
      <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Lado Esquerdo: Conteúdo */}
        <div>
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            Inteligência Artificial Comercial
          </span>
          <h2 className="text-4xl md:text-6xl font-light text-slate-900 mb-6 leading-tight tracking-tight">
            Stella IA: Seu SDR <span className="font-bold text-slate-950">24 horas.</span>
          </h2>
          <p className="text-lg text-slate-650 mb-8 font-light leading-relaxed max-w-xl">
            Nossa assistente virtual SDR conversa com seus leads de forma extremamente humana. Ela qualifica as necessidades BANT (Orçamento, Autoridade, Necessidade, Tempo) diretamente no WhatsApp e agenda visitas ou reuniões na agenda dos seus corretores.
          </p>
          
          <div className="flex gap-8 border-t border-slate-100 pt-8">
            <div>
              <p className="text-4xl font-bold text-slate-900 mb-1">24/7</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Disponibilidade</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-slate-900 mb-1">-40%</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Custo de Aquisição (CAC)</p>
            </div>
          </div>
        </div>

        {/* Lado Direito: Simulador de Chat do WhatsApp (Estilo Sóbrio) */}
        <div className="flex justify-center w-full">
          <div className="w-full max-w-md bg-slate-950 rounded-3xl p-4 shadow-2xl border border-slate-800 flex flex-col h-[450px]">
            
            {/* Header do WhatsApp Mockup */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-md relative">
                S
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full"></span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">Stella SDR 2.0</h4>
                <p className="text-[10px] text-green-400 font-medium">
                  {typing ? 'Digitando...' : 'Online'}
                </p>
              </div>
            </div>

            {/* Balões de Mensagem */}
            <div className="flex-grow space-y-3 overflow-y-auto pr-1 flex flex-col justify-end pb-2 scroll-smooth">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`text-xs p-3.5 rounded-2xl max-w-[85%] leading-relaxed shadow-sm transition-all duration-300 ${
                    msg.type === 'bot' 
                      ? 'bg-slate-800 text-slate-200 rounded-tl-none self-start' 
                      : 'bg-slate-200 text-slate-950 rounded-tr-none self-end'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span className="text-[9px] text-slate-400/80 block mt-1 text-right">
                    {msg.type === 'bot' ? 'Stella' : 'Cliente'}
                    {msg.type === 'user' && (
                      <FontAwesomeIcon icon={faCheckDouble} className="ml-1 text-slate-500" />
                    )}
                  </span>
                </div>
              ))}

              {/* Balão de Digitanto */}
              {typing && (
                <div className="bg-slate-800 text-slate-200 text-xs p-3.5 rounded-2xl rounded-tl-none max-w-[85%] self-start flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
