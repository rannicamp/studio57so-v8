// Caminho do arquivo: app/(landingpages)/components/MenuPublico.js
'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';

export default function MenuPublico() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="w-full px-6 py-3 flex justify-between items-center">
        <Link href="/">
            <Image 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092416467.png" 
              alt="Símbolo Studio 57" 
              width={50} 
              height={50}
              priority 
            />
        </Link>
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/" className="text-gray-600 hover:text-primary transition-colors font-medium">Início</Link>
          <Link href="/sobre-nos" className="text-gray-600 hover:text-primary transition-colors font-medium">Sobre Nós</Link>
          <Link href="/empreendimentosstudio" className="text-gray-600 hover:text-primary transition-colors font-medium">Empreendimentos</Link>
          <Link href="/login" className="bg-primary text-white font-bold py-2 px-6 rounded-full hover:opacity-90 transition-opacity">Entrar</Link>
        </div>
        <div className="md:hidden">
          <button onClick={() => setIsOpen(!isOpen)} className="text-gray-800 focus:outline-none">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}></path>
            </svg>
          </button>
        </div>
      </nav>
      {isOpen && (
        <div className="md:hidden bg-white py-4 border-t">
          <Link href="/" className="block text-center py-2 text-gray-800 hover:bg-gray-100" onClick={() => setIsOpen(false)}>Início</Link>
          <Link href="/sobre-nos" className="block text-center py-2 text-gray-800 hover:bg-gray-100" onClick={() => setIsOpen(false)}>Sobre Nós</Link>
          <Link href="/empreendimentosstudio" className="block text-center py-2 text-gray-800 hover:bg-gray-100" onClick={() => setIsOpen(false)}>Empreendimentos</Link>
          <div className="mt-4 text-center">
            <Link href="/login" className="inline-block bg-primary text-white font-bold py-2 px-6 rounded-full hover:opacity-90" onClick={() => setIsOpen(false)}>Entrar</Link>
          </div>
        </div>
      )}
    </header>
  );
}