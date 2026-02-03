'use client';

// Importando todos os componentes (Slides)
import HeroSection from './components/HeroSection';
import OriginSection from './components/OriginSection';
import TechSection from './components/TechSection';
import CaseSection from './components/CaseSection';
import PwaSection from './components/PwaSection'; // <--- O novo componente
import CtaSection from './components/CtaSection';

export default function ApresentacaoElo() {
  return (
    // Container Principal com Scroll Snap (Comportamento de Slides)
    <div className="bg-white font-sans snap-y snap-mandatory h-screen overflow-y-scroll scroll-smooth">
      
      {/* 1. Capa */}
      <HeroSection />
      
      {/* 2. História */}
      <OriginSection />
      
      {/* 3. Módulos/Sistema */}
      <TechSection />
      
      {/* 4. Case Alfa (Viewer BIM) */}
      <CaseSection />

      {/* 5. Mobile/PWA (Novo) */}
      <PwaSection />
      
      {/* 6. Conclusão */}
      <CtaSection />

    </div>
  );
}