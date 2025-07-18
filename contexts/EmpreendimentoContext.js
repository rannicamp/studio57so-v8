'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Importar useRouter para usar router.refresh()

const EmpreendimentoContext = createContext();

export function EmpreendimentoProvider({ children }) {
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState(null);
  const router = useRouter(); // Inicializar useRouter

  useEffect(() => {
    // Carrega o empreendimento selecionado do localStorage ao iniciar
    const storedEmpreendimentoId = localStorage.getItem('selectedEmpreendimentoId');
    if (storedEmpreendimentoId) {
      setSelectedEmpreendimento(parseInt(storedEmpreendimentoId)); // Garante que seja um número
    }
  }, []);

  const changeEmpreendimento = (empreendimentoId) => {
    setSelectedEmpreendimento(empreendimentoId);
    if (empreendimentoId) {
      localStorage.setItem('selectedEmpreendimentoId', empreendimentoId);
    } else {
      localStorage.removeItem('selectedEmpreendimentoId');
    }
    router.refresh(); // <-- AQUI! Agora usa router.refresh() para revalidar dados
  };

  return (
    <EmpreendimentoContext.Provider value={{ selectedEmpreendimento, changeEmpreendimento }}>
      {children}
    </EmpreendimentoContext.Provider>
  );
}

export function useEmpreendimento() {
  const context = useContext(EmpreendimentoContext);
  if (context === undefined) {
    throw new Error('useEmpreendimento must be used within an EmpreendimentoProvider');
  }
  return context;
}