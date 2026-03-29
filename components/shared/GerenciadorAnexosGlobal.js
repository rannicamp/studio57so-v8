"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faEye, faDownload, faLink, faRightLeft, faUserTie, faFileLines, faFilePdf, faPen } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import PdfThumbnail from '@/components/financeiro/PdfThumbnail';

export default function GerenciadorAnexosGlobal({ 
    anexos, 
    viewMode = 'grid', // 'list' or 'grid'
    storageBucket = 'empreendimento-anexos', 
    onDelete, 
    onToggleCorretor, 
    isToggling,
    onPreview, // novo: visualização interna
    onMove, // novo: mudar aba/tipo
    onEdit // novo: editar título e descrição
}) {
    const supabase = createClient();

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

    const getFileType = (fileName) => {
        const ext = fileName?.split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
        if (ext === 'pdf') return 'pdf';
        return 'image';
    };

    if (viewMode === 'list') {
        return (
            <div className="space-y-3 mt-4">
                {anexos.map(anexo => (
                    <div key={anexo.id} className="bg-white p-3 rounded-md border flex items-center justify-between gap-4 hover:shadow-md transition-shadow group">
                        <div className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer" onClick={() => onPreview && onPreview(anexo)}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getFileType(anexo.nome_arquivo) === 'pdf' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                                <FontAwesomeIcon icon={getFileType(anexo.nome_arquivo) === 'pdf' ? faFilePdf : faFileLines} className="text-xl" />
                            </div>
                            <div className="flex-grow min-w-0">
                                <p className="font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors" title={anexo.nome_arquivo}>
                                    {anexo.nome_arquivo}
                                </p>
                                <p className="text-xs text-gray-500">{anexo.descricao || anexo.tipo?.descricao || 'Sem descrição'}</p>
                            </div>
                        </div>
                        
                        {/* Ações Padronizadas Padrão Ouro em Linha */}
                        <div className="flex items-center flex-shrink-0">
                            <button 
                                onClick={() => onToggleCorretor && onToggleCorretor(anexo)} 
                                disabled={isToggling} 
                                title={anexo.disponivel_corretor ? "Ocultar dos Corretores" : "Publicar para Corretores"} 
                                className={`w-8 h-8 rounded flex items-center justify-center mx-1 transition-colors ${anexo.disponivel_corretor ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            >
                                <FontAwesomeIcon icon={isToggling ? faSpinner : faUserTie} className={`${isToggling ? 'animate-spin' : ''} text-sm`} />
                            </button>
                            
                            <a href={anexo.public_url} download={anexo.nome_arquivo} title="Baixar Original" className="w-8 h-8 rounded flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 mx-1">
                                <FontAwesomeIcon icon={faDownload} className="text-sm" />
                            </a>
                            <button onClick={() => handleCopyLink(anexo.caminho_arquivo)} title="Copiar link público" className="w-8 h-8 rounded flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 mx-1">
                                <FontAwesomeIcon icon={faLink} className="text-sm" />
                            </button>
                            <button onClick={() => onMove && onMove(anexo)} title="Mover Arquivo" className="w-8 h-8 rounded flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 mx-1">
                                <FontAwesomeIcon icon={faRightLeft} className="text-sm" />
                            </button>
                            <button onClick={() => onEdit && onEdit(anexo)} title="Editar Arquivo" className="w-8 h-8 rounded flex items-center justify-center bg-orange-50 text-orange-500 hover:bg-orange-100 mx-1">
                                <FontAwesomeIcon icon={faPen} className="text-sm" />
                            </button>
                            <button onClick={() => onPreview && onPreview(anexo)} title="Visualizar Internamente" className="w-8 h-8 rounded flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 mx-1">
                                <FontAwesomeIcon icon={faEye} className="text-sm" />
                            </button>
                            <button onClick={() => onDelete(anexo)} title="Excluir" className="w-8 h-8 rounded flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 ml-1">
                                <FontAwesomeIcon icon={faTrash} className="text-sm" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // MODO GRID (Miniaturas Vivas)
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
            {anexos.map(anexo => {
                const fType = getFileType(anexo.nome_arquivo);
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
                            
                            {/* 6 Actions Toolbar Floating Form */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button onClick={(e) => { e.stopPropagation(); onToggleCorretor && onToggleCorretor(anexo); }} disabled={isToggling} title={anexo.disponivel_corretor ? "Ocultar dos Corretores" : "Publicar para Corretores"} className={`h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-full shadow-lg transition-colors ${anexo.disponivel_corretor ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}>
                                    <FontAwesomeIcon icon={isToggling ? faSpinner : faUserTie} className={`${isToggling ? 'animate-spin' : ''} text-sm`} />
                                </button>
                                <a href={anexo.public_url} download={anexo.nome_arquivo} onClick={e => e.stopPropagation()} title="Baixar" className="bg-white/90 text-gray-700 hover:text-blue-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                    <FontAwesomeIcon icon={faDownload} />
                                </a>
                                <button onClick={(e) => { e.stopPropagation(); handleCopyLink(anexo.caminho_arquivo); }} title="Copiar Link" className="bg-white/90 text-gray-700 hover:text-blue-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                    <FontAwesomeIcon icon={faLink} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onMove && onMove(anexo); }} title="Mover Arquivo" className="bg-indigo-500 text-white hover:bg-indigo-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                    <FontAwesomeIcon icon={faRightLeft} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onEdit && onEdit(anexo); }} title="Editar Arquivo" className="bg-orange-500 text-white hover:bg-orange-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
                                    <FontAwesomeIcon icon={faPen} className="text-sm" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(anexo.id || anexo); }} title="Excluir" className="bg-red-500 text-white hover:bg-red-600 h-8 w-8 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110">
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
    );
}
