// components/painel/widgets/WelcomeCard.js
// CÓDIGO COMPLETO

"use client";

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faCloudMoon, faCloud } from '@fortawesome/free-solid-svg-icons';

// O PORQUÊ: Este componente é puramente visual. Ele recebe o nome do usuário
// e calcula a saudação correta (Bom dia, Boa tarde, Boa noite) com um ícone.
// Isso humaniza o painel e faz o usuário se sentir bem-vindo.

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

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      <div className="flex items-center space-x-4">
        <FontAwesomeIcon icon={greeting.icon} className="text-4xl text-yellow-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{greeting.text}, {userName}!</h2>
          <p className="text-gray-500">Que bom te ver por aqui. Pronto para começar?</p>
        </div>
      </div>
    </div>
  );
}