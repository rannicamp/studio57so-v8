// components/atividades/AtividadeAnexos.js
"use client";

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext'; // 1. Importar o useAuth
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faFileLines, faTrashAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function AtividadeAnexos({ activityId }) {
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para pegar o ID da organização
    const organizacaoId = user?.organizacao_id;

    const [anexos, setAnexos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fetchAnexos = useCallback(async () => {
        if (!activityId || !organizacaoId) return;
        // =================================================================================
        // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
        // O PORQUÊ: Adicionamos o filtro por `organizacao_id` para garantir que
        // apenas os anexos da organização correta sejam buscados e exibidos.
        // =================================================================================
        const { data, error } = await supabase
            .from('activity_anexos')
            .select('*')
            .eq('activity_id', activityId)
            .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
            .order('created_at', { ascending: true });
        
        if (error) {
            toast.error('Erro ao buscar anexos: ' + error.message);
        } else {
            setAnexos(data || []);
        }
    }, [activityId, supabase, organizacaoId]);

    useEffect(() => {
        fetchAnexos();
    }, [fetchAnexos]);

    const handleFilesUpload = useCallback(async (files) => {
        if (!activityId) {
            toast.error("É necessário salvar a atividade antes de anexar arquivos.");
            return;
        }
        if (!organizacaoId) {
            toast.error("Erro de segurança: Organização não identificada.");
            return;
        }

        setUploading(true);
        const uploadPromises = Array.from(files).map(async (file) => {
            const sanitizedFileName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\-]/g, '_');
            const filePath = `${activityId}/${Date.now()}_${sanitizedFileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('activity-anexos')
                .upload(filePath, file);

            if (uploadError) {
                throw new Error(`Falha no upload do arquivo ${file.name}: ${uploadError.message}`);
            }
            
            // =================================================================================
            // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
            // O PORQUÊ: Ao registrar o anexo no banco, "etiquetamos" ele com
            // o `organizacao_id` para garantir que ele pertença à organização correta.
            // =================================================================================
            const { error: insertError } = await supabase
                .from('activity_anexos')
                .insert({
                    activity_id: activityId,
                    file_name: file.name,
                    file_path: filePath,
                    file_type: file.type,
                    file_size: file.size,
                    organizacao_id: organizacaoId, // <-- ETIQUETA DE SEGURANÇA!
                });

            if (insertError) {
                await supabase.storage.from('activity-anexos').remove([filePath]);
                throw new Error(`Falha ao registrar o anexo ${file.name} no banco de dados.`);
            }
            return file.name;
        });

        try {
            const results = await Promise.all(uploadPromises.map(p => p.catch(e => e)));
            const successfulUploads = results.filter(r => typeof r === 'string');
            const failedUploads = results.filter(r => r instanceof Error);

            if (successfulUploads.length > 0) {
                toast.success(`${successfulUploads.length} arquivo(s) enviados com sucesso!`);
            }
            if (failedUploads.length > 0) {
                failedUploads.forEach(err => toast.error(err.message));
            }
            fetchAnexos();
        } finally {
            setUploading(false);
        }
    }, [activityId, supabase, fetchAnexos, organizacaoId]);

    const handleDragEvents = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesUpload(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    const handleDelete = async (anexo) => {
        const promise = async () => {
            // Deleta o arquivo do storage
            await supabase.storage.from('activity-anexos').remove([anexo.file_path]);

            // Deleta o registro do banco
            const { error: dbError } = await supabase.from('activity_anexos').delete().eq('id', anexo.id);

            if (dbError) {
                throw new Error('Erro ao remover o registro do anexo: ' + dbError.message);
            }
        };

        toast("Confirmar Exclusão", {
            description: `Tem certeza que deseja excluir o anexo "${anexo.file_name}"?`,
            action: {
                label: "Excluir",
                onClick: () => toast.promise(promise(), {
                    loading: 'Excluindo anexo...',
                    success: () => {
                        fetchAnexos();
                        return 'Anexo excluído com sucesso!';
                    },
                    error: (err) => err.message,
                })
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    const formatFileSize = (bytes) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4">
            <div 
                onDragEnter={handleDragEvents} 
                onDragLeave={handleDragEvents} 
                onDragOver={handleDragEvents} 
                onDrop={handleDrop} 
                className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
            >
                <input 
                    type="file" 
                    id="activity-anexo-upload" 
                    className="hidden" 
                    multiple
                    onChange={(e) => handleFilesUpload(e.target.files)} 
                />
                <label htmlFor="activity-anexo-upload" className="cursor-pointer">
                    <FontAwesomeIcon icon={faUpload} className="text-gray-500 text-2xl mb-2" />
                    <p className="text-sm text-gray-600">Arraste e solte arquivos aqui, ou <span className="font-semibold text-blue-600">clique para selecionar</span>.</p>
                </label>
            </div>

            <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-600">Anexos ({anexos.length})</h4>
                {uploading && <div className="text-center text-sm text-blue-600"><FontAwesomeIcon icon={faSpinner} spin /> Enviando...</div>}
                {anexos.length > 0 ? (
                    <ul className="border rounded-md divide-y max-h-48 overflow-y-auto">
                        {anexos.map(anexo => (
                            <li key={anexo.id} className="p-2 flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FontAwesomeIcon icon={faFileLines} className="text-gray-500 flex-shrink-0" />
                                    <span className="truncate" title={anexo.file_name}>{anexo.file_name}</span>
                                    <span className="text-xs text-gray-400 flex-shrink-0">({formatFileSize(anexo.file_size)})</span>
                                </div>
                                <button onClick={() => handleDelete(anexo)} className="text-red-500 hover:text-red-700 ml-2">
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    !uploading && <p className="text-xs text-gray-500 text-center py-4">Nenhum anexo adicionado.</p>
                )}
            </div>
        </div>
    );
}