// components/CorretorHeader.js
"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser, 
  faSignOutAlt, 
  faCog, 
  faChevronDown,
  faBars
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';

export default function CorretorHeader({ toggleSidebar }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const displayName = user?.nome || user?.email || 'Corretor';
  const avatarUrl = user?.avatar_url;

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      {/* Lado Esquerdo: Botão Menu (Mobile) e Título */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md text-gray-600 hover:bg-gray-100 lg:hidden focus:outline-none"
        >
          <FontAwesomeIcon icon={faBars} className="w-5 h-5" />
        </button>
        
        <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">
          Portal do Corretor
        </h1>
      </div>

      {/* Lado Direito: Menu do Usuário */}
      <div className="flex items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 focus:outline-none hover:bg-gray-50 p-1.5 rounded-lg transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 overflow-hidden relative">
              {avatarUrl ? (
                <Image 
                    src={avatarUrl} 
                    alt="Perfil" 
                    fill 
                    className="object-cover"
                    sizes="40px"
                />
              ) : (
                <span className="text-blue-700 font-medium text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-700 max-w-[150px] truncate">
                {displayName}
              </p>
              <p className="text-xs text-gray-500">Corretor Parceiro</p>
            </div>

            <FontAwesomeIcon 
              icon={faChevronDown} 
              className={`text-gray-400 text-xs transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
              <div className="px-4 py-3 border-b border-gray-100 md:hidden">
                 <p className="text-sm font-medium text-gray-900">{displayName}</p>
                 <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>

              <Link 
                href="/portal-perfil" 
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                onClick={() => setIsDropdownOpen(false)}
              >
                <FontAwesomeIcon icon={faUser} className="w-4 h-4 mr-3 opacity-70" />
                Meu Perfil
              </Link>
              
              <div className="border-t border-gray-100 my-1"></div>

              <button
                onClick={handleLogout}
                className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4 mr-3 opacity-70" />
                Sair do Sistema
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}