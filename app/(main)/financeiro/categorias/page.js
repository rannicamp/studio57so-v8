// app/(main)/financeiro/categorias/page.js
"use client";

import { useEffect } from 'react';
import CategoriasManager from "../../../../components/financeiro/CategoriasManager";
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTags, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { useLayout } from '../../../../contexts/LayoutContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function CategoriasPage() {
    const { setPageTitle } = useLayout();
    const { user, loading } = useAuth();
    const router = useRouter();

    // Define o título da página e protege a rota
    useEffect(() => {
        setPageTitle('PLANO DE CONTAS');
        
        if (!loading && !user) {
            router.push('/login');
        }
    }, [setPageTitle, user, loading, router]);

    if (loading) return null; // Evita piscar a tela enquanto verifica o usuário

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header Melhorado */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <Link 
                        href="/financeiro" 
                        className="group bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 border border-gray-200 hover:border-blue-200" 
                        title="Voltar para Financeiro"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="transform group-hover:-translate-x-1 transition-transform" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                            <FontAwesomeIcon icon={faTags} className="text-orange-500" />
                            Plano de Contas
                        </h1>
                        <p className="text-xs text-gray-500 font-medium">
                            Estrutura de Categorias e Subcategorias
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Área de Informação */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <FontAwesomeIcon icon={faInfoCircle} className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            Organize suas finanças criando um plano de contas claro. Lembre-se: categorias bem definidas facilitam a geração de relatórios precisos no futuro.
                        </p>
                    </div>
                </div>
            </div>

            {/* Gerenciador */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                <CategoriasManager />
            </div>
        </div>
    );
}