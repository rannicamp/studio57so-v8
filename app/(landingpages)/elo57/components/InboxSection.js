// Caminho: app/(landingpages)/elo57/components/InboxSection.js
'use client';

import { useState, useEffect } from 'react';

export default function InboxSection() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('whatsapp'); // 'whatsapp' ou 'email'

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section 
      id="inbox" 
      className="relative min-h-screen flex flex-col justify-center bg-white px-6 py-16 md:py-24 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto w-full relative z-10">
        
        {/* Cabeçalho da Seção */}
        <div className="mb-10 text-left">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-xs mb-3 block">
            Comunicação Unificada
          </span>
          <h2 className="text-3xl md:text-5xl font-light text-slate-900 tracking-tight leading-tight">
            Caixa de Entrada da sua <span className="font-bold text-slate-950">holding.</span>
          </h2>
        </div>

        {/* Bento Grid Principal */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Lado Esquerdo: Dois blocos empilhados verticalmente (E-mail e IA) */}
          <div className="lg:col-span-5 flex flex-col gap-6 justify-between">
            
            {/* Bloco 1: Cliente de E-mail Próprio */}
            <div 
              onClick={() => setActiveTab('email')}
              className={`border rounded-3xl p-6 md:p-8 flex flex-col justify-between transition-all duration-300 group shadow-sm flex-1 cursor-pointer ${
                activeTab === 'email' 
                  ? 'bg-slate-50 border-slate-950 ring-1 ring-slate-950' 
                  : 'bg-slate-50/60 border-slate-100 hover:border-slate-300'
              }`}
            >
              <div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 mb-6 ${
                  activeTab === 'email' ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-900 border-slate-200 group-hover:border-slate-900 group-hover:bg-slate-50'
                }`}>
                  <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xl font-bold text-slate-950 tracking-tight">
                    Cliente de E-mail Próprio
                  </h3>
                  {activeTab === 'email' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-950 text-white px-2 py-0.5 rounded-full">
                      Ativo na Tela
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-650 font-light leading-relaxed">
                  Conecte as contas de e-mail corporativas da sua empresa (ex: IMAP/SMTP/Hosting) usando o seu próprio domínio, como <span className="font-medium text-slate-850">contato@suaempresa.com.br</span>. Envie e responda e-mails de forma pessoal diretamente pela plataforma.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center gap-2 text-xs font-semibold text-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>
                Suporte a múltiplos domínios e alias corporativos
              </div>
            </div>

            {/* Bloco 2: WhatsApp API Oficial */}
            <div 
              onClick={() => setActiveTab('whatsapp')}
              className={`border rounded-3xl p-6 md:p-8 flex flex-col justify-between transition-all duration-300 group shadow-sm flex-1 cursor-pointer ${
                activeTab === 'whatsapp'
                  ? 'bg-emerald-50/40 border-emerald-600 ring-1 ring-emerald-600'
                  : 'bg-slate-50/60 border-slate-100 hover:border-emerald-300'
              }`}
            >
              <div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 mb-6 ${
                  activeTab === 'whatsapp' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-900 border-slate-200 group-hover:border-emerald-600 group-hover:bg-emerald-50/40'
                }`}>
                  <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-bold tracking-tight text-slate-950">
                    WhatsApp Meta API
                  </h3>
                  <span className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border ${
                    activeTab === 'whatsapp' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    Conexão Direta
                  </span>
                </div>
                <p className="text-sm text-slate-650 font-light leading-relaxed">
                  Nossa integração utiliza exclusivamente a API oficial de nuvem da Meta (Cloud API). Fornecemos todo o tutorial técnico e instruções guiadas para que sua holding obtenha e configure suas chaves oficiais da Meta, garantindo máxima estabilidade e segurança.
                </p>
              </div>
              <div className={`mt-6 pt-4 border-t flex items-center gap-2 text-xs font-semibold ${
                activeTab === 'whatsapp' ? 'border-emerald-100 text-slate-800' : 'border-slate-200/60 text-slate-800'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Conexão estável homologada pela Meta
              </div>
            </div>

          </div>

          {/* Lado Direito: Bloco 3 - Mockup de Laptop com Controle de Abas e Prints Reais */}
          <div className={`lg:col-span-7 flex flex-col justify-center transition-all duration-1000 ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            
            {/* Controles de Aba Superior (Monocromáticos e Clean) */}
            <div className="flex gap-2 mb-4 self-center lg:self-start bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === 'whatsapp'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>💬</span> WhatsApp CRM
              </button>
              <button
                onClick={() => setActiveTab('email')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === 'email'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>✉️</span> E-mail Corporativo
              </button>
            </div>

            {/* Laptop Mockup */}
            <div className="relative w-full max-w-[680px]">
              {/* Sombra de apoio inclinada */}
              <div className="absolute -bottom-6 -left-6 w-full h-[400px] bg-black/5 blur-xl rounded-2xl transform rotate-[1.5deg]"></div>

              {/* Corpo do Laptop */}
              <div className="relative w-full aspect-[16/10] bg-slate-950 rounded-t-2xl border-[8px] border-slate-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden group/laptop">
                {/* Câmera do Laptop */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                  <span className="w-1 h-1 bg-slate-700 rounded-full opacity-60"></span>
                </div>
                
                {/* Tela Real (Imagem de acordo com a aba selecionada) */}
                <div className="w-full h-full bg-slate-900 overflow-hidden relative cursor-pointer">
                  {/* Print WhatsApp */}
                  <img 
                    src="/prints/caixa_de_entrada_wa.png" 
                    alt="Caixa de Entrada WhatsApp Elo 57" 
                    className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500 ease-in-out ${
                      activeTab === 'whatsapp' ? 'opacity-100 pointer-events-auto scale-[1.001]' : 'opacity-0 pointer-events-none scale-95'
                    }`} 
                  />
                  {/* Print E-mail */}
                  <img 
                    src="/prints/caixa_de_entrada_email.png" 
                    alt="Caixa de Entrada E-mail Elo 57" 
                    className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500 ease-in-out ${
                      activeTab === 'email' ? 'opacity-100 pointer-events-auto scale-[1.001]' : 'opacity-0 pointer-events-none scale-95'
                    }`} 
                  />
                  
                  {/* Reflexo na tela */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none"></div>
                </div>
              </div>
              {/* Base do Laptop */}
              <div className="relative w-[106%] -left-[3%] h-4 bg-slate-700 rounded-b-2xl shadow-xl border-t border-slate-600 flex items-center justify-center">
                {/* Detalhe de abertura da tampa */}
                <div className="w-16 h-1.5 bg-slate-800 rounded-b-md"></div>
              </div>
              {/* Sombra de apoio */}
              <div className="w-[96%] mx-auto h-4 bg-black/20 blur-md rounded-full mt-0.5"></div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
