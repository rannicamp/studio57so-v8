// components/Accordion.js

"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

export default function Accordion({ title, children, startOpen = true }) {
  const [isOpen, setIsOpen] = useState(startOpen);

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="p-6 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente cria um painel sanfona (accordion) reutilizável.
// Ele recebe um 'title' para exibir na barra superior e 'children' (outros
// componentes ou HTML) para serem o conteúdo que pode ser mostrado ou escondido.
// A propriedade 'startOpen' define se ele já começa aberto ou fechado.
// --------------------------------------------------------------------------------