// Caminho: components/CookieBanner.js
'use client';

import { useState, useEffect } from 'react';
// REMOVIDO: import { X } from 'lucide-react'; (Isso causava o erro)

export default function CookieBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já deu o "Ok" antes
    const consentimento = localStorage.getItem('studio57_cookie_consent');
    if (!consentimento) {
      // Se não tiver o registro, mostra o banner após 1 segundo (efeito elegante)
      const timer = setTimeout(() => setVisivel(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const aceitarCookies = () => {
    // Salva no navegador que ele aceitou
    localStorage.setItem('studio57_cookie_consent', 'true');
    setVisivel(false);
  };

  if (!visivel) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-fade-in-up">
      <div className="max-w-6xl mx-auto bg-gray-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex-1 text-center md:text-left">
          <p className="text-sm md:text-base text-gray-200">
            🍪 <strong>Nós usamos cookies!</strong> Utilizamos dados de navegação para entender como você usa o site e melhorar sua experiência no Studio 57.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Botão Aceitar */}
            <button 
              onClick={aceitarCookies}
              className="flex-1 md:flex-none px-6 py-2.5 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-lg text-sm"
            >
              Entendi e Aceito
            </button>
            
            {/* Botão Fechar */}
            <button 
              onClick={() => setVisivel(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Fechar aviso"
            >
              ✕
            </button>
        </div>

      </div>
    </div>
  );
}