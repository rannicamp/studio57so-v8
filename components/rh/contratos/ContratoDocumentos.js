"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faCloudUploadAlt, faBoxOpen, faFilePdf, faFileImage, faDownload, faTrash, faPlus, faTimes, faSpinner, faTag, faAlignLeft 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Imports do Uppy (Mantendo o Anti-Crash)
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

// Import CSS do Uppy
const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// Dicionário PT-BR
const pt_BR = {
  strings: {
    addMore: 'Adicionar mais',
    browse: 'selecione do computador',
    cancel: 'Cancelar',
    complete: 'Concluído',
    dashboardTitle: 'Anexar Arquivo',
    dropPasteFiles: 'Arraste o arquivo aqui ou %{browse}',
    removeFile: 'Remover',
    upload: 'Salvar Arquivo',
    xFilesSelected: {
      0: '%{smart_count} arquivo selecionado',
      1: '%{smart_count} arquivos selecionados'
    },
  }
};

export default function ContratoDocumentos({ contratoId }) {
    const supabase = createClient();
    const { user } = useAuth();
    
    // Estados
    const [anexos, setAnexos] = useState([]);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    
    // Estados do Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTipo, setSelectedTipo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const dashboardContainerRef = useRef(null);

    // --- UPPY SETUP ---
    const [uppy] = useState(() => {
        if (typeof window === 'undefined') return null;
        const instance = new Uppy({
            id: 'contratos-uploader-clean',
            locale: pt_BR,
            autoProceed: false, // Nós controlamos o upload
            restrictions: { 
                maxFileSize: 20 * 1024 * 1024,
                maxNumberOfFiles: 1, // Um por vez para garantir a categoria correta
                allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
            }
        });
        // Removemos a Webcam, mantemos apenas o GoldenRetriever para segurança
        instance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });
        return instance;
    });

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

    // --- UPPY DASHBOARD RENDER ---
    useEffect(() => {
        if (!uppy || !isModalOpen || !dashboardContainerRef.current) return;
        
        // Garante que o plugin só é adicionado uma vez
        if (!uppy.getPlugin('Dashboard')) {
            uppy.use(DashboardPlugin, {
                target: dashboardContainerRef.current,
                inline: true,
                width: '100%',
                height: 200, // Menor e mais compacto
                hideUploadButton: true, // Escondemos o botão nativo para usar o nosso "Salvar"
                hideRetryButton: true,
                hidePauseResumeButton: true,
                showProgressDetails: true,
                proudlyDisplayPoweredByUppy: false,
            });
        }
    }, [uppy, isModalOpen]);

    // --- UPLOAD HANDLER ---
    const handleSalvarArquivo = async () => {
        if (!selectedTipo) return toast.warning("Selecione o tipo do documento.");
        const files = uppy.getFiles();
        if (files.length === 0) return toast.warning("Anexe um arquivo.");

        setIsUploading(true);
        
        // Vamos processar o arquivo manualmente para ter controle total
        const file = files[0];
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${contratoId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            // 1. Upload Físico
            const { error: uploadError } = await supabase.storage
                .from('contratos-documentos')
                .upload(fileName, file.data);

            if (uploadError) throw uploadError;

            // 2. Insert no Banco com Categoria e Descrição
            const { error: dbError } = await supabase
                .from('contratos_terceirizados_anexos')
                .insert([{
                    contrato_id: contratoId,
                    tipo_documento_id: selectedTipo,
                    descricao: descricao,
                    nome_arquivo: file.name,
                    caminho_arquivo: fileName,
                    tipo_arquivo: file.type,
                    tamanho_bytes: file.size,
                    uploaded_by: user.id
                }]);

            if (dbError) throw dbError;

            toast.success("Documento salvo com sucesso!");
            
            // Limpeza
            uppy.cancelAll();
            setDescricao('');
            setSelectedTipo('');
            setIsModalOpen(false);
            fetchData(); // Recarrega a lista

        } catch (error) {
            console.error("Erro upload:", error);
            toast.error("Erro ao salvar documento.");
        } finally {
            setIsUploading(false);
        }
    };

    // --- ACTIONS ---
    const handleDelete = async (id, path) => {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;
        try {
            await supabase.storage.from('contratos-documentos').remove([path]);
            await supabase.from('contratos_terceirizados_anexos').delete().eq('id', id);
            toast.success('Arquivo excluído.');
            fetchData();
        } catch (e) { toast.error('Erro ao excluir.'); }
    };

    const handleDownload = async (path) => {
        const { data } = supabase.storage.from('contratos-documentos').getPublicUrl(path);
        window.open(data.publicUrl, '_blank');
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <link href={UPPY_CSS_URL} rel="stylesheet" />

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

            {/* Lista de Arquivos */}
            {loadingData ? (
                <div className="text-center py-10 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>
            ) : anexos.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                    <p className="text-gray-400 font-medium">Nenhum documento anexado ainda.</p>
                    <p className="text-xs text-gray-400 mt-1">Clique em "Adicionar Documento" para começar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {anexos.map(anexo => (
                        <div key={anexo.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all group">
                            
                            {/* Ícone e Info Principal */}
                            <div className="flex items-start gap-4 mb-3 md:mb-0">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${
                                    anexo.tipo_arquivo?.includes('pdf') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                                }`}>
                                    <FontAwesomeIcon icon={anexo.tipo_arquivo?.includes('image') ? faFileImage : faFilePdf} />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-gray-800 text-sm">
                                            {anexo.tipo?.descricao || anexo.nome_arquivo}
                                        </span>
                                        {anexo.tipo?.sigla && (
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase border border-gray-200">
                                                {anexo.tipo.sigla}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                        {anexo.descricao || "Sem descrição"}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Enviado em {new Date(anexo.created_at).toLocaleDateString()} às {new Date(anexo.created_at).toLocaleTimeString().slice(0,5)} • {(anexo.tamanho_bytes / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>

                            {/* Ações */}
                            <div className="flex items-center gap-2 self-end md:self-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleDownload(anexo.caminho_arquivo)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Baixar"
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(anexo.id, anexo.caminho_arquivo)}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Excluir"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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

                        {/* Modal Body */}
                        <div className="p-6 space-y-5 overflow-y-auto">
                            
                            {/* Seleção de Tipo */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <FontAwesomeIcon icon={faTag} className="mr-1 text-gray-400" />
                                    Tipo do Documento <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedTipo}
                                    onChange={(e) => setSelectedTipo(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                >
                                    <option value="">Selecione uma categoria...</option>
                                    {tiposDocumento.map(tipo => (
                                        <option key={tipo.id} value={tipo.id}>
                                            {tipo.sigla} - {tipo.descricao}
                                        </option>
                                    ))}
                                </select>
                                {tiposDocumento.length === 0 && (
                                    <p className="text-xs text-orange-500 mt-1">
                                        Nenhum tipo cadastrado. Vá em Configurações &gt; Tipos de Documento.
                                    </p>
                                )}
                            </div>

                            {/* Descrição */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <FontAwesomeIcon icon={faAlignLeft} className="mr-1 text-gray-400" />
                                    Descrição / Observação
                                </label>
                                <input
                                    type="text"
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Ex: Contrato assinado pelo diretor..."
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Área Uppy Simplificada */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo</label>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div ref={dashboardContainerRef} className="uppy-dashboard-custom" />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSalvarArquivo}
                                disabled={isUploading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <FontAwesomeIcon icon={faSpinner} spin />
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    'Salvar Documento'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}