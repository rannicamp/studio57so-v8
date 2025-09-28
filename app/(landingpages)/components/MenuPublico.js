// Caminho do arquivo: app/(landingpages)/components/MenuPublico.js
'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';

export default function MenuPublico() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Image 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/logo/logo-studio57-preto.png" 
              alt="Logo Studio 57" 
              width={40} 
              height={40} 
            />
            <span className="text-xl font-bold text-gray-800">Studio 57</span>
          </Link>
        </div>

        {/* Links do Menu para Desktop */}
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/" className="text-gray-600 hover:text-primary transition-colors">
            Início
          </Link>
          <Link href="/sobre-nos" className="text-gray-600 hover:text-primary transition-colors">
            Sobre Nós
          </Link>
          {/* ======================= LINK ATUALIZADO AQUI ======================= */}
          <Link href="/empreendimentosstudio" className="text-gray-600 hover:text-primary transition-colors">
            Empreendimentos
          </Link>
          <Link href="/login" className="bg-primary text-white font-bold py-2 px-6 rounded-full hover:opacity-90 transition-opacity">
            Entrar
          </Link>
        </div>

        {/* Botão de Menu para Mobile */}
        <div className="md:hidden">
          <button onClick={() => setIsOpen(!isOpen)} className="text-gray-800 focus:outline-none">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}></path>
            </svg>
          </button>
        </div>
      </nav>

      {/* Menu Mobile (aparece quando o botão é clicado) */}
      {isOpen && (
        <div className="md:hidden bg-white py-4">
          <Link href="/" className="block text-center py-2 text-gray-800 hover:bg-gray-100" onClick={() => setIsOpen(false)}>Início</Link>
          <Link href="/sobre-nos" className="block text-center py-2 text-gray-800 hover:bg-gray-100" onClick={() => setIsOpen(false)}>Sobre Nós</Link>
          {/* ======================= LINK ATUALIZADO AQUI ======================= */}
          <Link href="/empreendimentosstudio" className="block text-center py-2 text-gray-800 hover:bg-gray-100" onClick={() => setIsOpen(false)}>Empreendimentos</Link>
          <div className="mt-4 text-center">
            <Link href="/login" className="inline-block bg-primary text-white font-bold py-2 px-6 rounded-full hover:opacity-90 transition-opacity" onClick={() => setIsOpen(false)}>
              Entrar
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}