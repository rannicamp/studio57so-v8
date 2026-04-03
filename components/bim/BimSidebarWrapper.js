"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import Sidebar from '@/components/shared/sidebar';

export default function BimSidebarWrapper() {
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);

 return (
 <>
 {/* Painel estreito fixo na lateral quando o menu está fechado (Acompanha a altura da tela)
 Isso dá uma "ancoragem" visual ao botão de menu, tornando-o parte do sistema.
 */}
 {!isSidebarOpen && (
 <div className="flex flex-col items-center py-4 w-[65px] bg-white border-r border-gray-100 z-40 print:hidden shadow-sm relative shrink-0">
 <button
 onClick={() => setIsSidebarOpen(true)}
 className="p-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all focus:outline-none flex items-center justify-center group"
 title="Abrir Menu Principal"
 >
 <FontAwesomeIcon icon={faBars} className="text-xl group-hover:scale-110 transition-transform" />
 </button>
 {/* Linha Fina decorativa da Identidade Visual */}
 <div className="w-8 h-px bg-gray-200 mt-4 rounded-full"></div>
 </div>
 )}

 {/* Container da Sidebar principal (mantém o controle oficial dela, com Z-index para sobrepor via animação quando aberta) */}
 <div className="print:hidden">
 <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setIsSidebarOpen(false)} />
 </div>
 </>
 );
}
