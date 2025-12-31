"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/contexts/LayoutContext';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDesktop, faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function PreferenciasInterface() {
    const { user } = useAuth();
    const { sidebarPosition, setSidebarPosition } = useLayout();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const handleUpdatePosition = async (newPosition) => {
        if (sidebarPosition === newPosition) return;

        setLoading(true);
        const oldPosition = sidebarPosition;
        setSidebarPosition(newPosition); // Muda visualmente na hora

        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ sidebar_position: newPosition })
                .eq('id', user.id);

            if (error) throw error;
            toast.success('Layout atualizado!');
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar.');
            setSidebarPosition(oldPosition);
        } finally {
            setLoading(false);
        }
    };

    // Componente auxiliar para desenhar a miniatura
    const LayoutPreview = ({ position, active }) => {
        const activeColor = "bg-blue-600";
        const inactiveColor = "bg-gray-300 group-hover:bg-blue-400";
        
        return (
            <div className="w-24 h-16 bg-white border border-gray-200 rounded shadow-sm flex overflow-hidden relative">
                {/* Conteúdo (Cinza Claro) */}
                <div className="absolute inset-0 p-1 flex flex-col gap-1 z-0 justify-center items-center">
                    <div className="h-1 w-full bg-gray-100 rounded"></div>
                    <div className="h-1 w-2/3 bg-gray-100 rounded"></div>
                    <div className="h-1 w-3/4 bg-gray-100 rounded"></div>
                </div>

                {/* Barra do Menu (Azul) */}
                {position === 'left' && <div className={`w-6 h-full absolute left-0 top-0 z-10 transition-colors ${active ? activeColor : inactiveColor}`}></div>}
                {position === 'bottom' && <div className={`w-full h-4 absolute bottom-0 left-0 z-10 transition-colors ${active ? activeColor : inactiveColor}`}></div>}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fade-in">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faDesktop} className="text-blue-600" />
                    Aparência do Sistema
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Escolha a posição do menu principal.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* ESQUERDA (Padrão) */}
                <button 
                    onClick={() => handleUpdatePosition('left')}
                    className={`relative group rounded-xl border-2 p-4 flex items-center gap-4 transition-all text-left ${sidebarPosition === 'left' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300'}`}
                >
                    <LayoutPreview position="left" active={sidebarPosition === 'left'} />
                    <div className="flex-1">
                        <h3 className={`font-bold text-sm ${sidebarPosition === 'left' ? 'text-blue-700' : 'text-gray-700'}`}>Lateral Esquerda</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Padrão para computadores.</p>
                    </div>
                    {sidebarPosition === 'left' && <FontAwesomeIcon icon={loading ? faSpinner : faCheckCircle} spin={loading} className="text-blue-600 text-lg" />}
                </button>

                {/* INFERIOR (Bottom) */}
                <button 
                    onClick={() => handleUpdatePosition('bottom')}
                    className={`relative group rounded-xl border-2 p-4 flex items-center gap-4 transition-all text-left ${sidebarPosition === 'bottom' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300'}`}
                >
                    <LayoutPreview position="bottom" active={sidebarPosition === 'bottom'} />
                    <div className="flex-1">
                        <h3 className={`font-bold text-sm ${sidebarPosition === 'bottom' ? 'text-blue-700' : 'text-gray-700'}`}>Menu Inferior</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Ideal para celulares.</p>
                    </div>
                    {sidebarPosition === 'bottom' && <FontAwesomeIcon icon={loading ? faSpinner : faCheckCircle} spin={loading} className="text-blue-600 text-lg" />}
                </button>

            </div>
        </div>
    );
}