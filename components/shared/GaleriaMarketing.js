// components/shared/GaleriaMarketing.js
"use client";

import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faEye, faDownload, faLink, faRightLeft, faUserTie, faPlayCircle, faFilePdf } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function GaleriaMarketing({ anexos, storageBucket, onDelete, onToggleCorretor, isToggling }) {
    const supabase = createClient();

    if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4 mt-4">Nenhum item de marketing encontrado.</p>;

    const handleCopyLink = async (filePath) => {
        if (!filePath) { toast.error("Arquivo não encontrado."); return; }
        const { data } = supabase.storage.from(storageBucket).getPublicUrl(filePath);
        if (data?.publicUrl) {
            try {
                await navigator.clipboard.writeText(data.publicUrl);
                toast.success("Link público copiado!");
            } catch (err) {
                toast.error("Falha ao copiar o link.");
            }
        } else {
            toast.error("Não foi possível gerar o link público.");
        }
    };

    const getFileType = (fileName) => {
        const ext = fileName?.split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
        if (ext === 'pdf') return 'pdf';
        return 'image';
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {anexos.map(anexo => (
                <div key={anexo.id} className="relative group rounded-lg overflow-hidden shadow-lg border">
                    <div className="flex items-center justify-center h-48 bg-gray-100 relative overflow-hidden">
                        {getFileType(anexo.nome_arquivo) === 'video' ? (
                            <div className="w-full h-full bg-black flex items-center justify-center">
                                <video 
                                    src={anexo.public_url} 
                                    className="w-full h-full max-h-full object-contain" 
                                    preload="metadata"
                                    controls
                                >
                                    Seu navegador não suporta vídeos. <a href={anexo.public_url} className="text-blue-400">Clique aqui para ver</a>
                                </video>
                            </div>
                        ) : getFileType(anexo.nome_arquivo) === 'pdf' ? (
                            <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="w-full h-full relative group/pdf flex items-center justify-center bg-white border-2 border-dashed border-red-200">
                                {/* Uma visualização falsa/clara do PDF usando iframe com pointer-events-none pra não roubar o clique */}
                                <iframe 
                                    src={`${anexo.public_url}#toolbar=0&navpanes=0&scrollbar=0`} 
                                    className="absolute inset-0 w-full h-full pointer-events-none opacity-50" 
                                    title="PDF"
                                />
                                <div className="z-10 bg-white/90 p-3 flex flex-col items-center justify-center rounded-lg shadow border border-red-100">
                                    <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-3xl mb-1" />
                                    <span className="text-xs font-bold text-gray-700">Documento PDF</span>
                                </div>
                            </a>
                        ) : (
                            <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full">
                                <img
                                    src={anexo.thumbnail_url || anexo.public_url}
                                    alt={`Pré-visualização de ${anexo.nome_arquivo}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.outerHTML = `<div class="text-gray-400 flex flex-col items-center justify-center w-full h-full bg-gray-100"><svg class="w-12 h-12 mb-2" fill="currentColor" viewBox="0 0 384 512"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z"/></svg><span class="text-xs px-2 text-center break-all">${anexo.nome_arquivo}</span></div>`;
                                    }}
                                />
                            </a>
                        )}
                    </div>
                    <div className="absolute top-0 right-0 p-1 flex items-center gap-1 bg-black/40 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => onToggleCorretor && onToggleCorretor(anexo)} 
                            disabled={isToggling} 
                            title={anexo.disponivel_corretor ? "Ocultar dos Corretores" : "Publicar para Corretores"} 
                            className={`h-8 w-8 flex flex-shrink-0 items-center justify-center rounded shadow transition-all mr-1 ${anexo.disponivel_corretor ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}
                        >
                            <FontAwesomeIcon icon={isToggling ? faSpinner : faUserTie} className={`${isToggling ? 'animate-spin' : ''} text-sm`} />
                        </button>
                        <a href={anexo.public_url} download={anexo.nome_arquivo} title="Baixar" className="text-white h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faDownload} /></a>
                        <button onClick={() => handleCopyLink(anexo.caminho_arquivo)} title="Copiar link público" className="text-white h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faLink} /></button>
                        <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" title="Visualizar" className="text-white h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faEye} /></a>
                        <button onClick={() => onDelete(anexo.id)} title="Excluir" className="text-white hover:text-red-400 h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                    {(anexo.descricao || anexo.tipo?.descricao) && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate" title={anexo.descricao || anexo.tipo.descricao}>
                            {anexo.descricao || anexo.tipo.descricao}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}