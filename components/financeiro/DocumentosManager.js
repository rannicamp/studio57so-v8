"use client";

import { useState, useEffect } from 'react';
// REMOVIDO: dynamic não é mais necessário aqui para o PdfThumbnail
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFileImage, faFileAlt, faDownload, faEye, 
    faSearch, faThLarge, faList, faSpinner, faFilePdf 
} from '@fortawesome/free-solid-svg-icons';
import { useDocumentos } from '@/hooks/financeiro/useDocumentos';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

// CORREÇÃO: Importação direta. O PdfThumbnail já cuida do lazy loading internamente agora.
import PdfThumbnail from './PdfThumbnail';

const supabase = createClient();

// --- Subcomponente de Miniatura Inteligente ---
const FileThumbnail = ({ caminhoArquivo, nomeArquivo }) => {
    const ext = nomeArquivo?.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    const isPdf = ext === 'pdf';
    
    const [publicUrl, setPublicUrl] = useState(null);

    useEffect(() => {
        if (caminhoArquivo) {
            const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(caminhoArquivo);
            setPublicUrl(data.publicUrl);
        }
    }, [caminhoArquivo]);

    if (!publicUrl) return <div className="flex items-center justify-center h-full bg-gray-100"><FontAwesomeIcon icon={faSpinner} spin /></div>;

    if (isImage) {
        return (
            <img 
                src={publicUrl} 
                alt={nomeArquivo}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
        );
    }

    if (isPdf) {
        return <PdfThumbnail url={publicUrl} />;
    }

    return (
        <div className="flex flex-col items-center justify-center text-gray-400">
            <FontAwesomeIcon icon={faFileAlt} className="text-4xl mb-2" />
            <span className="text-xs font-bold uppercase">{ext}</span>
        </div>
    );
};

// --- Componente Principal ---
export default function DocumentosManager({ filters }) {
    const [viewMode, setViewMode] = useState('grid');
    const [page, setPage] = useState(1);
    const itemsPerPage = 24;

    const { data: docsData, isLoading } = useDocumentos({ 
        filters, 
        page, 
        itemsPerPage 
    });

    const documentos = docsData?.data || [];
    const totalCount = docsData?.count || 0;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const getFileIcon = (fileName) => {
        const ext = fileName?.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return faFileImage;
        if (ext === 'pdf') return faFilePdf;
        return faFileAlt;
    };

    const handleDownload = async (path, fileName) => {
        try {
            const { data, error } = await supabase.storage.from('documentos-financeiro').download(path);
            if (error) throw error;
            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            toast.error("Erro ao baixar arquivo.");
        }
    };

    const handlePreview = (path) => {
        const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(path);
        if (data?.publicUrl) window.open(data.publicUrl, '_blank');
    };

    if (isLoading) return <div className="p-10 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} spin /> Carregando galeria...</div>;

    if (totalCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-2xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">Nenhum documento encontrado</h3>
                <p className="text-gray-500 text-sm mt-1">Tente ajustar os filtros ou adicione anexos aos seus lançamentos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <p className="text-sm font-semibold text-gray-600">
                    Mostrando <span className="text-blue-600">{documentos.length}</span> de <span className="text-blue-600">{totalCount}</span> arquivos
                </p>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded hover:bg-gray-100 ${viewMode === 'grid' ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`} title="Grade"><FontAwesomeIcon icon={faThLarge} /></button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded hover:bg-gray-100 ${viewMode === 'list' ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`} title="Lista"><FontAwesomeIcon icon={faList} /></button>
                </div>
            </div>

            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {documentos.map((doc) => (
                        <div key={doc.id} className="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-64">
                            <div className="h-36 bg-gray-100 relative overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => handlePreview(doc.caminho_arquivo)}>
                                <FileThumbnail caminhoArquivo={doc.caminho_arquivo} nomeArquivo={doc.nome_arquivo} />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-10">
                                    <button onClick={(e) => { e.stopPropagation(); handlePreview(doc.caminho_arquivo); }} className="text-white hover:text-blue-200 scale-110" title="Visualizar"><FontAwesomeIcon icon={faEye} size="lg" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(doc.caminho_arquivo, doc.nome_arquivo); }} className="text-white hover:text-green-200 scale-110" title="Baixar"><FontAwesomeIcon icon={faDownload} size="lg" /></button>
                                </div>
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-between bg-white relative z-20">
                                <div>
                                    <p className="text-xs font-bold text-gray-700 truncate mb-1" title={doc.nome_arquivo}>{doc.nome_arquivo}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Vinculado a:</p>
                                    <p className="text-xs text-blue-600 truncate hover:underline cursor-pointer" title={doc.lancamento.descricao}>{doc.lancamento.descricao}</p>
                                </div>
                                <div className="flex justify-between items-center mt-2 border-t pt-2 border-gray-50">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${doc.lancamento.tipo === 'Receita' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(doc.lancamento.valor)}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {viewMode === 'list' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arquivo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lançamento</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {documentos.map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="flex-shrink-0 h-8 w-8 text-gray-500"><FontAwesomeIcon icon={getFileIcon(doc.nome_arquivo)} size="lg" /></div><div className="ml-4"><div className="text-sm font-medium text-gray-900 truncate max-w-xs">{doc.nome_arquivo}</div><div className="text-xs text-gray-500">{doc.tipo_documento?.sigla || 'Anexo'}</div></div></div></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 truncate max-w-xs">{doc.lancamento.descricao}</div><div className="text-xs text-gray-500">{doc.lancamento.favorecido?.nome || '-'}</div></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => handlePreview(doc.caminho_arquivo)} className="text-blue-600 hover:text-blue-900 mr-4"><FontAwesomeIcon icon={faEye} /></button><button onClick={() => handleDownload(doc.caminho_arquivo, doc.nome_arquivo)} className="text-green-600 hover:text-green-900"><FontAwesomeIcon icon={faDownload} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <nav className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50">Anterior</button>
                        <span className="px-3 py-1 text-gray-600 self-center">Página {page} de {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50">Próxima</button>
                    </nav>
                </div>
            )}
        </div>
    );
}