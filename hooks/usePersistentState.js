import { useState, useEffect } from 'react';

/**
 * Hook para estado persistente (Salva no LocalStorage)
 * @param {string} key - Chave única para salvar no banco do navegador (ex: 'rascunho_chat_123')
 * @param {any} initialValue - Valor inicial padrão
 */
export function usePersistentState(key, initialValue) {
  // 1. Inicia o estado tentando ler do LocalStorage
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      // Se existir, converte de JSON para Objeto/String. Se não, usa o inicial.
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Erro ao ler localStorage chave "${key}":`, error);
      return initialValue;
    }
  });

  // 2. Se a CHAVE mudar (ex: mudou de contato), tenta carregar o valor da nova chave
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(key);
        if (saved !== null) {
            try {
                setState(JSON.parse(saved));
            } catch {
                setState(initialValue);
            }
        } else {
            // Se não tem nada salvo pra essa nova chave, reseta pro inicial
            setState(initialValue);
        }
    }
  }, [key]); // Dependência: key

  // 3. Sempre que o ESTADO mudar, salva no LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.warn(`Erro ao salvar no localStorage chave "${key}":`, error);
      }
    }
  }, [key, state]);

  return [state, setState];
}