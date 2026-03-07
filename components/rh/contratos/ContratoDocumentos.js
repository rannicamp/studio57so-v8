"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt, faBoxOpen, faPlus, faTimes, faTag, faAlignLeft
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import UppyListUploader from '@/components/ui/UppyListUploader';
import FileListView from '@/components/ui/FileListView';

export default function ContratoDocumentos({ contratoId }) {
    const supabase = createClient();
    const { user } = useAuth();

    // Estados
    const [anexos, setAnexos] = useState([]);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Estados do Modal
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- DATA FETCHING ---
    const fetchData = async () => {
        setLoadingData(true);
        try {
            // 1. Buscar Anexos
            const { data: anexosData } = await supabase
                .from('contratos_terceirizados_anexos')
                .select(`
                    *,
                    tipo:tipo_documento_id(sigla, descricao)
                `)
                .eq('contrato_id', contratoId)
                .order('created_at', { ascending: false });

            setAnexos(anexosData || []);

            // 2. Buscar Tipos de Documento
            if (user?.organizacao_id) {
                const { data: tiposData } = await supabase
                    .from('documento_tipos')
                    .select('*')
                    .eq('organizacao_id', user.organizacao_id)
                    .order('descricao');
                setTiposDocumento(tiposData || []);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (contratoId) fetchData();
    }, [contratoId]);

    // --- UPLOAD HANDLER ---
    const handleUploadSuccess = async (result) => {
        const tipoId = result.tipoDocumento;
        if (!tipoId) return;

        const { error: dbError } = await supabase
            .from('contratos_terceirizados_anexos')
            .insert([{
                contrato_id: contratoId,
                tipo_documento_id: tipoId,
                descricao: result.descricao || '',
                nome_arquivo: result.fileName,
                caminho_arquivo: result.path,
                tipo_arquivo: result.fileType,
                tamanho_bytes: result.fileSize,
                uploaded_by: user.id
            }]);

        if (dbError) {
            toast.error("Erro ao salvar documento no banco de dados.");
        } else {
            toast.success("Documento salvo com sucesso!");
        }
    };

    const handleUploadComplete = () => {
        setIsModalOpen(false);
        fetchData(); // Recarrega a lista
    };

    // --- ACTIONS ---
    const handleDelete = async (file) => {
        const deleteAction = async () => {
            const { error: storageError } = await supabase.storage.from('contratos-documentos').remove([file.caminho_arquivo]);
            if (storageError) throw new Error(storageError.message);

            const { error: dbError } = await supabase.from('contratos_terceirizados_anexos').delete().eq('id', file.id);
            if (dbError) throw new Error(dbError.message);

            fetchData();
        };

        toast.warning(`Tem certeza que deseja excluir o documento "${file.nome_arquivo}"?`, {
            action: {
                label: 'Confirmar',
                onClick: () => toast.promise(deleteAction(), {
                    loading: 'Excluindo documento...',
                    success: 'Arquivo excluído com sucesso.',
                    error: (err) => `Erro: ${err.message}`
                })
            },
            cancel: { label: 'Cancelar' },
            duration: 10000,
        });
    };

    const handleDownload = async (file) => {
        const { data } = supabase.storage.from('contratos-documentos').getPublicUrl(file.caminho_arquivo);
        window.open(data.publicUrl, '_blank');
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header da Seção */}
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBoxOpen} className="text-blue-500" />
                        Documentação
                    </h3>
                    <p className="text-sm text-gray-500">Gerencie contratos assinados, aditivos e notas fiscais.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Adicionar Documento
                </button>
            </div>

            {/* Lista de Arquivos com FileListView Global */}
            <div className="bg-white rounded-lg">
                {loadingData ? (
                    <div className="text-center py-10 text-gray-400">Carregando...</div>
                ) : (
                    <FileListView
                        files={anexos.map(anexo => ({
                            id: anexo.id,
                            nome_arquivo: anexo.nome_arquivo,
                            caminho_arquivo: anexo.caminho_arquivo,
                            tamanho_bytes: anexo.tamanho_bytes,
                            tipo: { descricao: anexo.tipo?.descricao || 'Documento' },
                            public_url: supabase.storage.from('contratos-documentos').getPublicUrl(anexo.caminho_arquivo).data.publicUrl
                        }))}
                        onDelete={handleDelete}
                        onDownload={handleDownload}
                        onView={handleDownload}
                        emptyMessage="Nenhum documento anexado ainda. Clique em Adicionar Documento para começar."
                    />
                )}
            </div>

            {/* MODAL DE UPLOAD */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-blue-600" />
                                Novo Documento
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <FontAwesomeIcon icon={faTimes} size="lg" />
                            </button>
                        </div>

                        {/* Modal Body em form de Lista */}
                        <div className="p-6 bg-gray-50 flex-1 overflow-hidden">
                            <UppyListUploader
                                bucketName="contratos-documentos"
                                folderPath={`contratos/${contratoId}`}
                                onUploadSuccess={handleUploadSuccess}
                                onUploadComplete={handleUploadComplete}
                                tiposDocumento={tiposDocumento}
                            />
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}