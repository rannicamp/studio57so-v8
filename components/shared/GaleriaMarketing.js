// components/shared/GaleriaMarketing.js
"use client";

import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faEye, faDownload, faLink, faRightLeft } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function GaleriaMarketing({ anexos, storageBucket, onDelete }) {
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

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {anexos.map(anexo => (
                <div key={anexo.id} className="relative group rounded-lg overflow-hidden shadow-lg border">
                    <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-48 bg-gray-100">
                        {anexo.thumbnail_url ? (
                            <img src={anexo.thumbnail_url} alt={`Pré-visualização de ${anexo.nome_arquivo}`} className="w-full h-full object-contain"/>
                        ) : (
                            <div className="text-gray-500 flex flex-col items-center">
                                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                                <span className="mt-2 text-sm">Gerando preview...</span>
                            </div>
                        )}
                    </a>
                    <div className="absolute top-0 right-0 p-1 flex items-center gap-1 bg-black/20 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={anexo.public_url} download={anexo.nome_arquivo} title="Baixar" className="text-white h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faDownload} /></a>
                        <button onClick={() => handleCopyLink(anexo.caminho_arquivo)} title="Copiar link público" className="text-white h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faLink} /></button>
                        <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" title="Visualizar" className="text-white h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faEye} /></a>
                        <button onClick={() => onDelete(anexo)} title="Excluir" className="text-white h-7 w-7 flex items-center justify-center hover:scale-110"><FontAwesomeIcon icon={faTrash} /></button>
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