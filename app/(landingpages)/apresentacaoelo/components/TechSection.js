export default function TechSection() {
  
  const modulos = [
    {
      title: 'Administrativo',
      items: [
        { label: 'Painel de Controle', icon: <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" /> },
        { label: 'Financeiro & Conciliação', icon: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39h-2.05c-.11-.7-.59-1.58-1.96-1.58-1.4 0-2.04.8-2.04 1.58 0 .56.26 1.49 2.67 1.98 2.8.57 4.2 1.61 4.2 3.46 0 2.05-1.47 3.21-3.28 3.52z"/> },
        { label: 'Empresas (Multi-CNPJ)', icon: <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/> }, // Ícone de Prédio
        { label: 'Gestão de Contratos', icon: <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/> }, // Ícone de Documento
        { label: 'Recursos Humanos', icon: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/> },
      ]
    },
    {
      title: 'Comercial',
      items: [
        { label: 'CRM & Funil', icon: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm6 6H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/> },
        { label: 'Gestão de Leads', icon: <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/> },
        { label: 'Tabela de Vendas', icon: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/> },
        { label: 'Simulador de Financ.', icon: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 2h5v5h-5V5z"/> },
      ]
    },
    {
      title: 'Obra & Engenharia',
      items: [
        { label: 'Orçamento & Pedidos', icon: <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/> },
        { label: 'Diário de Obra (RDO)', icon: <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/> },
        { label: 'Almoxarifado', icon: <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/> },
        { label: 'Gestão de Atividades', icon: <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/> },
      ]
    },
    {
      title: 'BIM Manager',
      items: [
        { label: 'Visualizador 3D', icon: <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/> },
        { label: 'Colaboração Real-time', icon: <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/> },
      ]
    }
  ];

  return (
    <section className="snap-start h-screen flex flex-col justify-center py-10 bg-white px-6">
      <div className="max-w-7xl mx-auto w-full">
        
        {/* Cabeçalho da Seção */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-4xl md:text-5xl font-light mb-6 text-black tracking-tight">
            Um ecossistema <span className="font-bold">completo.</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto font-light leading-relaxed">
            Não é apenas um software. É a integração de todos os departamentos.
            <br className="hidden md:block" />
            <strong className="text-gray-700 font-medium">Arquitetura multi-empresas:</strong> preparado para gerenciar organizações com múltiplos CNPJs e empreendimentos simultâneos.
          </p>
        </div>

        {/* Grid de Módulos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modulos.map((modulo, index) => (
            <div 
              key={index} 
              className={`rounded-2xl p-6 border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full flex flex-col ${index === 3 ? 'bg-black text-white border-gray-800' : 'bg-white border-gray-100 hover:border-gray-200'}`}
            >
              {/* Título do Módulo */}
              <div className="flex items-center gap-3 mb-6 border-b border-opacity-20 border-current pb-4">
                <div className={`w-3 h-3 rounded-full ${index === 3 ? 'bg-[#FF6700]' : 'bg-gray-900'}`}></div>
                <h3 className="text-xl font-bold tracking-wide">{modulo.title}</h3>
              </div>

              {/* Lista de Itens */}
              <ul className="space-y-4 flex-grow">
                {modulo.items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 group">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${index === 3 ? 'bg-gray-800 group-hover:bg-[#FF6700] text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-[#FF6700] group-hover:text-white'}`}>
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        {item.icon}
                      </svg>
                    </div>
                    <span className={`text-sm font-medium leading-tight ${index === 3 ? 'text-gray-300' : 'text-gray-600'}`}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Footer do Card (Destaque BIM) */}
              {index === 3 && (
                <div className="mt-6 pt-4 border-t border-gray-800">
                  <span className="text-[#FF6700] text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#FF6700] rounded-full animate-pulse"></span>
                    Disponível Agora
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}