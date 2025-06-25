"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import LogoutButton from './LogoutButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faHome } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';

// O Header agora só precisa saber se o menu está recolhido para se ajustar
export default function Header({ isCollapsed }) {
  const supabase = createClient();
  const router = useRouter(); // Hook do Next.js para navegação
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('nome, sobrenome')
          .eq('id', user.id)
          .single();
        const name = [profile?.nome, profile?.sobrenome].filter(Boolean).join(' ');
        setUserName(name || user.email);
      }
    };
    fetchUser();
  }, [supabase]);

  // Ajusta a posição do cabeçalho com base no estado do menu
  const headerLeftPosition = isCollapsed ? 'left-[80px]' : 'left-[260px]';

  return (
    <header 
      className={`
        bg-white shadow-md h-[65px] fixed top-0 right-0 z-30 
        flex items-center justify-between px-6 
        transition-all duration-300 
        ${headerLeftPosition}
      `}
    >
      {/* NOVOS CONTROLES DE NAVEGAÇÃO */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-500" title="Voltar">
          <FontAwesomeIcon icon={faChevronLeft} size="lg" />
        </button>
        <button onClick={() => router.push('/')} className="text-gray-600 hover:text-blue-500" title="Página Inicial">
          <FontAwesomeIcon icon={faHome} size="lg" />
        </button>
        <button onClick={() => router.forward()} className="text-gray-600 hover:text-blue-500" title="Avançar">
          <FontAwesomeIcon icon={faChevronRight} size="lg" />
        </button>
      </div>

      <div>
        {userName ? (
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700">{userName}</span>
            <LogoutButton />
          </div>
        ) : null}
      </div>
    </header>
  );
}