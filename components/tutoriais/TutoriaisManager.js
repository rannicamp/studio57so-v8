"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faBell, faChevronRight, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import TutorialNotificacoes from './tutoriais_textos/TutorialNotificacoes';

const tutoriaisData = [
    {
        id: 'notificacoes',
        titulo: 'Gestão de Notificações',
        descricao: 'Aprenda a ativar alertas e direcioná-los aos cargos corretos.',
        icone: faBell,
        componente: <TutorialNotificacoes />
    }
    // Futuros tutoriais podem ser adicionados aqui
];

export default function TutoriaisManager() {
    const [tutorialAtivoId, setTutorialAtivoId] = useState(tutoriaisData[0].id);

    const ativo = tutoriaisData.find(t => t.id === tutorialAtivoId);

    return (
        <div className="space-y-6">
            
            {/* Cabeçalho Voltar + Titulo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link href="/configuracoes" className="inline-flex items-center text-rose-600 hover:text-rose-800 font-semibold mb-2 transition-colors">
                        <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
                        Voltar para Configurações
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-800">Manuais e Tutoriais</h1>
                    <p className="text-gray-500 mt-1">Aprenda a pilotar os recursos do Studio 57 como um mestre.</p>
                </div>
                <div className="bg-rose-100 p-4 rounded-full text-rose-600 shadow-sm hidden sm:block">
                    <FontAwesomeIcon icon={faBookOpen} size="2x" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start mt-4">
                {/* LADO ESQUERDO: Menu de Navegação (Equivalente aos "Meses" do Extrato) */}
                <div className="lg:col-span-1 space-y-3">
                    <h3 className="text-sm font-bold text-gray-700 uppercase mb-2 pl-1">Biblioteca</h3>
                    <div className="bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm overflow-hidden min-h-[400px]">
                        {tutoriaisData.map((tut) => {
                            const isSelected = tut.id === tutorialAtivoId;
                            return (
                                <button
                                    key={tut.id}
                                    onClick={() => setTutorialAtivoId(tut.id)}
                                    className={`text-left p-4 border-b last:border-0 transition-all flex items-center justify-between border-l-4 
                                            ${isSelected ? 'bg-rose-50 border-l-rose-500' : 'bg-white hover:bg-gray-50 border-l-transparent text-gray-600'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-rose-200 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
                                            <FontAwesomeIcon icon={tut.icone} />
                                        </div>
                                        <div className="pr-2">
                                            <div className={`text-sm font-bold leading-tight ${isSelected ? 'text-rose-900' : 'text-gray-700'}`}>
                                                {tut.titulo}
                                            </div>
                                            <div className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{tut.descricao}</div>
                                        </div>
                                    </div>
                                    {isSelected && <FontAwesomeIcon icon={faChevronRight} className="text-rose-500 text-xs flex-shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* LADO DIREITO: Painel Detalhe do Conteúdo (Leitor) */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] flex flex-col">
                        
                        {/* Title Bar do Post */}
                        <div className="p-6 md:p-8 border-b bg-gradient-to-r from-gray-50 to-white flex items-start gap-4">
                             <div className="bg-white border rounded-xl p-4 shadow-sm text-rose-500 hidden sm:block">
                                 <FontAwesomeIcon icon={ativo.icone} size="2x" />
                             </div>
                             <div>
                                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">{ativo.titulo}</h2>
                                <p className="text-gray-500 text-sm md:text-base mt-2">{ativo.descricao}</p>
                             </div>
                        </div>

                        {/* Corpo do Texto */}
                        <div className="p-6 md:p-8 flex-1 prose prose-rose max-w-none 
                                        prose-h3:text-gray-800 prose-h3:text-xl 
                                        prose-p:text-gray-600 prose-p:leading-relaxed 
                                        prose-li:text-gray-600 prose-strong:text-gray-800">
                             {ativo.componente}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
