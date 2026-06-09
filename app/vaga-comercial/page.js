// Caminho: app/vaga-comercial/page.js
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Montserrat, Roboto } from 'next/font/google';
import { useDebounce } from 'use-debounce';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

// Padrão de bolinhas cinzas (Dot Pattern)
const DotPattern = ({ className }) => (
  <div className={`grid grid-cols-6 gap-3 ${className}`}>
    {[...Array(24)].map((_, i) => (
      <div key={i} className="w-2.5 h-2.5 bg-neutral-900/10 rounded-full"></div>
    ))}
  </div>
);

export default function VagaComercialPage() {
  const [visualizacaoReal, setVisualizacaoReal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // ESTADOS DE CALIBRAÇÃO MANUAL DA IMAGEM (Sliders de enquadramento)
  const [posX, setPosX] = useState(15);
  const [posY, setPosY] = useState(50);
  const [zoom, setZoom] = useState(100);
  const [espelhar, setEspelhar] = useState(true);

  // DEBOUNCE DOS ESTADOS PARA SALVAR NO LOCALSTORAGE (1000ms conforme regras do projeto)
  const [debouncedPosX] = useDebounce(posX, 1000);
  const [debouncedPosY] = useDebounce(posY, 1000);
  const [debouncedZoom] = useDebounce(zoom, 1000);
  const [debouncedEspelhar] = useDebounce(espelhar, 1000);

  // Referência para controlar o carregamento inicial e evitar loops de sobrescrita no cache
  const inicializadoRef = useRef(false);

  // Link do WhatsApp com mensagem personalizada para a vaga
  const linkWhats = "https://wa.me/5533998192119?text=Oi%2C%20segue%20meu%20curr%C3%ADculo%20para%20a%20vaga%20de%20Assistente%20Comercial%20e%20Vendas.";

  // 1. RESTAURAÇÃO DOS VALORES SALVOS NO LOCALSTORAGE AO INICIAR
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPosX = localStorage.getItem('stories_vaga_posX');
        const savedPosY = localStorage.getItem('stories_vaga_posY');
        const savedZoom = localStorage.getItem('stories_vaga_zoom');
        const savedEspelhar = localStorage.getItem('stories_vaga_espelhar');

        if (savedPosX !== null) setPosX(parseInt(savedPosX));
        if (savedPosY !== null) setPosY(parseInt(savedPosY));
        if (savedZoom !== null) setZoom(parseInt(savedZoom));
        if (savedEspelhar !== null) setEspelhar(savedEspelhar === 'true');
      } catch (error) {
        console.error('Erro ao ler dados do localStorage:', error);
      } finally {
        inicializadoRef.current = true;
      }
    }
  }, []);

  // 2. GRAVAÇÃO NO LOCALSTORAGE COM DEBOUNCE (Evita escritas excessivas enquanto arrasta os sliders)
  useEffect(() => {
    if (inicializadoRef.current && typeof window !== 'undefined') {
      try {
        localStorage.setItem('stories_vaga_posX', debouncedPosX.toString());
        localStorage.setItem('stories_vaga_posY', debouncedPosY.toString());
        localStorage.setItem('stories_vaga_zoom', debouncedZoom.toString());
        localStorage.setItem('stories_vaga_espelhar', debouncedEspelhar.toString());
      } catch (error) {
        console.error('Erro ao salvar dados no localStorage:', error);
      }
    }
  }, [debouncedPosX, debouncedPosY, debouncedZoom, debouncedEspelhar]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        setVisualizacaoReal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // FUNÇÃO PARA COPIAR O LINK DO WHATSAPP
  const handleCopiarLink = () => {
    navigator.clipboard.writeText(linkWhats);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // FUNÇÃO PARA EXPORTAR COMO JPG USANDO HTML2CANVAS (ALTA DEFINIÇÃO + CLONE OCULTO CONECTADO NO DOM)
  const handleExportarJPG = async () => {
    if (exportando) return;
    setExportando(true);

    try {
      // 1. Carrega a biblioteca html2canvas via CDN se não estiver carregada
      if (!window.html2canvas) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.async = true;
        document.head.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // 2. Aguarda o carregamento das fontes do Next.js/Google Fonts
      if (document.fonts) {
        await document.fonts.ready;
      }

      // 3. Força temporariamente a visualização em tamanho real (1080x1920) no DOM do React
      const visualizacaoOriginal = visualizacaoReal;
      if (!visualizacaoOriginal) {
        setVisualizacaoReal(true);
        // Espera de 250ms para garantir que o Next.js renderize as fontes e paddings do tamanho real de Stories
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      // 4. Seleciona a div original
      const sourceElement = document.getElementById('stories-anuncio');
      if (sourceElement) {
        // 5. Cria um contêiner wrapper invisível fora da tela
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = '-99999px';
        wrapper.style.left = '-99999px';
        wrapper.style.width = '1080px';
        wrapper.style.height = '1920px';
        wrapper.style.overflow = 'hidden';
        document.body.appendChild(wrapper);

        // 6. Clona a div do Stories
        const clone = sourceElement.cloneNode(true);
        
        // Remove ID para não duplicar no DOM
        clone.removeAttribute('id');

        // 7. Força os estilos exatos de Stories real no clone para evitar heranças de tela
        clone.style.width = '1080px';
        clone.style.height = '1920px';
        clone.style.borderRadius = '0px';
        clone.style.boxShadow = 'none';
        clone.style.border = 'none';
        clone.style.margin = '0';
        clone.style.transform = 'none';
        clone.style.position = 'relative';
        clone.style.display = 'flex';
        clone.style.overflow = 'hidden';
        clone.style.transition = 'none';

        wrapper.appendChild(clone);

        // Pequena espera adicional de 100ms no DOM invisível antes do print
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 8. Renderiza o clone usando html2canvas com escala 2x para Altíssima Resolução (2160x3840px)
        const canvas = await window.html2canvas(clone, {
          useCORS: true,
          allowTaint: false,
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          width: 1080,
          height: 1920
        });

        // 9. Converte o canvas para JPG de alta qualidade
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        // 10. Executa o download da imagem final
        const link = document.createElement('a');
        link.download = 'stories_vaga_comercial.jpg';
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 11. Limpa o wrapper temporário do DOM
        document.body.removeChild(wrapper);
      }

      // 12. Restaura o modo de visualização anterior
      if (!visualizacaoOriginal) {
        setVisualizacaoReal(false);
      }
    } catch (error) {
      console.error('Erro ao exportar com html2canvas:', error);
      alert('Ocorreu uma falha na conversão de imagem. Se persistir, você pode usar a captura manual do navegador (Instruções no Walkthrough).');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className={`${roboto.className} bg-neutral-950 min-h-screen w-full flex flex-col items-center justify-start py-6 select-none`}>
      
      {/* ========================================= */}
      {/* PAINEL DE CONTROLE INTERATIVO (Oculto no Print) */}
      {/* ========================================= */}
      <div className="w-full max-w-2xl mb-6 bg-neutral-900 text-white rounded-3xl p-6 flex flex-col gap-6 shadow-2xl border border-neutral-800 z-20 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-amber-500 font-bold uppercase tracking-wider">Painel de Ajuste Manual</span>
            <span className="text-lg font-bold mt-0.5">Ajuste o Enquadramento do Stories</span>
          </div>
          
          <div className="flex gap-2 shrink-0">
            {/* BOTÃO EXPORTAR JPG */}
            <button
              onClick={handleExportarJPG}
              disabled={exportando}
              className={`bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 ${
                exportando ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {exportando ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exportando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Exportar JPG
                </>
              )}
            </button>

            {/* BOTÃO REDIMENSIONAR TELA */}
            <button
              onClick={() => setVisualizacaoReal(!visualizacaoReal)}
              className="bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl transition-all shadow-md active:scale-95"
            >
              {visualizacaoReal ? "Ajustar à Tela" : "Ver Tamanho Real"}
            </button>
          </div>
        </div>

        {/* Sliders de Ajuste da Imagem */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          
          {/* Ajuste X (Horizontal) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-semibold">
              <label htmlFor="range-pos-x">Horizontal (X)</label>
              <span className="text-amber-500">{posX}%</span>
            </div>
            <input 
              id="range-pos-x"
              type="range" 
              min="0" 
              max="100" 
              value={posX} 
              onChange={(e) => setPosX(parseInt(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Ajuste Y (Vertical) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-semibold">
              <label htmlFor="range-pos-y">Vertical (Y)</label>
              <span className="text-amber-500">{posY}%</span>
            </div>
            <input 
              id="range-pos-y"
              type="range" 
              min="0" 
              max="100" 
              value={posY} 
              onChange={(e) => setPosY(parseInt(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Ajuste Zoom */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-semibold">
              <label htmlFor="range-zoom">Zoom da Foto</label>
              <span className="text-amber-500">{zoom}%</span>
            </div>
            <input 
              id="range-zoom"
              type="range" 
              min="100" 
              max="200" 
              value={zoom} 
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

        </div>

        {/* Checkbox Espelhamento */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
          <div className="flex items-center gap-3">
            <input 
              id="checkbox-espelhar"
              type="checkbox" 
              checked={espelhar}
              onChange={(e) => setEspelhar(e.target.checked)}
              className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500 bg-neutral-800 border-neutral-700 cursor-pointer"
            />
            <label htmlFor="checkbox-espelhar" className="font-semibold cursor-pointer">Espelhar Foto Lateralmente (Flip Horizontal)</label>
          </div>
          <span className="text-xs text-neutral-500">Dica: Tecle "R" para alternar o tamanho real</span>
        </div>

        {/* COPIADOR DE LINK DO WHATSAPP (IDEAL PARA O STICKER DO INSTAGRAM) */}
        <div className="flex flex-col gap-3 pt-4 border-t border-neutral-800">
          <div className="flex flex-col">
            <span className="text-xs text-amber-500 font-bold uppercase tracking-wider">Link para Sticker de Link do Instagram</span>
            <span className="text-xs text-neutral-400 mt-0.5">Use o link abaixo na figurinha "Link" nos Stories do Instagram do Studio 57</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 items-center bg-neutral-950 p-3 rounded-2xl border border-neutral-800 w-full">
            <input 
              type="text" 
              readOnly 
              value={linkWhats}
              className="bg-transparent border-none text-xs text-neutral-300 w-full focus:outline-none focus:ring-0 overflow-x-auto font-mono py-1 select-all"
            />
            <button
              onClick={handleCopiarLink}
              className={`w-full sm:w-auto shrink-0 font-bold text-xs uppercase tracking-wider py-2 px-4 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${
                copiado ? 'bg-amber-500 text-neutral-950 font-extrabold' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
            >
              {copiado ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 10h5m-5 4h3"></path>
                  </svg>
                  Copiar Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CONTAINER DO ANÚNCIO (ESTILO EDITORIAL - COLUNA ESQUERDA INTEGRADA) */}
      <div 
        id="stories-anuncio"
        className={`relative bg-white text-neutral-950 flex overflow-hidden shadow-2xl transition-all duration-300 ${
          visualizacaoReal 
            ? 'w-[1080px] h-[1920px] rounded-none p-24 border border-neutral-200' 
            : 'h-[85vh] aspect-[9/16] rounded-none p-10 md:p-14 border border-neutral-200/50'
        }`}
        style={!visualizacaoReal ? { maxHeight: '900px' } : {}}
      >
        
        {/* Imagem de Fundo Calibrada Manualmente (Estrutura em div para alta fidelidade no html2canvas) */}
        <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: "url('/vaga-bg.png')",
              backgroundSize: 'cover',
              backgroundPosition: `${posX}% ${posY}%`,
              transform: `scale(${zoom / 100}) ${espelhar ? 'scaleX(-1)' : 'scaleX(1)'}`,
              transition: 'object-position 0.1s ease, transform 0.1s ease',
              width: '100%',
              height: '100%'
            }}
          />
        </div>
        
        {/* DEGRADÊ HORIZONTAL DA ESQUERDA PARA A DIREITA (Estilo inline nativo para suporte garantido no html2canvas) */}
        <div 
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.95) 45%, rgba(255, 255, 255, 0.8) 60%, rgba(255, 255, 255, 0) 100%)'
          }}
        />
        <div 
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.85) 55%, rgba(255, 255, 255, 0) 100%)'
          }}
        />

        {/* GRAFISMOS DE BOLINHAS CINZAS */}
        <DotPattern className={`absolute top-12 left-12 z-0 ${visualizacaoReal ? 'scale-150 transform origin-top-left' : 'scale-90'}`} />
        <DotPattern className={`absolute bottom-12 left-[30%] z-0 ${visualizacaoReal ? 'scale-150 transform origin-bottom-left' : 'scale-90'}`} />
        
        {/* ========================================= */}
        {/* COLUNA ESQUERDA INTEGRADA (LOGO + CONTEÚDO + RODAPÉ) */}
        {/* ========================================= */}
        <div className="flex flex-col justify-between h-full w-[63%] text-left z-20">
          
          {/* HEADER: LOGOTIPO DO STUDIO 57 LOCAL */}
          <div className={`relative flex justify-start w-full ${visualizacaoReal ? 'h-32 mb-6' : 'h-16 mb-2'}`}>
            <img 
              src="/logo-studio57.png" 
              alt="Logo Studio 57" 
              className="object-contain h-full object-left"
            />
          </div>

          {/* CONTEÚDO CENTRAL */}
          <div className="flex-grow flex flex-col justify-center py-6">
            
            {/* Chamada Vaga */}
            <h1 className={`${montserrat.className} font-bold uppercase tracking-[0.25em] text-neutral-500 leading-none ${
              visualizacaoReal ? 'text-5xl mb-6' : 'text-lg mb-3'
            }`}>
              Estamos Selecionando
            </h1>
            
            {/* Nome do Cargo */}
            <h2 className={`${montserrat.className} font-black uppercase tracking-wider text-black mt-1 mb-6 leading-[1.15] ${
              visualizacaoReal ? 'text-7.5xl' : 'text-3.5xl'
            }`}>
              Assistente<br/>
              <span className="text-neutral-900 font-extrabold block mt-1">Comercial e Vendas</span>
            </h2>

            {/* Divisor Minimalista */}
            <div className={`bg-neutral-900/10 rounded-full ${
              visualizacaoReal ? 'w-24 h-[3px] my-6' : 'w-12 h-0.5 my-3'
            }`}></div>

            {/* Resumo da Vaga */}
            <p className={`font-medium text-neutral-600 max-w-lg leading-relaxed ${
              visualizacaoReal ? 'text-2xl mb-10' : 'text-[11px] mb-5'
            }`}>
              Seja o braço direito na organização de eventos, suporte comercial, marketing, gravação de vídeos e uso diário de inteligência artificial no <strong>Studio 57</strong>.
            </p>

            {/* SEÇÕES COM PÍLULAS CINZAS */}
            <div className="w-full flex flex-col items-start space-y-6">
              
              {/* Atribuições */}
              <div className="flex flex-col items-start w-full">
                <span className={`${montserrat.className} bg-neutral-200/90 text-neutral-800 font-bold rounded-full uppercase tracking-wider ${
                  visualizacaoReal ? 'px-8 py-2.5 text-lg mb-3' : 'px-4 py-1 text-[9px] mb-1.5'
                }`}>
                  Atribuições
                </span>
                <p className={`font-bold text-neutral-800 tracking-wide leading-relaxed uppercase ${
                  visualizacaoReal ? 'text-xl max-w-md' : 'text-[9px] max-w-xs'
                }`}>
                  ATENDIMENTO, MARKETING, CAPTAÇÃO DE VÍDEOS, EVENTOS E USO DE INTELIGÊNCIA ARTIFICIAL.
                </p>
              </div>

              {/* Remuneração */}
              <div className="flex flex-col items-start w-full">
                <span className={`${montserrat.className} bg-neutral-200/90 text-neutral-800 font-bold rounded-full uppercase tracking-wider ${
                  visualizacaoReal ? 'px-8 py-2.5 text-lg mb-3' : 'px-4 py-1 text-[9px] mb-1.5'
                }`}>
                  Remuneração
                </span>
                <p className={`font-bold text-neutral-800 tracking-wide leading-relaxed uppercase ${
                  visualizacaoReal ? 'text-xl' : 'text-[9px]'
                }`}>
                  SALÁRIO MÍNIMO CLT <span className="text-neutral-900 block font-black mt-0.5">+ 1% DE COMISSÃO PARA CADA IMÓVEL VENDIDO</span>
                </p>
              </div>

            </div>

          </div>

          {/* FOOTER: ENVIAR CURRÍCULO (ESTILO PÍLULA DE LUXO CLICÁVEL - DESIGN 100% FIEL AO ORIGINAL) */}
          <div className="w-full pt-6 border-t border-neutral-200/60">
            <a 
              href={linkWhats}
              target="_blank"
              rel="noopener noreferrer"
              className={`bg-neutral-900 text-white rounded-2xl w-full flex flex-col items-start justify-center font-bold shadow-md hover:bg-neutral-800 hover:scale-[1.01] transition-all cursor-pointer ${
                visualizacaoReal ? 'py-5 px-8' : 'py-2.5 px-4'
              }`}
            >
              <span className={`${montserrat.className} uppercase tracking-[0.25em] text-neutral-400 ${
                visualizacaoReal ? 'text-sm mb-1' : 'text-[7px] mb-0.5'
              }`}>
                Enviar Currículo:
              </span>
              <p className={`${montserrat.className} font-black text-white ${
                visualizacaoReal ? 'text-3xl' : 'text-xs'
              }`}>
                (33) 99819-2119
              </p>
            </a>
          </div>

        </div>

      </div>

    </div>
  );
}

