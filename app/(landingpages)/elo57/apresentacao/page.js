// Caminho: app/(landingpages)/elo57/apresentacao/page.js
'use client';

import { useState, useEffect } from 'react';
// Importando todos os componentes (Slides)
import HeroSection from '../components/HeroSection';
import PainelDoresSection from '../components/PainelDoresSection';
import PainelIntegradoSection from '../components/PainelIntegradoSection';
import TechSection from '../components/TechSection';
import StellaSection from '../components/StellaSection';
import OrcamentoBimSection from '../components/OrcamentoBimSection';
import PwaSection from '../components/PwaSection';
import CtaSection from '../components/CtaSection';

const SECTIONS = [
  { id: 'hero', label: 'Início' },
  { id: 'dores', label: 'Dores de Gestão' },
  { id: 'gestao-integrada', label: 'Gestão Centralizada' },
  { id: 'modulos', label: 'Ecossistema' },
  { id: 'stella', label: 'SDR Stella IA' },
  { id: 'orcamentobim', label: 'BIM 5D Integrado' },
  { id: 'mobile', label: 'Mobilidade/PWA' },
  { id: 'cta', label: 'Fechar Negócio' }
];

export default function ApresentacaoCompletaElo() {
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5 // ativa quando 50% da seção estiver na tela
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => {
      SECTIONS.forEach((section) => {
        const el = document.getElementById(section.id);
        if (el) observer.unobserve(el);
      });
    };
  }, []);

  const handleScroll = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    // Container Principal com Scroll Snap (Comportamento de Slides)
    <div className="relative bg-white font-sans snap-y snap-mandatory h-screen overflow-y-scroll scroll-smooth">
      
      {/* Indicadores Laterais Flutuantes (Dots) */}
      <nav className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3.5 pointer-events-auto bg-black/15 backdrop-blur-md p-4 rounded-full border border-white/10 shadow-xl">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => handleScroll(section.id)}
              className="group relative flex items-center justify-center focus:outline-none"
              aria-label={`Ir para a seção ${section.label}`}
            >
              {/* Tooltip Lateral Esquerda */}
              <span className="absolute right-8 scale-0 group-hover:scale-100 transition-all duration-200 origin-right bg-black/90 text-white text-[11px] font-bold tracking-wider uppercase py-1.5 px-3.5 rounded-lg whitespace-nowrap shadow-md pointer-events-none">
                {section.label}
              </span>
              
              {/* Dot Visual */}
              <span className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isActive 
                  ? 'bg-slate-950 scale-125 shadow-md shadow-slate-950/20' 
                  : 'bg-gray-400 group-hover:bg-gray-600 group-hover:scale-110'
              }`} />
            </button>
          );
        })}
      </nav>

      {/* Sequência Estruturada de Slides (Storytelling) */}
      
      {/* 1. Capa */}
      <HeroSection />
      
      {/* 2. Dores do Mercado (Novo) */}
      <PainelDoresSection />
      
      {/* 2.5. Gestão Centralizada (Painel) */}
      <PainelIntegradoSection />
      
      {/* 4. Módulos / Ecossistema Completo */}
      <TechSection />
      
      {/* 5. SDR Stella IA (Novo) */}
      <StellaSection />
      
      {/* 7. BIM 5D / Orçamento Integrado (Novo) */}
      <OrcamentoBimSection />
      
      {/* 8. Mobilidade & PWA Offline */}
      <PwaSection />
      
      {/* 9. Fechamento e Parcerias */}
      <CtaSection />

    </div>
  );
}
