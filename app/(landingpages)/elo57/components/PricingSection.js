// Caminho: app/(landingpages)/elo57/components/PricingSection.js
'use client';

import { useState, useEffect } from 'react';

export default function PricingSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section 
      id="pricing" 
      className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white px-6 py-16 md:py-0 overflow-y-auto relative"
    >
      <div className="max-w-7xl mx-auto w-full relative z-10 py-8 md:py-0">
        
        {/* Cabeçalho da Seção */}
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-xs mb-3 block">
            Planos e Preços
          </span>
          <h2 className="text-3xl md:text-5xl font-light text-slate-900 tracking-tight leading-tight">
            Escolha o plano ideal para o seu <span className="font-bold text-slate-950">negócio.</span>
          </h2>
          <p className="text-slate-500 text-sm font-light leading-relaxed mt-4">
            Módulos integrados e cobrados por usuário ativo por mês. Adicione ou remova assentos conforme a sua equipe cresce.
          </p>
        </div>

        {/* Grade de Planos */}
        <div className="grid md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          
          {/* Plano 1: Elo Essencial */}
          <div className="bg-slate-50/50 border border-slate-150 rounded-3xl p-6 md:p-8 flex flex-col justify-between hover:border-slate-350 transition-all duration-300 shadow-sm relative group">
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Elo Essencial</h3>
                <p className="text-xs text-slate-450 font-light">Os recursos essenciais de uso comum da empresa</p>
              </div>

              {/* Preço */}
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-slate-400 text-xs font-bold">R$</span>
                <span className="text-4xl font-extrabold text-slate-950 tracking-tight">127</span>
                <span className="text-slate-400 text-xs font-semibold">/ usuário / mês</span>
              </div>

              {/* Recursos */}
              <div className="space-y-4 mb-8 border-t border-slate-200/60 pt-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Administrativo</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Financeiro" />
                    <PricingFeature text="Empresas" />
                    <PricingFeature text="Empreendimentos" />
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Comercial</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Contatos" />
                    <PricingFeature text="Simulador" />
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Obra</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Atividades" />
                  </ul>
                </div>
              </div>
            </div>

            <button className="w-full py-3 px-4 border border-slate-950 rounded-xl text-xs font-bold text-slate-950 hover:bg-slate-950 hover:text-white transition-all duration-300 shadow-sm mt-auto">
              Começar Agora
            </button>
          </div>

          {/* Plano 2: Elo Pro - RECOMENDADO E EM DESTAQUE */}
          <div className="bg-white border-2 border-slate-950 rounded-3xl p-6 md:p-8 flex flex-col justify-between hover:shadow-xl transition-all duration-300 shadow-md relative group/pro scale-[1.01] ring-4 ring-slate-100/50">
            {/* Badge Recomendado */}
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#f25a2f] text-white font-extrabold tracking-wider uppercase text-[10px] py-1.5 px-6 rounded-full shadow-md border border-white animate-pulse">
              Recomendado
            </span>

            <div>
              <div className="mb-6">
                <h3 className="text-xl font-extrabold text-slate-950 mb-1">Elo Pro</h3>
                <p className="text-xs text-slate-500 font-light">Gestão administrativa, financeira, comercial e obra integrada</p>
              </div>

              {/* Preço */}
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-slate-400 text-xs font-bold">R$</span>
                <span className="text-5xl font-black text-slate-950 tracking-tight">497</span>
                <span className="text-slate-400 text-xs font-semibold">/ usuário / mês</span>
              </div>

              {/* Recursos */}
              <div className="space-y-4 mb-8 border-t border-slate-950/10 pt-6">
                <div className="mb-4 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-950 uppercase tracking-tight">
                    Elo Essencial
                  </span>
                  <span className="text-[#f25a2f] text-base font-black font-sans leading-none">+</span>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-950 uppercase tracking-wider mb-2">Administrativo</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Recursos Humanos" bold />
                    <PricingFeature text="Contratos" />
                    <PricingFeature text="Relatórios" />
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-950 uppercase tracking-wider mb-2">Comercial</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Caixa de Entrada" bold />
                    <PricingFeature text="Funil de Vendas" bold />
                    <PricingFeature text="Tabela de Vendas" />
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-950 uppercase tracking-wider mb-2">Obra & BIM</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Pedidos de Compra" bold />
                    <PricingFeature text="Almoxarifado" />
                    <PricingFeature text="Diário de Obra" />
                    <PricingFeature text="BIM Manager 3D" bold />
                  </ul>
                </div>
              </div>
            </div>

            <button className="w-full py-3.5 px-4 bg-slate-950 rounded-xl text-xs font-bold text-white hover:bg-[#f25a2f] transition-all duration-300 shadow mt-auto">
              Assinar Elo Pro
            </button>
          </div>

          {/* Plano 3: Elo Ultra */}
          <div className="bg-slate-50/50 border border-slate-150 rounded-3xl p-6 md:p-8 flex flex-col justify-between hover:border-slate-350 transition-all duration-300 shadow-sm relative group">
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Elo Ultra</h3>
                <p className="text-xs text-slate-450 font-light">Módulos especializados e automação inteligente por IA</p>
              </div>

              {/* Preço */}
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-slate-400 text-xs font-bold">R$</span>
                <span className="text-4xl font-extrabold text-slate-950 tracking-tight">797</span>
                <span className="text-slate-400 text-xs font-semibold">/ usuário / mês</span>
              </div>

              {/* Recursos */}
              <div className="space-y-4 mb-8 border-t border-slate-200/60 pt-6">
                <div className="mb-4 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-950 uppercase tracking-tight">
                    Elo Pro
                  </span>
                  <span className="text-[#f25a2f] text-base font-black font-sans leading-none">+</span>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Administrativo</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Índices Financeiros" bold />
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Obra</h4>
                  <ul className="space-y-2">
                    <PricingFeature text="Orçamentação" bold />
                  </ul>
                </div>
              </div>
            </div>

            <button className="w-full py-3 px-4 border border-slate-950 rounded-xl text-xs font-bold text-slate-950 hover:bg-slate-950 hover:text-white transition-all duration-300 shadow-sm mt-auto">
              Falar com Consultor
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}

// Componente Auxiliar para itens da lista de preços
function PricingFeature({ text, bold = false }) {
  return (
    <li className="flex gap-2.5 items-center text-xs text-slate-600">
      <span className="shrink-0 text-slate-900 font-bold text-[11px]">
        ✓
      </span>
      <span className={`${bold ? 'font-bold text-slate-900' : 'font-light'}`}>{text}</span>
    </li>
  );
}
