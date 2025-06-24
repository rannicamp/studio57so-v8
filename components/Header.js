"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import LogoutButton from './LogoutButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';

// O Header agora recebe tanto 'isCollapsed' quanto 'toggleSidebar'
export default function Header({ isCollapsed, toggleSidebar }) {
  const supabase = createClient();
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

  // Define a posição da esquerda do cabeçalho com base no estado da sidebar
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
      {/* Este botão agora ficará visível! */}
      <button onClick={toggleSidebar} className="text-gray-600 hover:text-blue-500 focus:outline-none">
        <FontAwesomeIcon icon={faBars} size="lg" />
      </button>

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