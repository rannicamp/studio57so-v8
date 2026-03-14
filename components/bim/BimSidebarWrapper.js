"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import Sidebar from '@/components/shared/sidebar';

export default function BimSidebarWrapper() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <>
            {/* 
              Botão Flutuante (Hambúrguer) sobreposto ao Viewer 
              Mantemos o z-index alto, mas menor que o do Sidebar aberto
            */}
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="absolute top-4 left-4 z-40 p-3 bg-white/90 backdrop-blur-sm text-gray-700 shadow-md rounded-xl hover:bg-gray-50 hover:text-blue-600 transition-all border border-gray-100 focus:outline-none flex items-center justify-center print:hidden group"
                    title="Menu Principal"
                >
                    <FontAwesomeIcon icon={faBars} className="text-xl group-hover:scale-110 transition-transform" />
                </button>
            )}

            {/* O Container do Sidebar. Ele já lida com o z-index e a camada escura (backdrop) internamente */}
            <div className="print:hidden relative z-50">
                <Sidebar 
                    isOpen={isSidebarOpen} 
                    closeSidebar={() => setIsSidebarOpen(false)} 
                />
            </div>
        </>
    );
}
