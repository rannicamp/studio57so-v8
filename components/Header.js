"use client";

import { useState, useEffect } from 'react';
import LogoutButton from './LogoutButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faHome, faUserCircle, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import { useLayout } from '../contexts/LayoutContext';
import { useAuth } from '../contexts/AuthContext';
import { useEmpreendimento } from '../contexts/EmpreendimentoContext'; // Importamos nosso novo hook

export default function Header({ isCollapsed }) {
  const router = useRouter();
  const { pageTitle } = useLayout();
  const { user, userData } = useAuth();
  const { empreendimentos, selectedEmpreendimento, changeEmpreendimento, loading: loadingEmpreendimento } = useEmpreendimento();
  const [userName, setUserName] = useState('');
  const [userPhoto, setUserPhoto] = useState(null);

  useEffect(() => {
    if (userData) {
      const firstName = userData.nome?.split(' ')[0];
      setUserName(firstName || user?.email);
      setUserPhoto(userData.avatar_url || null);
    } else if (user) {
      setUserName(user.email);
    }
  }, [user, userData]);

  const handleEmpreendimentoChange = (e) => {
    changeEmpreendimento(e.target.value);
  };

  const headerLeftPosition = isCollapsed ? 'left-[80px]' : 'left-[260px]';

  return (
    <header className={`bg-white shadow-md h-[65px] fixed top-0 right-0 z-30 flex items-center justify-between px-6 transition-all duration-300 ${headerLeftPosition}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-500" title="Voltar"><FontAwesomeIcon icon={faChevronLeft} size="lg" /></button>
          <button onClick={() => router.push('/')} className="text-gray-600 hover:text-blue-500" title="Página Inicial"><FontAwesomeIcon icon={faHome} size="lg" /></button>
          <button onClick={() => router.forward()} className="text-gray-600 hover:text-blue-500" title="Avançar"><FontAwesomeIcon icon={faChevronRight} size="lg" /></button>
        </div>
        <h1 className="text-xl font-semibold text-gray-800 hidden md:block">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Seletor Global de Empreendimento */}
        {!loadingEmpreendimento && empreendimentos.length > 0 && (
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faBuilding} className="text-gray-500" />
            <select
              value={selectedEmpreendimento || ''}
              onChange={handleEmpreendimentoChange}
              className="text-sm font-medium border-none bg-transparent focus:ring-0 cursor-pointer"
            >
              <option value="">Atividades Gerais</option>
              {empreendimentos.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Informações do Usuário */}
        {userName && (
          <div className="flex items-center gap-3">
            {userPhoto ? (
              <img src={userPhoto} alt="Foto do perfil" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <FontAwesomeIcon icon={faUserCircle} className="w-9 h-9 text-gray-400" />
            )}
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700">{userName}</span>
              <LogoutButton />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}