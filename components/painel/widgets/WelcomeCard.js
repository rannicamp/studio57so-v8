// components/painel/widgets/WelcomeCard.js
// CÓDIGO ATUALIZADO
// O PORQUÊ 1: Trocamos o ícone de saudação pelo Avatar do usuário.
// O PORQUÊ 2: Mudamos o 'staleTime' do versículo para 0, forçando
//            a busca de um novo versículo a cada carregamento.

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// =================================================================
// INÍCIO DA CORREÇÃO 1: Ícones de saudação removidos
// import { faSun, faCloudMoon, faCloud, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
// =================================================================
// FIM DA CORREÇÃO 1
// =================================================================

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
    // Ícone não é mais usado, mas mantemos o texto
    return { text: "Bom dia" };
  }
  if (hour < 18) {
    return { text: "Boa tarde" };
  }
  return { text: "Boa noite" };
}

export default function WelcomeCard({ user }) {
  const greeting = getGreeting();
  const userName = user?.nome || 'Usuário';

  const { data: versiculo, isLoading, error } = useQuery({
    queryKey: ['versiculoDoDia'],
    queryFn: fetchVersiculo,
    // =================================================================
    // INÍCIO DA CORREÇÃO 2: Cache do Versículo
    // O PORQUÊ: staleTime: 0 força o react-query a considerar
    // o dado "velho" imediatamente, buscando um novo a cada load.
    staleTime: 0,
    // =================================================================
    // FIM DA CORREÇÃO 2
    // =================================================================
    retry: 1,
  });

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      
      {/* --- Seção da Saudação (Atualizada com Avatar) --- */}
      <div className="flex items-center space-x-4">
        {/* ================================================================= */}
        {/* INÍCIO DA CORREÇÃO 1: Troca do Ícone pelo Avatar */}
        {/* Usamos o avatar_url do usuário e um fallback (o mesmo do UserInfoCard) */}
        <img
          src={user?.avatar_url || 'https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg'}
          alt="Avatar"
          className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 shadow-sm"
        />
        {/* FIM DA CORREÇÃO 1 */}
        {/* ================================================================= */}
        
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{greeting.text}, {userName}!</h2>
          <p className="text-gray-500">Que bom te ver por aqui. Pronto para começar?</p>
        </div>
      </div>
      
      {/* --- Seção do Versículo (Sem alteração de layout) --- */}
      <div className="border-t border-gray-200 mt-4 pt-4 min-h-[60px]">
        
        {isLoading && (
          <div className="flex items-center text-sm text-gray-500 italic">
            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
            <span>Carregando inspiração do dia...</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-gray-400 italic">&quot;Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.&quot; - Eclesiastes 3:1</p>
        )}

        {versiculo && (
          <div>
            <p className="text-md text-gray-700 italic">&quot;{versiculo.text}&quot;</p>
            <p className="text-right text-sm font-semibold text-gray-600 mt-2">
              - {versiculo.book.name} {versiculo.chapter}:{versiculo.number}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}