'use client';

// Importando os componentes (Slides)
import HeroSection from './components/HeroSection';
import OriginSection from './components/OriginSection';
import TechSection from './components/TechSection';
import CaseSection from './components/CaseSection';
import CtaSection from './components/CtaSection';

export default function ApresentacaoElo() {
  return (
    // Container Principal com Scroll Snap (Comportamento de Slides)
    <div className="bg-white font-sans snap-y snap-mandatory h-screen overflow-y-scroll scroll-smooth">
      
      <HeroSection />
      
      <OriginSection />
      
      <TechSection />
      
      <CaseSection />
      
      <CtaSection />

    </div>
  );
}