// Caminho do arquivo: app/(landingpages)/components/MenuPublico.js
'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function MenuPublico() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  
  // Define qual marca está ativa baseado na rota atual
  const isElo57Active = pathname ? (pathname.startsWith('/elo57') || pathname.startsWith('/apresentacaoelo')) : false;

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="w-full px-6 py-3 flex justify-between items-center">
        {/* Lado Esquerdo: Brand Switcher (Toggle Button Studio 57 x Elo 57) */}
        <div className="flex items-center space-x-3 bg-neutral-50 p-1 rounded-2xl border border-neutral-100">
          {/* Studio 57 Switch */}
          <Link 
            href="/" 
            className={`relative flex items-center justify-center p-1.5 rounded-xl transition-all duration-300 ${
              !isElo57Active 
                ? 'bg-white shadow-sm border border-neutral-200/50 scale-105 opacity-100' 
                : 'opacity-40 hover:opacity-75 hover:scale-102'
            }`}
            title="Ir para Studio 57"
          >
            <Image 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092416467.png" 
              alt="Símbolo Studio 57" 
              width={35} 
              height={35}
              priority 
              className="object-contain"
            />
          </Link>

          {/* Divisor Visual */}
          <span className="w-[1px] h-5 bg-neutral-200"></span>

          {/* Elo 57 Switch */}
          <Link 
            href="/elo57" 
            className={`relative flex items-center justify-center p-1.5 rounded-xl transition-all duration-300 ${
              isElo57Active 
                ? 'bg-white shadow-sm border border-neutral-200/50 scale-105 opacity-100' 
                : 'opacity-40 hover:opacity-75 hover:scale-102'
            }`}
            title="Ir para Elo 57"
          >
            <Image 
              src="/marca/icone-elo57.svg" 
              alt="Símbolo Elo 57" 
              width={35} 
              height={35}
              priority 
              className="object-contain"
            />
          </Link>
        </div>

        {/* Links de Navegação (Desktop) */}
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/" className="text-gray-600 hover:text-primary transition-colors font-medium">Início</Link>
          <Link href="/sobre-nos" className="text-gray-600 hover:text-primary transition-colors font-medium">Sobre Nós</Link>
          <Link href="/empreendimentosstudio" className="text-gray-600 hover:text-primary transition-colors font-medium">Empreendimentos</Link>
          
          {/* Lado Direito: Logo Elo 57 como botão de login */}
          <Link href="/login" className="hover:opacity-80 transition-opacity flex items-center" aria-label="Entrar no Elo 57">
            <Image 
              src="/marca/logo-elo57-horizontal.svg" 
              alt="Elo 57" 
              width={110} 
              height={35} 
              className="object-contain" 
              priority 
            />
          </Link>
        </div>

        {/* Hamburguer (Mobile) */}
        <div className="md:hidden">
          <button onClick={() => setIsOpen(!isOpen)} className="text-gray-800 focus:outline-none">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}></path>
            </svg>
          </button>
        </div>
      </nav>

      {/* Menu Dropdown (Mobile) */}
      {isOpen && (
        <div className="md:hidden bg-white py-4 border-t px-6">
          <Link href="/" className="block text-center py-2 text-gray-800 hover:bg-gray-100 font-medium" onClick={() => setIsOpen(false)}>Início</Link>
          <Link href="/sobre-nos" className="block text-center py-2 text-gray-800 hover:bg-gray-100 font-medium" onClick={() => setIsOpen(false)}>Sobre Nós</Link>
          <Link href="/empreendimentosstudio" className="block text-center py-2 text-gray-800 hover:bg-gray-100 font-medium" onClick={() => setIsOpen(false)}>Empreendimentos</Link>
          <div className="mt-4 flex justify-center">
            <Link href="/login" className="hover:opacity-80 transition-opacity" onClick={() => setIsOpen(false)} aria-label="Entrar no Elo 57">
              <Image 
                src="/marca/logo-elo57-horizontal.svg" 
                alt="Elo 57" 
                width={110} 
                height={35} 
                className="object-contain" 
              />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}