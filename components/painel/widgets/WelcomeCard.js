// components/painel/widgets/WelcomeCard.js
"use client";

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faCalendarDay } from '@fortawesome/free-solid-svg-icons';

// Função auxiliar para determinar a saudação
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Bom dia" };
  if (hour < 18) return { text: "Boa tarde" };
  return { text: "Boa noite" };
}

export default function WelcomeCard({ user }) {
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const greeting = getGreeting();
  // Pega primeiro nome ou nome completo
  const userName = user?.nome ? user.nome.split(' ')[0] : 'Usuário';

  // Efeito para o Relógio (Roda a cada segundo)
  useEffect(() => {
    setMounted(true); // Indica que já estamos no navegador (Client-side)
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Formatadores de Data e Hora
  const timeString = currentDate.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const dateString = currentDate.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  // Capitaliza a primeira letra da data (Ex: "Sábado" em vez de "sábado")
  const formattedDate = dateString.charAt(0).toUpperCase() + dateString.slice(1);

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 transition-all hover:shadow-xl">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* --- ESQUERDA: Saudação e Avatar --- */}
        <div className="flex items-center space-x-4 w-full md:w-auto">
          {/* Avatar com anel de destaque */}
          <div className="relative">
            <img
              src={user?.avatar_url || 'https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg'}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md ring-1 ring-gray-100"
            />
            {/* Indicador Online (opcional, só visual por enquanto) */}
            <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
              {greeting.text}, {userName}!
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-500 text-sm">
                Vamos fazer acontecer hoje?
              </p>
              {user?.funcao && (
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {user.funcao}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* --- DIREITA: Relógio e Data --- */}
        {mounted ? (
          <div className="flex flex-col items-end text-right border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
            
            {/* Hora Grande */}
            <div className="flex items-center gap-2 text-gray-800">
              <FontAwesomeIcon icon={faClock} className="text-blue-500 text-lg opacity-80" />
              <span className="text-3xl font-bold font-mono tracking-tight leading-none">
                {timeString}
              </span>
            </div>

            {/* Data Completa */}
            <div className="flex items-center gap-2 text-gray-500 mt-1">
              <span className="text-xs font-medium uppercase tracking-wide">
                {formattedDate}
              </span>
              <FontAwesomeIcon icon={faCalendarDay} className="text-gray-400 text-xs" />
            </div>

          </div>
        ) : (
          // Skeleton loader enquanto o relógio carrega (evita "pulo" na tela)
          <div className="h-12 w-32 bg-gray-50 rounded animate-pulse"></div>
        )}

      </div>
    </div>
  );
}