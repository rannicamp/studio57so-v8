// components/painel/widgets/WelcomeCard.js
"use client";

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faCalendarDay } from '@fortawesome/free-solid-svg-icons';

// --- ARSENAL DE FRASES (Imperativo & Liderança) ---
const frasesDeImpacto = [
  "Vamos, faça acontecer hoje!",
  "Foco na execução. Resultados importam.",
  "Lidere pelo exemplo. Avance!",
  "Transforme desafios em metas batidas.",
  "Não espere o momento, crie a oportunidade.",
  "Disciplina é liberdade. Mantenha o ritmo.",
  "Hoje é dia de vencer. Vá e vença.",
  "Sua visão define seu destino. Execute.",
  "Menos desculpas, mais ação.",
  "O sucesso exige constância. Persevere.",
  "Método e disciplina são a chave para o sucesso." // Nova frase adicionada! ✨
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Bom dia" };
  if (hour < 18) return { text: "Boa tarde" };
  return { text: "Boa noite" };
}

export default function WelcomeCard({ user }) {
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [fraseDoDia, setFraseDoDia] = useState(frasesDeImpacto[0]); 

  const greeting = getGreeting();
  const userName = user?.nome ? user.nome.split(' ')[0] : 'Usuário';

  useEffect(() => {
    setMounted(true);
    
    // 1. Relógio
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    
    // 2. Sorteia a frase apenas uma vez quando carrega a tela
    const indiceAleatorio = Math.floor(Math.random() * frasesDeImpacto.length);
    setFraseDoDia(frasesDeImpacto[indiceAleatorio]);

    return () => clearInterval(timer);
  }, []);

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

  const formattedDate = dateString.charAt(0).toUpperCase() + dateString.slice(1);

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 transition-all hover:shadow-xl">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* --- ESQUERDA --- */}
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <div className="relative">
            <img
              src={user?.avatar_url || 'https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg'}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md ring-1 ring-gray-100"
            />
            <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
              {greeting.text}, {userName}!
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {/* Frase Dinâmica aqui 👇 */}
              <p className="text-gray-500 text-sm font-medium">
                {fraseDoDia}
              </p>
              
              {user?.funcao && (
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {user.funcao}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* --- DIREITA --- */}
        {mounted ? (
          <div className="flex flex-col items-end text-right border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
            <div className="flex items-center gap-2 text-gray-800">
              <FontAwesomeIcon icon={faClock} className="text-blue-500 text-lg opacity-80" />
              <span className="text-3xl font-bold font-mono tracking-tight leading-none">
                {timeString}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 mt-1">
              <span className="text-xs font-medium uppercase tracking-wide">
                {formattedDate}
              </span>
              <FontAwesomeIcon icon={faCalendarDay} className="text-gray-400 text-xs" />
            </div>
          </div>
        ) : (
          <div className="h-12 w-32 bg-gray-50 rounded animate-pulse"></div>
        )}

      </div>
    </div>
  );
}