// Caminho: app/(landingpages)/elo57/components/OrcamentoBimSection.js
'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faCalculator, faChartLine } from '@fortawesome/free-solid-svg-icons';

export default function OrcamentoBimSection() {
  return (
    <section 
      id="orcamentobim" 
      className="relative min-h-screen flex flex-col justify-center bg-white px-6 py-16 md:py-24 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Lado Esquerdo: Texto e Cards */}
        <div className="flex flex-col justify-center">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            Integração com Engenharia
          </span>
          <h2 className="text-4xl md:text-6xl font-light text-slate-900 mb-6 leading-tight tracking-tight">
            Modelo 3D integrado ao <span className="font-bold text-slate-950">orçamento.</span>
          </h2>
          <p className="text-lg text-slate-650 mb-8 font-light leading-relaxed">
            O BIM Manager 3D do Elo 57 permite visualizar e interagir com projetos estruturais complexos de forma nativa na web, direto no canteiro ou escritório, conectando elementos a subetapas e insumos.
          </p>

          {/* Cards de Benefícios */}
          <div className="grid gap-4">
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex gap-4 items-start hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faCube} />
              </div>
              <div>
                <h3 className="font-bold text-slate-950 mb-0.5 text-sm">Extração de Quantitativos</h3>
                <p className="text-xs text-slate-500 font-light leading-normal">
                  Extraia áreas, volumes e comprimentos do modelo 3D Revit (.rvt) ou IFC diretamente na web sem softwares pesados.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex gap-4 items-start hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faCalculator} />
              </div>
              <div>
                <h3 className="font-bold text-slate-950 mb-0.5 text-sm">Orçamento BIM 5D</h3>
                <p className="text-xs text-slate-500 font-light leading-normal">
                  Vincule peças 3D geométricas a subetapas e insumos de orçamento, calculando o custo total com precisão.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex gap-4 items-start hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <div>
                <h3 className="font-bold text-slate-950 mb-0.5 text-sm">Redução drástica de Licenças</h3>
                <p className="text-xs text-slate-500 font-light leading-normal">
                  Evite custos gigantescos com computadores potentes e licenças de softwares CAD/BIM para a equipe de orçamentos e canteiro.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Mockup do Visualizador BIM (Print Real) */}
        <div className="flex justify-center w-full">
          <div className="relative w-full max-w-[550px] px-2 md:px-0">
            {/* Mockup de Janela de Navegador */}
            <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden">
              {/* Barra do Navegador */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/85"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/85"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/85"></span>
                </div>
                {/* URL Mockup */}
                <div className="w-48 bg-slate-900 rounded px-2.5 py-0.5 text-[9px] text-slate-400 text-center truncate">
                  localhost:3000/bim-manager
                </div>
                <div className="w-6"></div>
              </div>
              
              {/* Imagem do BIM Manager */}
              <div className="w-full aspect-[16/10] bg-slate-950 relative overflow-hidden">
                <img 
                  src="/prints/bim_manager.png" 
                  alt="BIM Manager 3D Elo 57" 
                  className="w-full h-full object-cover object-center hover:scale-[1.03] transition-transform duration-700" 
                />
              </div>
            </div>
            {/* Sombras e Reflexos */}
            <div className="w-[96%] mx-auto h-4 bg-black/10 blur-md rounded-full mt-2"></div>
          </div>
        </div>

      </div>
    </section>
  );
}
