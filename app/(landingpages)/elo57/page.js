// Caminho: app/(landingpages)/elo57/page.js
'use client';

import { useState, useEffect } from 'react';
// Importando todos os componentes (Slides)
import HeroSection from './components/HeroSection';
import PainelDoresSection from './components/PainelDoresSection';
import PainelIntegradoSection from './components/PainelIntegradoSection';
import TechSection from './components/TechSection';

import InboxSection from './components/InboxSection';
import OrcamentoBimSection from './components/OrcamentoBimSection';
import PwaSection from './components/PwaSection';
import RelatoriosSection from './components/RelatoriosSection';
import McpSection from './components/McpSection';
import PricingSection from './components/PricingSection';
import PricingTableSection from './components/PricingTableSection';
import CtaSection from './components/CtaSection';
import FormularioElo57 from './components/FormularioElo57';

const SECTIONS = [
  { id: 'hero', label: 'Início' },
  { id: 'dores', label: 'Desafios' },
  { id: 'gestao-integrada', label: 'Gestão Unificada' },
  { id: 'modulos', label: 'Ecossistema' },

  { id: 'inbox', label: 'Caixa de Entrada' },
  { id: 'orcamentobim', label: 'Orçamento BIM' },
  { id: 'mobile', label: 'Mobilidade' },
  { id: 'relatorios', label: 'Resultados em Tempo Real' },
  { id: 'mcp', label: 'Integração IA (MCP)' },
  { id: 'pricing', label: 'Planos e Preços' },
  { id: 'pricing-details', label: 'Módulos dos Planos' },
  { id: 'cta', label: 'Começar' }
];

export default function ApresentacaoElo() {
  const [activeSection, setActiveSection] = useState('hero');
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.3 // ativa melhor no mobile e desktop
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
    // Container Principal: Scroll Fluido e contínuo em todos os dispositivos
    <div className="relative bg-white font-sans h-auto scroll-smooth">
      
      {/* Indicadores Laterais Flutuantes (Dots) - Ocultos em telas pequenas (mobile) para melhorar UX */}
      <nav className="fixed right-4 md:right-6 top-1/2 -translate-y-1/2 z-50 hidden sm:flex flex-col gap-3 pointer-events-auto bg-black/25 backdrop-blur-md p-3 rounded-full border border-white/10 shadow-lg">
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
              <span className="absolute right-8 scale-0 group-hover:scale-100 transition-all duration-200 origin-right bg-black/85 text-white text-[11px] font-bold tracking-wider uppercase py-1.5 px-3.5 rounded-lg whitespace-nowrap shadow-md pointer-events-none">
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

      {/* Renderização das Seções */}
      {/* 1. Capa */}
      <HeroSection onOpenForm={() => setIsFormOpen(true)} />
      {/* 2. Dores */}
      <PainelDoresSection />
      {/* 2.5. Gestão Centralizada (Painel) */}
      <PainelIntegradoSection />
      {/* 4. Módulos/Sistema */}
      <TechSection />

      {/* 5.5. Caixa de Entrada */}
      <InboxSection />
      {/* 6. Orçamento BIM */}
      <OrcamentoBimSection />
      {/* 7. Mobile/PWA */}
      <PwaSection />
      {/* 8. Relatórios consolidados */}
      <RelatoriosSection />
      {/* 8.5. Protocolo MCP e Agente IA */}
      <McpSection />
      {/* 9. Planos e Preços */}
      <PricingSection />
      {/* 9.5. Comparativo de Módulos (Tabela Interativa) */}
      <PricingTableSection />
      {/* 10. Conclusão / CTA */}
      <CtaSection onOpenForm={() => setIsFormOpen(true)} />

      {isFormOpen && <FormularioElo57 onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}