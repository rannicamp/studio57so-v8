// components/painel/widgets/WelcomeCard.js
// CÓDIGO CORRIGIDO - Aspas escapadas

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faCloudMoon, faCloud, faSpinner } from '@fortawesome/free-solid-svg-icons';

async function fetchVersiculo() {
  const response = await fetch('https://www.abibliadigital.com.br/api/verses/nvi/random');
  if (!response.ok) {
    throw new Error('Não foi possível carregar o versículo.');
  }
  return response.json();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { text: "Bom dia", icon: faSun };
  }
  if (hour < 18) {
    return { text: "Boa tarde", icon: faCloud };
  }
  return { text: "Boa noite", icon: faCloudMoon };
}

export default function WelcomeCard({ user }) {
  const greeting = getGreeting();
  const userName = user?.nome || 'Usuário';

  const { data: versiculo, isLoading, error } = useQuery({
    queryKey: ['versiculoDoDia'],
    queryFn: fetchVersiculo,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      
      {/* --- Seção da Saudação (Original) --- */}
      <div className="flex items-center space-x-4">
        <FontAwesomeIcon icon={greeting.icon} className="text-4xl text-yellow-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{greeting.text}, {userName}!</h2>
          <p className="text-gray-500">Que bom te ver por aqui. Pronto para começar?</p>
        </div>
      </div>
      
      {/* --- Seção do Versículo (CORRIGIDA) --- */}
      <div className="border-t border-gray-200 mt-4 pt-4 min-h-[60px]">
        
        {isLoading && (
          <div className="flex items-center text-sm text-gray-500 italic">
            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
            <span>Carregando inspiração do dia...</span>
          </div>
        )}

        {/* =================================================================
        // INÍCIO DA CORREÇÃO
        // O PORQUÊ: Substituímos as aspas duplas literais por &quot;
        // ================================================================= */}
        {error && (
          <p className="text-sm text-gray-400 italic">&quot;Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.&quot; - Eclesiastes 3:1</p>
        )}

        {versiculo && (
          <div>
            <p className="text-md text-gray-700 italic">&quot;{versiculo.text}&quot;</p>
            {/* FIM DA CORREÇÃO */}
            {/* ================================================================= */}
            <p className="text-right text-sm font-semibold text-gray-600 mt-2">
              - {versiculo.book.name} {versiculo.chapter}:{versiculo.number}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}