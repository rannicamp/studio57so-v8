// Caminho: app/(landingpages)/elo57/publicacoes/page.js
'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faDownload, faCheck, faChevronLeft, faChevronRight, 
  faSpinner, faCircle, faMobileAlt, faSquare, 
  faBuilding, faLaptop, faTools, faChevronDown, faChevronUp, faPlus
} from '@fortawesome/free-solid-svg-icons';
import { buscarPublicacoes, criarPublicacao } from '../actions';

export default function PublicacoesElo() {
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scale, setScale] = useState(0.4);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeCampaign, setActiveCampaign] = useState('elo57'); // 'elo57' | 'beta' | 'alfa'
  const [activeFormat, setActiveFormat] = useState('feed'); // 'feed' (1:1) | 'stories' (9:16)
  
  // Banco de Dados e Hub
  const [publicacoes, setPublicacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState({ elo57: true, beta: false, alfa: false });
  const [activePublicacaoId, setActivePublicacaoId] = useState(null);

  // Campanha e seus ícones
  const CAMPAIGN_INFO = {
    elo57: { name: 'Elo 57 (ERP)', icon: faLaptop, tagline: 'Versão Beta' },
    beta: { name: 'Beta Suítes', icon: faBuilding, tagline: 'Lançamento de Luxo' },
    alfa: { name: 'Residencial Alfa', icon: faTools, tagline: 'Acompanhamento de Obra' }
  };

  // Carrega publicações do banco de dados ao iniciar
  useEffect(() => {
    setMounted(true);
    
    async function loadData() {
      try {
        const data = await buscarPublicacoes();
        setPublicacoes(data);
        
        // Seleciona a primeira publicação do Elo 57 como ativa por padrão
        const firstElo = data.find(p => p.campanha === 'elo57');
        if (firstElo) {
          setActivePublicacaoId(firstElo.id);
        }
      } catch (err) {
        console.error("Erro ao carregar publicações do banco:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Atualiza escala baseado no formato e largura
  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const isFeed = activeFormat === 'feed';
      const targetW = 1080;
      const targetH = isFeed ? 1080 : 1920;

      const sidebarWidth = width > 1024 ? 300 : 0;
      const availableWidth = width - sidebarWidth - 64;
      const availableHeight = height - 180; // cabeçalhos/rodapés
      
      const scaleW = availableWidth / targetW;
      const scaleH = availableHeight / targetH;
      
      const calculatedScale = Math.min(scaleW, scaleH, 1.0);
      setScale(Math.max(0.18, calculatedScale));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [activeFormat, activeCampaign, activePublicacaoId]);

  // Alterna o colapso/expansão de uma campanha
  const toggleCampaignExpand = (campaignId) => {
    setExpandedCampaigns(prev => ({
      ...prev,
      [campaignId]: !prev[campaignId]
    }));
    setActiveCampaign(campaignId);
    
    // Seleciona a primeira publicação daquela campanha se houver
    const firstPub = publicacoes.find(p => p.campanha === campaignId);
    if (firstPub) {
      setActivePublicacaoId(firstPub.id);
      setCurrentSlide(0);
    }
  };

  // Cria uma nova publicação no banco para a campanha selecionada
  const handleAddPublicacao = async (campaignId) => {
    const titulo = prompt("Digite o título da nova publicação:");
    if (!titulo || !titulo.trim()) return;

    setLoading(true);
    try {
      // Slides padrão de semente/template
      const defaultSlides = campaignId === 'elo57' ? [
        {
          id: 1,
          tag: 'ACESSO ANTECIPADO · VERSÃO BETA',
          type: 'cover_elo57',
          title: titulo,
          description: 'Nova publicação cadastrada no sistema. Edite as informações.',
          localLabel: 'Local do Evento',
          localVal: 'Auditório da FIEMG',
          localSub: 'Governador Valadares · MG',
          dateLabel: 'Data e Horário dos Testes',
          dateVal: '19 de Agosto',
          dateSub: 'Quarta-feira às 19h'
        }
      ] : [
        {
          id: 1,
          tag: 'LANÇAMENTO EXCLUSIVO',
          type: 'real_estate',
          title: titulo,
          description: 'Nova publicação imobiliária cadastrada no sistema.',
          image: '/render_fachada.jpeg',
          brand: 'STUDIO 57 INCORPORADORA'
        }
      ];

      const newPub = await criarPublicacao(campaignId, titulo.trim(), defaultSlides);
      setPublicacoes(prev => [...prev, newPub]);
      setActivePublicacaoId(newPub.id);
      setCurrentSlide(0);
    } catch (err) {
      alert("Erro ao criar nova publicação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Recupera as publicações da campanha selecionada
  const activeCampaignPubs = publicacoes.filter(p => p.campanha === activeCampaign);
  
  // Encontra a publicação ativa ou fallback
  const activePublicacao = publicacoes.find(p => p.id === activePublicacaoId) 
    || publicacoes.find(p => p.campanha === activeCampaign)
    || null;

  const activeSlides = activePublicacao ? activePublicacao.slides_data : [];
  const active = activeSlides[currentSlide] || activeSlides[0] || {};

  const loadHtml2Canvas = () => {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) {
        resolve(window.html2canvas);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => resolve(window.html2canvas);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const html2canvas = await loadHtml2Canvas();
      const originalElement = document.getElementById('instagram-post');
      
      if (!originalElement) {
        throw new Error('Elemento da publicação não encontrado');
      }

      const clone = originalElement.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '-9999px';
      clone.style.zIndex = '-9999';
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0px';

      const navButtons = clone.querySelectorAll('.nav-btn');
      navButtons.forEach(btn => btn.remove());

      document.body.appendChild(clone);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvas(clone, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      document.body.removeChild(clone);
      
      const link = document.createElement('a');
      link.download = `criativo_${activeCampaign}_${activeFormat}_slide_${currentSlide + 1}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

    } catch (err) {
      console.error('Erro ao exportar a imagem:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    const originalSlide = currentSlide;
    try {
      const html2canvas = await loadHtml2Canvas();
      
      for (let i = 0; i < activeSlides.length; i++) {
        setCurrentSlide(i);
        await new Promise((resolve) => setTimeout(resolve, 350));
        
        const originalElement = document.getElementById('instagram-post');
        if (!originalElement) continue;

        const clone = originalElement.cloneNode(true);
        clone.style.transform = 'none';
        clone.style.position = 'fixed';
        clone.style.left = '-9999px';
        clone.style.top = '-9999px';
        clone.style.zIndex = '-9999';
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0px';

        const navButtons = clone.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => btn.remove());

        document.body.appendChild(clone);
        await new Promise((resolve) => setTimeout(resolve, 150));

        const canvas = await html2canvas(clone, {
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        document.body.removeChild(clone);

        const link = document.createElement('a');
        link.download = `criativo_${activeCampaign}_${activeFormat}_slide_${i + 1}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      }
    } catch (err) {
      console.error('Erro ao exportar todos os slides:', err);
    } finally {
      setCurrentSlide(originalSlide);
      setIsExporting(false);
    }
  };

  const nextSlide = () => {
    if (activeSlides.length > 0) {
      setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    }
  };

  const prevSlide = () => {
    if (activeSlides.length > 0) {
      setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
    }
  };

  const isFeed = activeFormat === 'feed';
  const widthPx = 1080;
  const heightPx = isFeed ? 1080 : 1920;

  return (
    <div className="bg-slate-100 font-sans min-h-screen flex flex-col lg:flex-row">
      
      {/* SIDEBAR DO HUB DE CRIAÇÃO (Fundo Branco - Identidade Oficial Studio 57) */}
      <aside className="w-full lg:w-[300px] bg-white border-r border-slate-200 flex flex-col justify-between flex-shrink-0 shadow-sm z-20">
        <div>
          {/* Logo / Header */}
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold tracking-wider text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-black inline-block"></span>
              STUDIO 57 HUB
            </h2>
            <p className="text-xs text-slate-500 font-light mt-1">Gerador de Publicações para Mídias</p>
          </div>

          {/* Seleção de Campanhas e Publicações */}
          <div className="p-6 space-y-6">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Campanhas e Publicações</h4>
            
            <div className="space-y-3">
              {Object.entries(CAMPAIGN_INFO).map(([key, campaign]) => {
                const isExpanded = expandedCampaigns[key];
                const campaignPubs = publicacoes.filter(p => p.campanha === key);

                return (
                  <div key={key} className="space-y-1">
                    {/* Botão Superior do Grupo da Campanha */}
                    <button
                      onClick={() => toggleCampaignExpand(key)}
                      className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-all border-none cursor-pointer text-slate-700 font-semibold hover:bg-slate-50 ${
                        activeCampaign === key ? 'bg-slate-100/70 text-black' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FontAwesomeIcon icon={campaign.icon} className="text-sm text-slate-400" />
                        <span className="text-sm font-bold">{campaign.name}</span>
                      </div>
                      <FontAwesomeIcon 
                        icon={isExpanded ? faChevronUp : faChevronDown} 
                        className="text-[10px] text-slate-400" 
                      />
                    </button>

                    {/* Sub-lista de Publicações (Só aparece se expandida) */}
                    {isExpanded && (
                      <div className="pl-4 border-l border-slate-100 space-y-1 animate-fadeIn mt-1">
                        {campaignPubs.map(pub => (
                          <button
                            key={pub.id}
                            onClick={() => {
                              setActivePublicacaoId(pub.id);
                              setCurrentSlide(0);
                            }}
                            className={`w-full text-left text-xs py-2 px-3 rounded-md transition-all border-none cursor-pointer block truncate ${
                              activePublicacaoId === pub.id
                                ? 'border-l-4 border-black bg-slate-100 text-black font-semibold'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            {pub.titulo}
                          </button>
                        ))}
                        
                        {/* Botão para criar nova publicação */}
                        <button
                          onClick={() => handleAddPublicacao(key)}
                          className="w-full text-left text-xs py-2 px-3 rounded-md border-dashed border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 mt-2 cursor-pointer bg-transparent"
                        >
                          <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                          Nova publicação
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seleção de Formatos */}
          <div className="p-6 border-t border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Formatos de Redes</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveFormat('feed')}
                className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all border cursor-pointer bg-white ${
                  isFeed 
                    ? 'border-black text-black font-bold bg-slate-50/50' 
                    : 'text-slate-500 border-slate-200 hover:text-slate-700'
                }`}
              >
                <FontAwesomeIcon icon={faSquare} className="text-base" />
                <span className="text-[10px] font-bold">Feed (1:1)</span>
              </button>

              <button
                onClick={() => setActiveFormat('stories')}
                className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all border cursor-pointer bg-white ${
                  !isFeed 
                    ? 'border-black text-black font-bold bg-slate-50/50' 
                    : 'text-slate-500 border-slate-200 hover:text-slate-700'
                }`}
              >
                <FontAwesomeIcon icon={faMobileAlt} className="text-base" />
                <span className="text-[10px] font-bold">Stories (9:16)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Informações Finais e Rodapé */}
        <div className="p-6 border-t border-slate-200 text-center">
          <p className="text-[10px] text-slate-400 font-mono">Conversão Conversacional e BIM</p>
          <p className="text-[10px] text-black font-bold mt-1">Versão 8.0</p>
        </div>
      </aside>

      {/* ÁREA DE PREVISÃO E TRABALHO */}
      <main className="flex-grow flex flex-col items-center justify-between p-6 overflow-hidden">
        {/* Cabeçalho da área de trabalho */}
        <div className="w-full max-w-[1080px] flex justify-between items-center mb-4">
          <a 
            href="/elo57" 
            className="text-xs md:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" /> Voltar para a Landing Page
          </a>
          
          <div className="flex gap-2">
            <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
              {CAMPAIGN_INFO[activeCampaign].name}
            </span>
            <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
              Slide {currentSlide + 1} de {activeSlides.length || 1}
            </span>
          </div>
        </div>

        {/* CONTAINER ESCALADO DO POST */}
        <div 
          className="relative flex items-center justify-center overflow-hidden bg-white shadow-2xl rounded-3xl border border-slate-200"
          style={{ 
            height: `${heightPx * scale}px`, 
            width: `${widthPx * scale}px`,
            transition: 'width 0.2s, height 0.2s'
          }}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <FontAwesomeIcon icon={faSpinner} spin className="text-slate-400 text-2xl" />
              <span className="text-slate-500 text-xs font-bold">Carregando criativo...</span>
            </div>
          ) : activeSlides.length === 0 ? (
            <div className="text-slate-400 text-center space-y-2 p-8">
              <p className="text-sm font-bold">Nenhuma publicação selecionada.</p>
              <p className="text-xs font-light">Crie uma nova publicação na barra lateral para começar.</p>
            </div>
          ) : (
            /* 
              CANVAS DO POST INSTAGRAM (1080px de largura x 1080px ou 1920px de altura)
            */
            <div 
              id="instagram-post" 
              className="bg-white flex flex-col justify-between p-20 text-center absolute select-none overflow-hidden"
              style={{
                width: `${widthPx}px`,
                height: `${heightPx}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                boxSizing: 'border-box',
              }}
            >


              {/* Topo do Post */}
              <div>
                <p className="text-[#f25a2f] text-[22px] font-bold tracking-[0.3em] uppercase">
                  {active.tag}
                </p>
              </div>

              {/* RENDERIZAÇÃO DE ACORDO COM O TIPO DE SLIDE */}
              {active.type === 'cover_elo57' ? (
                /* SLIDE 1 (CAPA DO EVENTO ELO 57) */
                <div className={`flex flex-col items-center justify-center my-auto w-full animate-fadeIn ${isFeed ? 'space-y-12' : 'space-y-24'}`}>
                  <div className={`${isFeed ? 'w-[540px]' : 'w-[680px]'}`}>
                    <img 
                      src="/marca/logo-elo57-horizontal.svg" 
                      alt="Elo 57" 
                      className="w-full h-auto object-contain mx-auto" 
                    />
                  </div>

                  <div className={`${isFeed ? 'w-[540px]' : 'w-[740px]'} mx-auto space-y-8 flex flex-col items-center`}>
                    <div className="w-full border-t border-[#FF6700]" />

                    <div className="space-y-4 w-full">
                      <h2 className={`text-slate-900 font-light tracking-[0.12em] uppercase leading-snug ${isFeed ? 'text-[38px]' : 'text-[46px]'}`}>
                        {active.title}
                      </h2>
                      <p className={`text-slate-500 font-light tracking-[0.05em] leading-relaxed text-center w-full ${isFeed ? 'text-[18px]' : 'text-[24px]'}`}>
                        {active.description}
                      </p>
                    </div>
                  </div>
                </div>
              ) : active.type === 'product_elo57' ? (
                /* SLIDES 2, 3, 4 (MOCKUPS DO PRODUTO ELO 57) */
                <div className={`flex flex-col items-center justify-center my-auto w-full animate-fadeIn ${isFeed ? 'space-y-8' : 'space-y-16'}`}>
                  {/* Título e Descrição */}
                  <div className={`${isFeed ? 'w-[780px]' : 'w-[880px]'} mx-auto space-y-3 flex flex-col items-center`}>
                    <h2 className={`text-slate-900 font-light tracking-[0.1em] uppercase ${isFeed ? 'text-[32px]' : 'text-[42px]'}`}>
                      {active.title}
                    </h2>
                    <div className="w-[120px] border-t border-[#FF6700]" />
                    <p className={`text-slate-500 font-light leading-relaxed text-center w-full ${isFeed ? 'text-[18px]' : 'text-[24px]'}`}>
                      {active.description}
                    </p>
                  </div>

                  {/* Mockup de Tela */}
                  <div className="w-full">
                    {active.isMobile ? (
                      /* Mockup Mobile (Celular RDO) */
                      <div className={`mx-auto bg-slate-900 rounded-[40px] p-3 border-[4px] border-slate-800 shadow-xl flex flex-col relative overflow-hidden ${
                        isFeed ? 'w-[260px] h-[480px]' : 'w-[320px] h-[640px]'
                      }`}>
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-800 rounded-full z-20 flex items-center justify-center">
                          <div className="w-12 h-1 bg-slate-700 rounded-full" />
                        </div>
                        <div className="flex-grow rounded-[32px] overflow-hidden bg-white relative border border-slate-750">
                          <img src={active.image} alt={active.title} className="w-full h-full object-cover object-top" />
                        </div>
                      </div>
                    ) : (
                      /* Mockup Desktop (Navegador Relatórios/BIM) */
                      <div className={`mx-auto bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-xl ${
                        isFeed ? 'w-[760px] h-[420px]' : 'w-[880px] h-[500px]'
                      }`}>
                        <div className="h-8 bg-slate-100 flex items-center px-4 gap-1.5 border-b border-slate-200">
                          <div className="w-3 h-3 rounded-full bg-rose-400" />
                          <div className="w-3 h-3 rounded-full bg-amber-400" />
                          <div className="w-3 h-3 rounded-full bg-emerald-400" />
                          <div className="h-5 bg-white border border-slate-200 rounded-md flex-grow mx-6 text-[10px] text-slate-400 flex items-center px-3 font-mono">
                            {active.browserUrl}
                          </div>
                        </div>
                        <div className="flex-grow bg-white overflow-hidden relative">
                          <img src={active.image} alt={active.title} className="w-full h-full object-cover object-top" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* LAYOUT EDITORIAL LUXO / REAL ESTATE (BETA SUÍTES / ALFA) */
                <div className="flex flex-col h-full w-full justify-between items-center -mx-20 -my-20">
                  {/* Imagem (Parte Superior) */}
                  <div 
                    className="w-full overflow-hidden relative"
                    style={{
                      height: isFeed ? '560px' : '1080px'
                    }}
                  >
                    <img 
                      src={active.image} 
                      alt={active.title} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
                  </div>

                  {/* Bloco de Texto (Parte Inferior) */}
                  <div 
                    className="w-full bg-white flex flex-col justify-center text-center px-20 border-t border-slate-100"
                    style={{
                      height: isFeed ? '380px' : '700px'
                    }}
                  >
                    <p className="text-[#f25a2f] text-[16px] font-bold tracking-[0.25em] uppercase mb-4">
                      {active.tag}
                    </p>
                    
                    <h2 className={`text-slate-900 font-light tracking-[0.08em] uppercase ${isFeed ? 'text-[36px] mb-4' : 'text-[46px] mb-6'}`}>
                      {active.title}
                    </h2>
                    
                    <div className="w-[120px] border-t border-[#FF6700] mx-auto mb-6" />
                    
                    <p className={`text-slate-500 font-light leading-relaxed max-w-[760px] mx-auto ${isFeed ? 'text-[18px]' : 'text-[24px]'}`}>
                      {active.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Rodapé do Post (Comum a todos) */}
              {active.type === 'cover_elo57' ? (
                <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-end text-left w-full border-t border-slate-100 pt-6 bg-white z-10">
                  <div className="space-y-2">
                    <p className="text-slate-400 text-[15px] font-semibold uppercase tracking-widest">
                      {active.localLabel}
                    </p>
                    <h1 className="text-slate-900 text-[30px] font-semibold tracking-tight leading-none uppercase">
                      {active.localVal}
                    </h1>
                    <p className="text-slate-500 text-[18px] font-light tracking-[0.02em]">
                      {active.localSub}
                    </p>
                  </div>
                  
                  {/* Pontinhos do Carrossel */}
                  <div className="flex gap-2 self-end mb-2">
                    {activeSlides.map((_, i) => (
                      <FontAwesomeIcon 
                        key={i} 
                        icon={faCircle} 
                        className={`text-[8px] transition-all ${
                          i === currentSlide ? 'text-[#f25a2f] scale-125' : 'text-slate-200'
                        }`} 
                      />
                    ))}
                  </div>
                  
                  <div className="text-right space-y-1">
                    <p className="text-slate-400 text-[15px] font-semibold uppercase tracking-widest">
                      {active.dateLabel}
                    </p>
                    <p className="text-[#f25a2f] text-[40px] font-semibold tracking-tight leading-none uppercase">
                      {active.dateVal}
                    </p>
                    <p className="text-slate-500 text-[18px] font-light">
                      {active.dateSub}
                    </p>
                  </div>
                </div>
              ) : (
                /* Indicador de carrossel para slides internos */
                <div className="flex justify-between items-center w-full border-t border-slate-150 pt-6 bg-white z-10 px-2">
                  <div className="text-left">
                    <span className="text-[12px] uppercase tracking-widest text-[#f25a2f] font-bold">
                      {activeCampaign === 'elo57' ? 'Conecte Sua Construtora' : 'Studio 57 Incorporadora'}
                    </span>
                    <p className="text-[15px] text-slate-400 font-light mt-0.5">
                      {activeCampaign === 'elo57' ? 'elo57.com.br' : 'studio57.com.br'}
                    </p>
                  </div>
                  
                  {/* Pontinhos do Carrossel */}
                  <div className="flex gap-2">
                    {activeSlides.map((_, i) => (
                      <FontAwesomeIcon 
                        key={i} 
                        icon={faCircle} 
                        className={`text-[8px] transition-all ${
                          i === currentSlide ? 'text-[#f25a2f] scale-125' : 'text-slate-200'
                        }`} 
                      />
                    ))}
                  </div>

                  <div className="text-right">
                    <span className="text-[12px] uppercase tracking-widest text-slate-400 font-bold">
                      {activeCampaign === 'elo57' ? 'Plataforma ERP 5D' : active.brand || 'Studio 57'}
                    </span>
                    <p className="text-[15px] text-[#f25a2f] font-bold mt-0.5">
                      {activeCampaign === 'elo57' ? 'Versão Beta' : 'Lançamento'}
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Botões de Navegação colocados fora do post, mas no mesmo wrapper */}
          {!loading && activeSlides.length > 0 && (
            <>
              <button 
                onClick={prevSlide}
                className="nav-btn absolute left-4 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all z-50 border-none cursor-pointer"
                aria-label="Anterior"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>

              <button 
                onClick={nextSlide}
                className="nav-btn absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all z-50 border-none cursor-pointer"
                aria-label="Próximo"
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </>
          )}
        </div>

        {/* BARRA DE BOTÕES INFERIOR */}
        <div className="max-w-[1080px] w-full mt-6 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 z-10">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FontAwesomeIcon icon={faCheck} className="text-green-500" />
              Publicação Selecionada: {activePublicacao ? activePublicacao.titulo : 'Nenhuma'}
            </h4>
            <p className="text-xs text-slate-500 font-light mt-0.5">
              Tamanho do Canvas: <span className="font-mono text-slate-700 font-bold">{widthPx}x{heightPx}px</span>.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3 w-full md:w-auto">
            {/* Navegação Manual */}
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <button 
                onClick={prevSlide}
                className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-600 border-none cursor-pointer text-xs md:text-sm font-bold"
              >
                Anterior
              </button>
              <div className="px-3 bg-slate-50 text-slate-500 text-xs font-bold border-l border-r border-slate-200 h-full flex items-center">
                {currentSlide + 1} / {activeSlides.length || 1}
              </div>
              <button 
                onClick={nextSlide}
                className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-600 border-none cursor-pointer text-xs md:text-sm font-bold"
              >
                Próximo
              </button>
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting || activeSlides.length === 0}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-300 text-slate-700 text-xs md:text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer border-none flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Processando...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faDownload} className="text-slate-500" /> Exportar Slide Atual
                </>
              )}
            </button>

            <button
              onClick={handleExportAll}
              disabled={isExporting || activeSlides.length === 0}
              className="px-6 py-3 bg-[#f25a2f] hover:bg-[#e04f25] disabled:bg-slate-300 text-white text-xs md:text-sm font-bold rounded-xl transition-all shadow-md cursor-pointer border-none flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Exportando...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faDownload} /> Exportar Todos os Slides
                </>
              )}
            </button>
          </div>
        </div>
      </main>

    </div>
  );
}
