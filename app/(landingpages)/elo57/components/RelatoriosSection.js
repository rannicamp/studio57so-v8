// Caminho: app/(landingpages)/elo57/components/RelatoriosSection.js
'use client';

import { useState, useEffect } from 'react';

export default function RelatoriosSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section 
      id="relatorios" 
      className="relative min-h-screen flex flex-col justify-center bg-slate-50 px-6 py-16 md:py-24 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto w-full grid md:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Lado Esquerdo: Textos e Features (5 colunas no desktop) */}
        <div className="md:col-span-5 flex flex-col justify-center">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            Resultados na Palma da Mão
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-slate-900 mb-6 tracking-tight leading-tight">
            Decisões baseadas<br/>
            em dados <span className="font-bold text-slate-950">reais.</span>
          </h2>
          <p className="text-sm text-slate-650 mb-8 font-light leading-relaxed">
            Não basta apenas preencher informações no canteiro ou no financeiro. Os dados precisam gerar inteligência estratégica. No Elo 57, a diretoria visualiza os resultados consolidados das 5 principais áreas da holding em tempo real:
          </p>

          {/* Recursos Analíticos - As 5 Abas */}
          <div className="space-y-4">
            <FeatureItem 
              icon={<path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>}
              title="Comercial & Marketing"
              desc="Funil de vendas/CRM integrado à Meta, monitorando conversões de leads, performance de corretores e SLAs de primeiro atendimento."
            />
            <FeatureItem 
              icon={<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>}
              title="RH & Gestão de Pessoas"
              desc="Custos de equipes ADM e obras, controle consolidado de ponto, índices de absenteísmo, motivos de faltas e taxa de turnover."
            />
            <FeatureItem 
              icon={<path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>}
              title="Relatório Financeiro"
              desc="Demonstrações de Fluxo de Caixa e DRE gerados automaticamente sob formatação de sinais (- para despesas, + para receitas) e importação de extratos."
            />
            <FeatureItem 
              icon={<path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>}
              title="Empreendimentos & Estoque"
              desc="Acompanhamento do VGV real de vendas contratadas, controle de estoques de lotes/prédios e análise de VSO físico e financeiro."
            />
            <FeatureItem 
              icon={<path d="M14.7 1.3c-.3-.3-.8-.3-1.1 0L1 13.9c-.3.3-.3.8 0 1.1L2.1 16c.3.3.8.3 1.1 0L16 3.4c.3-.3.3-.8 0-1.1L14.7 1.3z"/>}
              title="Controle de Obras"
              desc="Medições físicas integradas, acompanhamento de Diários de Obra (RDO) de canteiros e cálculo de desvios reais de custos vs. orçado em BIM."
            />
          </div>
        </div>

        {/* Lado Direito: Mockup do Laptop de Luxo com Print Real de Relatórios (7 colunas no desktop) */}
        <div className={`md:col-span-7 flex justify-center transition-all duration-1000 ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="relative w-full max-w-[640px] px-4 md:px-0">
            {/* Sombra de apoio inclinada */}
            <div className="absolute -bottom-6 -left-6 w-full h-[380px] bg-black/5 blur-xl rounded-2xl transform rotate-[2deg]"></div>

            {/* Corpo do Laptop */}
            <div className="relative w-full aspect-[16/10] bg-slate-950 rounded-t-2xl border-[8px] border-slate-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden group/laptop">
              {/* Câmera do Laptop */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                <span className="w-1 h-1 bg-slate-700 rounded-full opacity-60"></span>
              </div>
              
              {/* Tela Real (Imagem Relatórios) */}
              <div className="w-full h-full bg-slate-900 overflow-hidden relative cursor-pointer">
                <img 
                  src="/prints/relatorios.png" 
                  alt="Central de Relatórios Elo 57" 
                  className="w-full h-full object-cover object-top group-hover/laptop:scale-[1.03] transition-transform duration-700" 
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
    </section>
  );
}

// Componente auxiliar para os itens da lista
function FeatureItem({ icon, title, desc }) {
  return (
    <div className="flex gap-4 items-start group">
      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-800 shrink-0 border border-slate-200 group-hover:border-slate-850 group-hover:bg-slate-50 transition-all duration-300">
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div>
        <h3 className="font-bold text-slate-950 group-hover:text-slate-900 transition-colors text-xs">{title}</h3>
        <p className="text-[10px] text-slate-500 leading-relaxed font-light mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
