//components\MenuSettingsForm.js

"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// ***** CORREÇÃO AQUI: Os ícones corretos estão sendo importados e usados *****
import { faArrowLeft, faArrowRight, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

export default function MenuSettingsForm({ userId, currentPosition }) {
  const [selectedPosition, setSelectedPosition] = useState(currentPosition);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const options = [
    // ***** CORREÇÃO AQUI: Os ícones foram trocados para a posição correta *****
    { value: 'left', label: 'Esquerda', icon: faArrowLeft },
    { value: 'right', label: 'Direita', icon: faArrowRight },
    { value: 'top', label: 'Superior', icon: faArrowUp },
    { value: 'bottom', label: 'Inferior', icon: faArrowDown },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const promise = async () => {
      const { error } = await supabase
        .from('usuarios')
        .update({ sidebar_position: selectedPosition })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }
    };

    toast.promise(promise(), {
      loading: 'Salvando sua preferência...',
      success: () => {
        setIsLoading(false);
        // Sugere ao usuário recarregar a página para ver a mudança
        return 'Preferência salva! Recarregue a página (F5) para ver a alteração.';
      },
      error: (err) => {
        setIsLoading(false);
        return `Erro ao salvar: ${err.toString()}`;
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md">
      <fieldset>
        <legend className="text-lg font-medium text-gray-900 mb-4">Posição do Menu</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* A lógica de filtro para 'top' foi removida em uma etapa anterior, mantendo a correção. */}
          {options.map((option) => (
            <div key={option.value}>
              <input
                type="radio"
                id={option.value}
                name="sidebar-position"
                value={option.value}
                checked={selectedPosition === option.value}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="sr-only" // Esconde o radio button padrão
              />
              <label
                htmlFor={option.value}
                className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedPosition === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <FontAwesomeIcon icon={option.icon} className="text-2xl mb-2" />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={isLoading || selectedPosition === currentPosition}
          className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}