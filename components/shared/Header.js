"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, faUserCircle, faBuilding, 
    faCog, faInbox, faUser, faChevronDown, faBars 
} from '@fortawesome/free-solid-svg-icons';

// CORREÇÃO: Usando @/ para garantir que ache a pasta na raiz
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';

// Importações locais (mesma pasta 'shared')
import LogoutButton from './LogoutButton';
import CotacoesBar from './CotacoesBar';

// CORREÇÃO: Caminho absoluto para o componente de notificação que está em outra pasta
import NotificationBell from '@/components/notificacao/NotificationBell'; 

export default function Header({ headerPositionClass, toggleSidebar }) {
    const router = useRouter();
    const { pageTitle, sidebarPosition } = useLayout() || {};
    const { user } = useAuth();
    const { empreendimentos, selectedEmpreendimento, changeEmpreendimento, loading: loadingEmpreendimento } = useEmpreendimento();
    
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const firstName = user?.nome?.split(' ')[0];
    const userName = firstName || user?.email;
    const userPhoto = user?.avatar_url || null;

    const cotacoesVisiveis = user?.cotacoes_visiveis || [];
    const isCotacoesBarVisible = user?.mostrar_barra_cotacoes && cotacoesVisiveis.length > 0;

    const isLateral = sidebarPosition === 'left' || sidebarPosition === 'right';

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef]);

    const handleEmpreendimentoChange = (e) => {
        changeEmpreendimento(e.target.value);
    };

    return (
        <div className={`fixed top-0 z-40 w-full ${headerPositionClass}`}>
            <header className="bg-white shadow-md h-[65px] flex items-center justify-between px-4 md:px-6 transition-all duration-300">
                
                {/* LADO ESQUERDO: Botão Menu + Navegação */}
                <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    
                    {/* BOTÃO HAMBÚRGUER (Só aparece se menu for lateral) */}
                    {isLateral && (
                        <button 
                            onClick={toggleSidebar}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-1"
                            title="Menu Principal"
                        >
                            <FontAwesomeIcon icon={faBars} size="lg" />
                        </button>
                    )}

                    {/* Navegação (Escondida no Mobile) */}
                    <div className="hidden md:flex items-center gap-2 lg:gap-3">
                        <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Voltar">
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <button onClick={() => router.push('/')} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Início">
                            <FontAwesomeIcon icon={faHome} />
                        </button>
                        <button onClick={() => router.forward()} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Avançar">
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                    
                    {/* Divisor e Título (Escondidos no Mobile para dar espaço ao seletor) */}
                    <div className="hidden md:block h-6 w-px bg-gray-200 mx-2"></div>
                    <h1 className="hidden md:block text-lg lg:text-xl font-bold text-gray-800 truncate max-w-[200px] lg:max-w-md" title={pageTitle}>
                        {pageTitle}
                    </h1>
                </div>

                {/* LADO DIREITO: Seletor + Ícones */}
                <div className="flex items-center justify-end flex-1 gap-2 md:gap-6 min-w-0">
                    
                    {/* SELETOR DE OBRAS (Visível Sempre) */}
                    {!loadingEmpreendimento && empreendimentos.length > 0 && (
                        <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 md:px-3 md:py-2 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors max-w-[140px] sm:max-w-[200px] md:max-w-xs flex-shrink">
                            <FontAwesomeIcon icon={faBuilding} className="text-blue-500 text-xs md:text-sm flex-shrink-0" />
                            <select
                                value={selectedEmpreendimento || 'all'}
                                onChange={handleEmpreendimentoChange}
                                className="text-xs md:text-sm font-semibold border-none bg-transparent focus:ring-0 cursor-pointer w-full text-gray-700 p-0 truncate outline-none"
                            >
                                <option value="all">Todas as Obras</option>
                                {empreendimentos.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* GRUPO DE ÍCONES (Sino e Usuário) */}
                    <div className="flex items-center gap-2 md:gap-5 flex-shrink-0">
                        <NotificationBell />

                        {userName && (
                            <div className="relative" ref={menuRef}>
                                <button 
                                    onClick={() => setIsMenuOpen(!isMenuOpen)} 
                                    className="flex items-center gap-1 md:gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded-full transition-colors border border-transparent hover:border-gray-200 focus:outline-none"
                                >
                                    {userPhoto ? (
                                        <img src={userPhoto} alt="Foto" className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover ring-2 ring-white shadow-sm" />
                                    ) : (
                                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                            <FontAwesomeIcon icon={faUserCircle} size="lg" />
                                        </div>
                                    )}
                                    
                                    {/* Nome (Aparece só no PC) */}
                                    <div className="hidden sm:flex items-center gap-1">
                                        <span className="text-sm font-semibold text-gray-700 max-w-[100px] truncate">{userName}</span>
                                        <FontAwesomeIcon icon={faChevronDown} className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {/* MENU SUSPENSO */}
                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl z-50 border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 sm:hidden">
                                            <p className="text-sm font-bold text-gray-800">{user?.nome}</p>
                                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                        </div>
                                        <ul className="py-2">
                                            <li>
                                                <Link href="/perfil" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium">
                                                    <div className="w-6 flex justify-center"><FontAwesomeIcon icon={faUser} /></div>
                                                    <span>Meu Perfil</span>
                                                </Link>
                                            </li>
                                            <li>
                                                <Link href="/configuracoes" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium">
                                                    <div className="w-6 flex justify-center"><FontAwesomeIcon icon={faCog} /></div>
                                                    <span>Configurações</span>
                                                </Link>
                                            </li>
                                            <li>
                                                <Link href="/configuracoes/feedback/enviar" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium">
                                                    <div className="w-6 flex justify-center"><FontAwesomeIcon icon={faInbox} /></div>
                                                    <span>Enviar Feedback</span>
                                                </Link>
                                            </li>
                                            <li className="border-t border-gray-100 my-1"></li>
                                            <li className="px-5 py-2">
                                                <LogoutButton />
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {isCotacoesBarVisible && <CotacoesBar visibleCotacoes={cotacoesVisiveis} />}
        </div>
    );
}