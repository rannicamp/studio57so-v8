'use client';
import { useState, useEffect } from 'react';
// Ajuste o caminho de importação conforme necessário para o seu projeto
import AutodeskViewer from '@/components/bim/AutodeskViewer'; 

export default function CaseSection() {
  const [urn, setUrn] = useState(null);

  useEffect(() => {
    // setUrn('urn:adsk.wipprod:dm.lineage:SeuUrnDoModelAqui');
  }, []);

  return (
    <section className="snap-start h-screen flex flex-col justify-center py-10 bg-black text-white px-6">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col justify-center">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="text-[#FF6700] font-bold tracking-widest uppercase text-sm">03. Na Prática</span>
            <h2 className="text-4xl md:text-6xl font-bold mt-2">Residencial Alfa</h2>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-gray-400 text-sm">Integração Total</p>
            <p className="text-xl font-bold">BIM + Obra</p>
          </div>
        </div>

        {/* ÁREA DO VIEWER E RENDER */}
        <div className="grid lg:grid-cols-2 gap-6 flex-grow max-h-[60vh]">
          {/* Lado Esquerdo: Render Artístico */}
          <div className="relative rounded-xl overflow-hidden bg-gray-800 border border-gray-700 group">
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 transition-colors group-hover:text-gray-300">
                <span>[Render Realista do Alfa]</span>
             </div>
          </div>

          {/* Lado Direito: Viewer Real */}
          <div className="relative rounded-xl overflow-hidden border border-[#FF6700] bg-gray-900 shadow-[0_0_30px_rgba(255,103,0,0.15)]">
            {urn ? (
              <AutodeskViewer urn={urn} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                <svg className="w-20 h-20 mb-6 text-[#FF6700] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
                <h3 className="text-white text-2xl font-bold mb-2">BIM Manager</h3>
                <p className="text-gray-400">Carregando modelo estrutural...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}