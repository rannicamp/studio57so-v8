//components\contratos\ContratoAnexos.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faTrash, faEye, faFileLines, faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import UppyListUploader from '@/components/ui/UppyListUploader';
import GerenciadorAnexosGlobal from '@/components/shared/GerenciadorAnexosGlobal';
import FilePreviewModal from '@/components/shared/FilePreviewModal';

export default function ContratoAnexos({ contratoId, onUpdate }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [anexos, setAnexos] = useState([]);
    const [loadingAnexos, setLoadingAnexos] = useState(true);
    const [showUploader, setShowUploader] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);

    useEffect(() => {
        const fetchAnexos = async () => {
            if (!contratoId || !organizacaoId) return;
            setLoadingAnexos(true);
            const { data, error } = await supabase
                .from('contrato_anexos')
                .select('*')
                .eq('contrato_id', contratoId)
                .eq('organizacao_id', organizacaoId)
                .order('created_at', { ascending: false });

            if (error) {
                toast.error("Erro ao carregar anexos: " + error.message);
            } else {
                const signedPromises = (data || []).map(a => 
                    supabase.storage.from('empreendimento-anexos').createSignedUrl(a.caminho_arquivo, 3600)
                );
                const signedResults = await Promise.all(signedPromises);
                const anexosComUrl = (data || []).map((a, i) => ({
                    ...a,
                    public_url: signedResults[i].data?.signedUrl || null,
                }));
                setAnexos(anexosComUrl);
            }
            setLoadingAnexos(false);
        };
        fetchAnexos();
    }, [contratoId, supabase, organizacaoId]);

    const handleUploadSuccess = async (result) => {
        const { error: dbError, data: newAnexo } = await supabase
            .from('contrato_anexos')
            .insert({
                contrato_id: contratoId,
                caminho_arquivo: result.path,
                nome_arquivo: result.fileName,
                tipo_documento: result.descricao || 'Documento',
                usuario_id: user.id,
                organizacao_id: organizacaoId
            })
            .select()
            .single();

        if (dbError) {
            toast.error(`Erro ao registrar anexo: ${dbError.message}`);
        } else {
            const { data: urlData } = await supabase.storage.from('empreendimento-anexos').createSignedUrl(newAnexo.caminho_arquivo, 3600);
            const anexoComUrl = {
                ...newAnexo,
                public_url: urlData?.signedUrl
            };
            setAnexos(prev => [anexoComUrl, ...prev]);
            toast.success(`Anexo "${result.fileName}" adicionado!`);
            setShowUploader(false);
        }
    };

    const handleDelete = async (anexo) => {
        toast("Confirmar Exclusão", {
            description: `Tem certeza que deseja excluir o arquivo "${anexo.nome_arquivo}"?`,
            action: {
                label: "Excluir",
                onClick: () => {
                    const promise = new Promise(async (resolve, reject) => {
                        await supabase.storage.from('empreendimento-anexos').remove([anexo.caminho_arquivo]);
                        const { error } = await supabase.from('contrato_anexos').delete().eq('id', anexo.id);
                        if (error) return reject(error);
                        setAnexos(prev => prev.filter(a => a.id !== anexo.id));
                        resolve("Anexo excluído com sucesso!");
                    });

                    toast.promise(promise, {
                        loading: 'Excluindo anexo...',
                        success: (msg) => msg,
                        error: (err) => `Erro ao excluir: ${err.message}`,
                    });
                }
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const handleView = async (caminho) => {
        const { data } = await supabase.storage.from('empreendimento-anexos').createSignedUrl(caminho, 60);
        if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
        } else {
            toast.error("Não foi possível gerar o link de visualização.");
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-4">
            <FilePreviewModal
                anexo={previewFile}
                onClose={() => setPreviewFile(null)}
            />
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPaperclip} /> Anexos do Contrato
                </h3>
                <button
                    onClick={() => setShowUploader(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-bold rounded-lg hover:bg-black shadow-sm transition"
                >
                    <FontAwesomeIcon icon={faUpload} />
                    {showUploader ? 'Cancelar' : 'Novo Documento'}
                </button>
            </div>

            {showUploader && (
                <div className="border border-blue-100 rounded-xl overflow-hidden shadow-sm">
                    <UppyListUploader
                        bucketName="empreendimento-anexos"
                        folderPath={`${organizacaoId}/contratos/${contratoId}`}
                        hideClassificacao={false}
                        onUploadSuccess={handleUploadSuccess}
                    />
                </div>
            )}

            <div>
                {loadingAnexos ? (
                    <p className="text-center text-gray-500 py-4">Carregando anexos...</p>
                ) : (
                    <GerenciadorAnexosGlobal
                        anexos={anexos}
                        viewMode="list"
                        storageBucket="empreendimento-anexos"
                        onDelete={handleDelete}
                        onPreview={setPreviewFile}
                    />
                )}
            </div>
        </div>
    );
}

