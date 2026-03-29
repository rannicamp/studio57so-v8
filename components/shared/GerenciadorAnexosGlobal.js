"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faEye, faDownload, faLink, faRightLeft, faUserTie, faFileLines, faFilePdf, faPen, faTableCellsLarge, faBars } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import PdfThumbnail from '@/components/financeiro/PdfThumbnail';

export default function GerenciadorAnexosGlobal({ 
    anexos, 
    viewMode: initialViewMode = 'grid', // 'list' or 'grid'
    storageBucket = 'empreendimento-anexos', 
    onDelete, 
    onToggleCorretor, 
    isToggling,
    onPreview, // novo: visualização interna
    onMove, // novo: mudar aba/tipo
    onEdit // novo: editar título e descrição
}) {
    const supabase = createClient();
    const [viewMode, setViewMode] = useState(initialViewMode);
    
    // Atualiza caso o pai force uma mudança externa, mas permite ser controlado internamente
    useEffect(() => {
        setViewMode(initialViewMode);
    }, [initialViewMode]);

    if (!anexos || anexos.length === 0) return (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 mt-4">
            <span className="text-gray-400 text-lg font-medium">Nenhum arquivo encontrado nesta aba.</span>
            <p className="text-gray-400 text-sm">Faça o upload de documentos usando o botão acima.</p>
        </div>
    );

    const handleCopyLink = async (filePath) => {
        if (!filePath) { toast.error("Caminho não encontrado."); return; }
        const { data } = supabase.storage.from(storageBucket).getPublicUrl(filePath);
        if (data?.publicUrl) {
            try {
                await navigator.clipboard.writeText(data.publicUrl);
                toast.success("Link público copiado!");
            } catch (err) {
                toast.error("Falha ao copiar o link.");
            }
        }
    };

    const handleDownloadBase = async (anexo) => {
        if (onDownload) {
            onDownload(anexo);
            return;
        }
        
        // Comportamento fallback nativo para forçar 'Salvar como'
        try {
            toast.promise(
                fetch(anexo.public_url)
                    .then(res => res.blob())
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = anexo.nome_arquivo || 'documento';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }),
                {
                    loading: 'Preparando download...',
                    success: 'Download iniciado!',
                    error: 'Erro ao baixar o arquivo.'
                }
            );
        } catch (error) {
            console.error("Erro no download:", error);
        }
    };

    const getFileType = (anexo) => {
        // Usa o caminho original real para garantir a extensão, caindo para nome_arquivo se falhar
        const fullName = anexo.caminho_arquivo || anexo.nome_arquivo || '';
        const ext = fullName.split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
        if (ext === 'pdf') return 'pdf';
        return 'image';
    };

    // Funcionalidade de Busca Embutida Padrão Ouro
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredAnexos = anexos.filter(a => {
        const search = searchTerm.toLowerCase();
        const nome = (a.nome_arquivo || '').toLowerCase();
        const desc = (a.descricao || '').toLowerCase();
        return nome.includes(search) || desc.includes(search);
    });

    // --- TOGGLE DE VISUALIZAÇÃO E BUSCA HEADER ---
    const headerToolbarJSX = (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 no-print">
            {/* Barra de Pesquisa */}
            <div className="w-full sm:w-80 relative flex-shrink-0">
                <input 
                    type="text" 
                    placeholder="Pesquisar anexos..." 
                    className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                        &times;
                    </button>
                )}
            </div>

            {/* Toggle Grid / Lista */}
            <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto justify-end">
                <button onClick={() => setViewMode('grid')} className={`px-4 py-2 rounded-md transition-all text-sm font-semibold flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`} title="Modo Grade (Miniaturas)">
                    <FontAwesomeIcon icon={faTableCellsLarge} /> Grade
                </button>
                <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-md transition-all text-sm font-semibold flex items-center gap-2 ${viewMode === 'list' ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`} title="Modo Lista (Compacto)">
                    <FontAwesomeIcon icon={faBars} /> Lista
                </button>
            </div>
        </div>
    );

    if (viewMode === 'list') {
        return (
            <div className="mt-4">
                {headerToolbarJSX}
                
                {filteredAnexos.length === 0 ? (
                    <div className="text-center p-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                        Nenhum anexo encontrado para "{searchTerm}".
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAnexos.map(anexo => (
                            <div key={anexo.id} className="bg-white p-3 rounded-md border flex items-center justify-between gap-4 hover:shadow-md transition-shadow group">
                                <div className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer" onClick={() => onPreview && onPreview(anexo)}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getFileType(anexo) === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'}`}>
                                        <FontAwesomeIcon icon={getFileType(anexo) === 'pdf' ? faFilePdf : faFileLines} className="text-xl" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors" title={anexo.nome_arquivo}>
                                            {anexo.nome_arquivo}
                                        </p>
                                        <p className="text-xs text-gray-500">{anexo.descricao || anexo.tipo?.descricao || 'Sem descrição'}</p>
                                    </div>
                                </div>
                            
                            {/* Ações Padronizadas Padrão Ouro em Linha (Design System: Sem quadrados) */}
                            <div className="flex items-center flex-shrink-0 gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                {'disponivel_corretor' in anexo && onToggleCorretor && (
                                    <button 
                                        onClick={() => onToggleCorretor(anexo)} 
                                        disabled={isToggling} 
                                        title={anexo.disponivel_corretor ? "Ocultar dos Corretores" : "Publicar para Corretores"} 
                                        className={`p-2 transition-colors flex items-center justify-center ${anexo.disponivel_corretor ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        <FontAwesomeIcon icon={isToggling ? faSpinner : faUserTie} className={`${isToggling ? 'animate-spin' : ''} text-lg`} />
                                    </button>
                                )}
                                
                                <button onClick={(e) => { e.stopPropagation(); handleDownloadBase(anexo); }} title="Baixar" className="p-2 text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center">
                                    <FontAwesomeIcon icon={faDownload} className="text-lg" />
                                </button>
                                <button onClick={() => handleCopyLink(anexo.caminho_arquivo)} title="Copiar link público" className="p-2 text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center">
                                    <FontAwesomeIcon icon={faLink} className="text-lg" />
                                </button>
                                {onMove && (
                                    <button onClick={() => onMove(anexo)} title="Mover Arquivo" className="p-2 text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center">
                                        <FontAwesomeIcon icon={faRightLeft} className="text-lg" />
                                    </button>
                                )}
                                {onEdit && (
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(anexo); }} title="Editar Arquivo" className="p-2 text-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center">
                                        <FontAwesomeIcon icon={faPen} className="text-lg" />
                                    </button>
                                )}
                                {onPreview && (
                                    <button onClick={() => onPreview(anexo)} title="Visualizar Internamente" className="p-2 text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center">
                                        <FontAwesomeIcon icon={faEye} className="text-lg" />
                                    </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); onDelete(anexo); }} title="Excluir" className="p-2 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center ml-2">
                                    <FontAwesomeIcon icon={faTrash} className="text-lg" />
                                </button>
                            </div>
                        </div>
                    ))}
                    </div>
                )}
            </div>
        );
    }

    // MODO GRID (Miniaturas Vivas)
    return (
        <div className="mt-4">
            {headerToolbarJSX}
            
            {filteredAnexos.length === 0 ? (
                <div className="text-center p-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                    Nenhum anexo encontrado para "{searchTerm}".
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredAnexos.map(anexo => {
                        const fType = getFileType(anexo);
                        return (
                            <div key={anexo.id} className="relative group rounded-xl overflow-hidden shadow-sm border bg-white flex flex-col h-64 hover:shadow-xl transition-all duration-300">
                                {/* Imagem / PDF Thumb Area (Clicável para Preview) */}
                            <div 
                                className="flex-1 w-full bg-gray-100 relative overflow-hidden cursor-pointer"
                                onClick={() => onPreview && onPreview(anexo)}
                            >
                                {fType === 'video' ? (
                                    <div className="w-full h-full bg-black flex items-center justify-center">
                                        <video src={anexo.public_url} className="w-full h-full object-cover opacity-80" preload="metadata" />
                                    </div>
                                ) : fType === 'pdf' ? (
                                    <div className="w-full h-full relative pointer-events-none group-hover:scale-105 transition-transform duration-500">
                                        {/* Componente Nativo do Financeiro (React-PDF) */}
                                        <PdfThumbnail url={anexo.public_url} width={300} />
                                    </div>
                                ) : (
                                    <img
                                        src={anexo.thumbnail_url || anexo.public_url}
                                        alt={anexo.nome_arquivo}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.outerHTML = `<div class="text-gray-400 flex flex-col items-center justify-center w-full h-full bg-gray-100"><FontAwesomeIcon icon={faFileLines} class="text-3xl mb-2" /><span class="text-[10px] px-2 text-center break-all">${anexo.nome_arquivo}</span></div>`;
                                        }}
                                    />
                                )}
                                
                                {/* Overlay Degrade on Hover */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                
                                {/* 6 Actions Toolbar Floating Form (Mantido com sombras pois estão sobre imagens/fundos dinâmicos) */}
                                <div className="absolute top-2 right-2 flex flex-wrap max-w-[150px] justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    {'disponivel_corretor' in anexo && onToggleCorretor && (
                                        <button onClick={(e) => { e.stopPropagation(); onToggleCorretor(anexo); }} disabled={isToggling} title={anexo.disponivel_corretor ? "Ocultar dos Corretores" : "Publicar para Corretores"} className={`h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-full shadow-lg transition-colors ${anexo.disponivel_corretor ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}>
                                            <FontAwesomeIcon icon={isToggling ? faSpinner : faUserTie} className={`${isToggling ? 'animate-spin' : ''} text-sm`} />
                                        </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); handleDownloadBase(anexo); }} title="Baixar" className="bg-white/90 text-gray-700 hover:text-blue-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                        <FontAwesomeIcon icon={faDownload} className="text-sm" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleCopyLink(anexo.caminho_arquivo); }} title="Copiar Link" className="bg-white/90 text-gray-700 hover:text-blue-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                        <FontAwesomeIcon icon={faLink} />
                                    </button>
                                    {onMove && (
                                        <button onClick={(e) => { e.stopPropagation(); onMove(anexo); }} title="Mover Arquivo" className="bg-white/90 text-gray-700 hover:text-indigo-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                            <FontAwesomeIcon icon={faRightLeft} />
                                        </button>
                                    )}
                                    {onEdit && (
                                        <button onClick={(e) => { e.stopPropagation(); onEdit(anexo); }} title="Editar Arquivo" className="bg-white/90 text-gray-700 hover:text-gray-900 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                            <FontAwesomeIcon icon={faPen} className="text-sm" />
                                        </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(anexo); }} title="Excluir" className="bg-white/90 text-red-500 hover:text-red-700 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                        <FontAwesomeIcon icon={faTrash} className="text-sm" />
                                    </button>
                                </div>
                            </div>

                            {/* Title Bar at Bottom */}
                            <div className="bg-white p-3 shrink-0 flex flex-col z-10">
                                <h4 className="text-sm font-bold text-gray-800 truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</h4>
                                <p className="text-[11px] text-gray-500 truncate" title={anexo.descricao || anexo.tipo?.descricao || "Padrão"}>
                                    {anexo.descricao || anexo.tipo?.descricao || "Sem Descrição Especial"}
                                </p>
                            </div>
                        </div>
                    );
                })}
                </div>
            )}
        </div>
    );
}
