// Caminho: app/(landingpages)/elo57/components/PwaSection.js
'use client';

export default function PwaSection() {
  return (
    <section 
      id="mobile" 
      className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white overflow-hidden relative py-16 md:py-0"
    >
      <div className="max-w-7xl mx-auto px-6 w-full grid md:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Lado Esquerdo: Texto */}
        <div className="order-2 md:order-1">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            Mobilidade & Offline
          </span>
          <h2 className="text-4xl md:text-6xl font-light text-slate-900 mb-6 leading-tight tracking-tight">
            Conectado.<br/>
            Mesmo <span className="font-bold text-slate-950">desconectado.</span>
          </h2>
          <p className="text-lg text-slate-650 mb-10 font-light leading-relaxed">
            O canteiro de obras nem sempre tem boa conexão, mas o progresso da obra não pode parar. Com a tecnologia <strong>PWA (Progressive Web App)</strong>, a equipe de engenharia e os apontadores preenchem o diário de obras offline, e o sistema sincroniza tudo de forma automática assim que detectar sinal.
          </p>

          {/* Lista de Vantagens */}
          <div className="space-y-6">
            <FeatureItem 
              icon={<path d="M12 18.5l-2.5-3.5h5l-2.5 3.5zm0-15C6.48 3.5 2 7.98 2 13.5c0 1.96.57 3.81 1.57 5.41L2 22l3.09-1.57C6.69 21.43 8.54 22 10.5 22h3c5.52 0 10-4.48 10-10S19.02 3.5 13.5 3.5h-3z"/>} 
              title="Instalação Instantânea"
              desc="Adicione o Elo 57 à tela inicial do celular em um clique, sem passar pela App Store."
            />
            <FeatureItem 
              icon={<path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"/>} 
              title="Modo Offline Real"
              desc="Registre o RDO, ocorrências e suba fotos do canteiro mesmo no subsolo ou elevador."
            />
            <FeatureItem 
              icon={<path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>} 
              title="Experiência Nativa"
              desc="Acesso completo à câmera para registro fotográfico diário e envio de notificações push."
            />
          </div>
        </div>

        {/* Lado Direito: Mockup do Celular com Print Real do RDO */}
        <div className="order-1 md:order-2 flex justify-center">
          <div className="relative">
            {/* Sombra de apoio inclinada */}
            <div className="absolute -bottom-6 -left-6 w-72 h-[550px] bg-black/5 blur-xl rounded-[40px] transform rotate-[-4deg]"></div>

            {/* Container do Celular */}
            <div className="relative w-[280px] h-[550px] bg-slate-950 rounded-[44px] border-[8px] border-slate-900 shadow-2xl overflow-hidden transform rotate-[-4deg] hover:rotate-0 hover:scale-[1.02] transition-all duration-500 group/phone">
              
              {/* Notch superior do iPhone */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-b-xl z-20 flex items-center justify-center">
                <span className="w-10 h-1 bg-black rounded-full mb-1"></span>
              </div>
              
              {/* Tela do Celular */}
              <div className="w-full h-full bg-slate-900 flex flex-col relative overflow-hidden rounded-[36px]">
                {/* Imagem do RDO de Demonstração (Efeito scroll no hover) */}
                <div className="w-full h-full overflow-hidden cursor-ns-resize">
                  <img 
                    src="/prints/rdo_mobile.png"
                    alt="RDO no PWA Móvel Elo 57" 
                    className="w-full h-auto object-cover object-top translate-y-0 group-hover/phone:-translate-y-[calc(100%-534px)] transition-transform duration-[6000ms] ease-in-out" 
                  />
                </div>
                
                {/* Brilho na tela (Reflexo de vidro) */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none rounded-[36px]"></div>
              </div>

            </div>
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
      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-900 shrink-0 border border-slate-100 group-hover:border-slate-800 group-hover:bg-slate-50 transition-all duration-300">
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div>
        <h3 className="font-bold text-slate-900 group-hover:text-slate-950 transition-colors text-base">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-light">{desc}</p>
      </div>
    </div>
  );
}