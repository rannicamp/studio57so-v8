// Caminho: app/(landingpages)/studiosbeta/page.js
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faTshirt, faUtensils, faBuilding } from '@fortawesome/free-solid-svg-icons';
import FormularioDeContatoBeta from './FormularioDeContatoBeta.js';

export default function StudiosBetaPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <main className="relative min-h-screen flex items-center justify-center text-white overflow-hidden">
        <Image
          src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1759100949768.png"
          alt="Studios Beta - Fachada do empreendimento"
          layout="fill"
          // O PORQUÊ DA CORREÇÃO:
          // 'objectFit="contain"' garante que a imagem inteira seja visível
          // e que suas proporções originais sejam mantidas, sem ampliação excessiva
          // ou cortes. Ela se "encaixa" dentro do espaço.
          objectFit="contain"
          objectPosition="bottom right"
          className="z-0"
          priority
        />
        <div className="absolute inset-0 bg-black bg-opacity-50 z-10"></div>
        <div className="relative z-20 container mx-auto px-6 text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
            Studios Beta
          </h1>
          <p className="mt-4 text-lg md:text-2xl font-light" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>
            More com estilo, viva com inteligência.
          </p>
          <div className="mt-2 text-sm font-semibold uppercase tracking-widest text-amber-400">
            <p>Lançamento em Breve | Unidades Limitadas</p>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 max-w-2xl w-full">
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faMapMarkerAlt} className="text-3xl mb-2" /><span className="text-sm">Localização Privilegiada</span></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faTshirt} className="text-3xl mb-2" /><span className="text-sm">Lavanderia</span></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faUtensils} className="text-3xl mb-2" /><span className="text-sm">Área Gourmet</span></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faBuilding} className="text-3xl mb-2" /><span className="text-sm">Rooftop</span></div>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="mt-10 bg-amber-500 text-gray-900 font-bold uppercase py-3 px-10 rounded-full shadow-lg hover:bg-amber-600 transition-colors duration-300">
            Tenho Interesse
          </button>
        </div>
      </main>
      {isModalOpen && (
        <FormularioDeContatoBeta onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}