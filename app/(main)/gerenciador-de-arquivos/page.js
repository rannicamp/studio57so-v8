// app/(main)/gerenciador-de-arquivos/page.js
'use client';

import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faEye, faLink, faDownload, faFilePdf, faFile, faSort, faSortUp, faSortDown, faPlus } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import AdicionarArquivoModal from '@/components/gerenciador-de-arquivos/AdicionarArquivoModal';

const PAGE_SIZE = 20;

// Função de fetch (segura e isolada)
const fetchFiles = async ({ pageParam = 0, queryKey }) => {
    const [, sortConfig] = queryKey;
    // CORREÇÃO: createClient SEM await (Isso já estava certo no seu código)
    const supabase = createClient();
    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
        .from('empreendimento_anexos')
        .select(`
            id, nome_arquivo, caminho_arquivo, descricao, created_at, thumbnail_url,
            empreendimentos (id, nome, empresas:empresa_proprietaria_id (nome_fantasia, razao_social)),
            empresas:empresa_id (nome_fantasia, razao_social),
            documento_tipos (descricao)
        `, { count: 'exact' })
        .range(from, to);

    if (sortConfig.key) {
        query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending', referencedTable: sortConfig.referencedTable || undefined });
    } else {
        query = query.order('created_at', { ascending: false });
    }
    
    const { data, error, count } = await query; // Adicionado 'await' explícito aqui para clareza
    if (error) throw new Error(error.message);

    const filesWithUrls = data.map(file => {
        const { data: urlData } = supabase.storage.from('empreendimento-anexos').getPublicUrl(file.caminho_arquivo);
        return { ...file, public_url: urlData.publicUrl };
    });

    return { files: filesWithUrls, nextPage: pageParam + 1, totalCount: count };
};

function FileThumbnail({ file }) {
    const fileExtension = file.nome_arquivo?.split('.').pop().toLowerCase() || '';
    if (file.thumbnail_url) return <img src={file.thumbnail_url} alt={`Thumbnail de ${file.nome_arquivo}`} className="w-16 h-16 object-contain rounded-md bg-gray-200" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) return <img src={file.public_url} alt={file.nome_arquivo} className="w-16 h-16 object-contain rounded-md" />;
    const icon = fileExtension === 'pdf' ? faFilePdf : faFile;
    const colorClass = fileExtension === 'pdf' ? 'text-red-500' : 'text-gray-500';
    return <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-md"><FontAwesomeIcon icon={icon} className={`text-3xl ${colorClass}`} /></div>;
}

export default function GerenciadorDeArquivosPage() {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'descending' });
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
        queryKey: ['storageFiles', sortConfig], queryFn: fetchFiles, initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.nextPage * PAGE_SIZE < lastPage.totalCount) ? lastPage.nextPage : undefined,
    });

    const deleteMutation = useMutation({
        mutationFn: async (fileToDelete) => {
            const { error: storageError } = await supabase.storage.from('empreendimento-anexos').remove([fileToDelete.caminho_arquivo]);
            if (storageError && storageError.statusCode !== '404') throw new Error(`Storage Error: ${storageError.message}`);
            const { error: dbError } = await supabase.from('empreendimento_anexos').delete().eq('id', fileToDelete.id);
            if (dbError) throw new Error(`Database Error: ${dbError.message}`);
        },
        onSuccess: () => { toast.success('Arquivo excluído!'); queryClient.invalidateQueries({ queryKey: ['storageFiles'] }); },
        onError: (err) => toast.error(`Falha ao excluir: ${err.message}`),
    });

    const handleRequestSort = (key, referencedTable = '') => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction, referencedTable });
    };

    const handleDelete = (file) => { if (window.confirm(`Tem certeza que deseja excluir "${file.nome_arquivo}"?`)) deleteMutation.mutate(file); };
    const handleCopyPublicLink = async (filePath) => {
        const { data } = supabase.storage.from('empreendimento-anexos').getPublicUrl(filePath);
        if (data.publicUrl) { navigator.clipboard.writeText(data.publicUrl); toast.success("Link público copiado!"); }
        else { toast.error("Não foi possível gerar o link."); }
    };

    const files = data?.pages.flatMap(page => page.files) ?? [];

    const SortableHeader = ({ label, sortKey, referencedTable = '' }) => {
        const icon = sortConfig.key === sortKey ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort;
        return <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><button className="flex items-center gap-2" onClick={() => handleRequestSort(sortKey, referencedTable)}>{label}<FontAwesomeIcon icon={icon} /></button></th>;
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gerenciador de Arquivos</h1>
                <button onClick={() => setIsModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded-md hover:opacity-90 flex items-center gap-2"><FontAwesomeIcon icon={faPlus} />Adicionar Arquivo</button>
            </div>
            <AdicionarArquivoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUploadSuccess={() => queryClient.invalidateQueries({ queryKey: ['storageFiles'] })} />
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
                                <SortableHeader label="Nome do Arquivo" sortKey="nome_arquivo" />
                                <SortableHeader label="Empreendimento" sortKey="nome" referencedTable="empreendimentos" />
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                                <SortableHeader label="Data de Upload" sortKey="created_at" />
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {status === 'pending' ? (<tr><td colSpan="6" className="p-8 text-center"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>)
                            : status === 'error' ? (<tr><td colSpan="6" className="p-8 text-center text-red-500">Erro: {error.message}</td></tr>)
                            : (files.map((file) => {
                                const empresa = file.empresas || file.empreendimentos?.empresas;
                                const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'N/A';
                                return (
                                <tr key={file.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4"><FileThumbnail file={file} /></td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={file.nome_arquivo}>{file.nome_arquivo}</div>
                                        <div className="text-sm text-gray-500 truncate max-w-xs" title={file.descricao}>{file.descricao || file.documento_tipos?.descricao || 'Sem descrição'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{file.empreendimentos ? <Link href={`/gestao-empreendimentos/${file.empreendimentos.id}`} className="hover:text-blue-600 hover:underline">{file.empreendimentos.nome}</Link> : '---'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{nomeEmpresa}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(file.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                                        <a href={file.public_url} target="_blank" rel="noopener noreferrer" title="Visualizar"><FontAwesomeIcon icon={faEye} /></a>
                                        <button onClick={() => handleCopyPublicLink(file.caminho_arquivo)} title="Copiar Link"><FontAwesomeIcon icon={faLink} /></button>
                                        <a href={file.public_url} download={file.nome_arquivo} title="Baixar"><FontAwesomeIcon icon={faDownload} /></a>
                                        <button onClick={() => handleDelete(file)} disabled={deleteMutation.isPending} title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            )}))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 flex justify-center">
                    <button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage} className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
                        {isFetchingNextPage ? 'Carregando...' : hasNextPage ? 'Carregar Mais' : 'Não há mais arquivos'}
                    </button>
                </div>
            </div>
        </div>
    );
}