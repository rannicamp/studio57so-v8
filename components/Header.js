"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faHome, faUserCircle, faBuilding, faCog, faInbox, faUser, faChevronDown } from '@fortawesome/free-solid-svg-icons';

import { useLayout } from '../contexts/LayoutContext';
import { useAuth } from '../contexts/AuthContext';
import { useEmpreendimento } from '../contexts/EmpreendimentoContext';

import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';

export default function Header({ headerPositionClass }) {
    const router = useRouter();
    const { pageTitle } = useLayout();
    const { user, userData, hasPermission } = useAuth();
    const { empreendimentos, selectedEmpreendimento, changeEmpreendimento, loading: loadingEmpreendimento } = useEmpreendimento();
    
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Otimização: Calculamos o nome e a foto diretamente, sem precisar de estado extra.
    const firstName = userData?.nome?.split(' ')[0];
    const userName = firstName || user?.email;
    const userPhoto = userData?.avatar_url || null;

    // Este useEffect é ótimo para funcionalidades como "clicar fora para fechar".
    useEffect(() => {
        function handleClickOutside(event) {
            // AQUI ESTAVA O ERRO: trocamos menu_ref por menuRef
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef]); // A dependência [menuRef] está correta

    const handleEmpreendimentoChange = (e) => {
        changeEmpreendimento(e.target.value);
    };

    return (
        <header className={`bg-white shadow-md h-[65px] fixed top-0 z-50 flex items-center justify-between px-6 transition-all duration-300 ${headerPositionClass}`}>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-500" title="Voltar"><FontAwesomeIcon icon={faChevronLeft} size="lg" /></button>
                    <button onClick={() => router.push('/')} className="text-gray-600 hover:text-blue-500" title="Página Inicial"><FontAwesomeIcon icon={faHome} size="lg" /></button>
                    <button onClick={() => router.forward()} className="text-gray-600 hover:text-blue-500" title="Avançar"><FontAwesomeIcon icon={faChevronRight} size="lg" /></button>
                </div>
                <h1 className="text-xl font-semibold text-gray-800 hidden md:block">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-6">
                {!loadingEmpreendimento && empreendimentos.length > 0 && (
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faBuilding} className="text-gray-500" />
                        <select
                            value={selectedEmpreendimento || 'all'}
                            onChange={handleEmpreendimentoChange}
                            className="text-sm font-medium border-none bg-transparent focus:ring-0 cursor-pointer"
                        >
                            <option value="all">Todas as Atividades</option>
                            {empreendimentos.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.nome}</option>
                            ))}
                        </select>
                    </div>
                )}

                <NotificationBell />

                {userName && (
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-3 cursor-pointer">
                            {userPhoto ? (
                                <img src={userPhoto} alt="Foto do perfil" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                                <FontAwesomeIcon icon={faUserCircle} className="w-9 h-9 text-gray-400" />
                            )}
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-medium text-gray-700">{userName}</span>
                                <FontAwesomeIcon icon={faChevronDown} className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                                <ul className="py-1">
                                    <li>
                                        <Link href="/perfil" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
                                            <span>Meu Perfil</span>
                                        </Link>
                                    </li>
                                    {hasPermission('configuracoes', 'pode_ver') && (
                                        <li>
                                            <Link href="/configuracoes" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                                                <span>Configurações</span>
                                            </Link>
                                        </li>
                                    )}
                                    <li>
                                        <Link href="/configuracoes/feedback/enviar" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <FontAwesomeIcon icon={faInbox} className="w-4 h-4" />
                                            <span>Enviar Feedback</span>
                                        </Link>
                                    </li>
                                    <li className="border-t border-gray-200 my-1"></li>
                                    <li>
                                        <LogoutButton />
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}