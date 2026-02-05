'use client';

export default function PwaSection() {
  
  // Link da imagem do mockup (Atualizado)
  const MOBILE_IMAGE_URL = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/8/IMG_1770147600100.png"; 

  return (
    <section className="snap-start h-screen flex flex-col justify-center bg-gray-50 overflow-hidden relative">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-100 rounded-full blur-3xl opacity-40 -translate-x-1/2 translate-y-1/2"></div>

      <div className="max-w-7xl mx-auto px-6 w-full grid md:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Lado Esquerdo: Texto */}
        <div className="order-2 md:order-1">
          <span className="text-[#FF6700] font-bold tracking-widest uppercase text-sm mb-4 block">
          </span>
          <h2 className="text-4xl md:text-6xl font-light text-black mb-6 leading-tight tracking-tight">
            Conectado.<br/>
            Mesmo <span className="font-bold">desconectado.</span>
          </h2>
          <p className="text-xl text-gray-600 mb-10 font-light leading-relaxed">
            O canteiro de obras nem sempre tem o melhor sinal, mas a gestão não pode parar. 
            Com nossa tecnologia <strong>PWA (Progressive Web App)</strong>, você tem um aplicativo nativo que funciona offline e sincroniza assim que a conexão volta.
          </p>

          {/* Lista de Vantagens */}
          <div className="space-y-6">
            <FeatureItem 
              icon={<path d="M12 18.5l-2.5-3.5h5l-2.5 3.5zm0-15C6.48 3.5 2 7.98 2 13.5c0 1.96.57 3.81 1.57 5.41L2 22l3.09-1.57C6.69 21.43 8.54 22 10.5 22h3c5.52 0 10-4.48 10-10S19.02 3.5 13.5 3.5h-3z"/>} 
              title="Instalação Instantânea"
              desc="Sem burocracia de App Store. Adicione à tela inicial em 1 clique."
            />
            <FeatureItem 
              icon={<path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"/>} 
              title="Modo Offline Real"
              desc="Preencha o RDO no subsolo. O sistema guarda e envia depois."
            />
            <FeatureItem 
              icon={<path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>} 
              title="Experiência Nativa"
              desc="Acesso à câmera, arquivos e notificações como um app nativo."
            />
          </div>
        </div>

        {/* Lado Direito: Mockup do Celular */}
        <div className="order-1 md:order-2 flex justify-center">
          {/* Container do Celular */}
          <div className="relative w-[300px] h-[600px] bg-black rounded-[40px] border-[8px] border-gray-900 shadow-2xl overflow-hidden transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500">
            
            {/* Notch do iPhone (Detalhe estético) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-20 pointer-events-none"></div>
            
            {/* Tela do Celular */}
            <div className="w-full h-full bg-black flex flex-col relative">
              
              {/* Imagem do Usuário (Preenche tudo) */}
              <img 
                src={MOBILE_IMAGE_URL}
                alt="App Mobile Elo 57" 
                className="w-full h-full object-cover" 
              />
              
              {/* Brilho na tela (Reflexo de vidro) */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none rounded-[32px]"></div>
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
      <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-[#FF6700] shrink-0 border border-gray-100 group-hover:border-[#FF6700] transition-colors">
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div>
        <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#FF6700] transition-colors">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}