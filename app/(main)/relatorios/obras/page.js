// app/(main)/relatorios/obras/page.js
"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faTasks, faTruckLoading, faCameraRetro, faHardHat } from '@fortawesome/free-solid-svg-icons';

import RelatorioCustosObraContainer from '@/components/relatorios/obras/RelatorioCustosObraContainer';

export default function RelatorioObrasPage() {
    // sub-abas: 'custos', 'fisico', 'suprimentos', 'rdo'
    const [abaAtiva, setAbaAtiva] = useState('custos');

    return (
        <div className="h-full w-full space-y-8 p-2 animate-fade-in">
            {/* CABEÇALHO GLOBAL DA PÁGINA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <FontAwesomeIcon icon={faHardHat} className="text-blue-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
                            Painel de Obras
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Consolidação de Custos, Progressões e Diários</p>
                    </div>
                </div>
            </div>

            {/* BARRA DE NAVEGAÇÃO DE SUB-ABAS (NAVEGAÇÃO INTERNA) */}
            <div className="flex flex-col md:flex-row bg-white rounded-lg shadow-sm border border-gray-100 p-1 mb-2 max-w-3xl">
                <button
                    className={`flex-1 flex justify-center items-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                        abaAtiva === 'custos' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setAbaAtiva('custos')}
                >
                    <FontAwesomeIcon icon={faFileInvoiceDollar} />
                    DRE de Custos
                </button>
                <button
                    className={`flex-1 flex justify-center items-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                        abaAtiva === 'fisico' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setAbaAtiva('fisico')}
                >
                    <FontAwesomeIcon icon={faTasks} />
                    Progresso Físico
                </button>
                <button
                    className={`flex-1 flex justify-center items-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                        abaAtiva === 'suprimentos' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setAbaAtiva('suprimentos')}
                >
                    <FontAwesomeIcon icon={faTruckLoading} />
                    Suprimentos
                </button>
                <button
                    className={`flex-1 flex justify-center items-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                        abaAtiva === 'rdo' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setAbaAtiva('rdo')}
                >
                    <FontAwesomeIcon icon={faCameraRetro} />
                    Painel RDO
                </button>
            </div>

            {/* RENDERIZAÇÃO CONDICIONAL DO CONTEÚDO */}
            <div className="mt-4">
                {abaAtiva === 'custos' && (
                    <RelatorioCustosObraContainer />
                )}
                
                {abaAtiva === 'fisico' && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
                        <FontAwesomeIcon icon={faTasks} className="text-4xl mb-4 text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-700">Módulo de Progresso Físico</h2>
                        <p className="text-sm mt-2">Em breve: Integração com as Atividades do sistema.</p>
                    </div>
                )}

                {abaAtiva === 'suprimentos' && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
                        <FontAwesomeIcon icon={faTruckLoading} className="text-4xl mb-4 text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-700">Módulo de Suprimentos</h2>
                        <p className="text-sm mt-2">Em breve: Monitoramento do Mapa de Pedidos de Compra.</p>
                    </div>
                )}

                {abaAtiva === 'rdo' && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
                        <FontAwesomeIcon icon={faCameraRetro} className="text-4xl mb-4 text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-700">Auditoria de Diários (RDO)</h2>
                        <p className="text-sm mt-2">Em breve: Acompanhamento de Assinaturas e Presença nas Obras.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
