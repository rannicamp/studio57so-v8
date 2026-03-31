//components\contratos\ContratoAnexos.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faTrash, faEye, faFileLines, faPaperclip, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import UppyListUploader from '@/components/ui/UppyListUploader';
import GerenciadorAnexosGlobal from '@/components/shared/GerenciadorAnexosGlobal';
import FilePreviewModal from '@/components/shared/FilePreviewModal';

export default function ContratoAnexos({ contratoId, onUpdate }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [anexos, setAnexos] = useState([]);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [loadingAnexos, setLoadingAnexos] = useState(true);
    const [showUploader, setShowUploader] = useState(false);
    
    // Estados do Padrão Ouro Modal
    const [previewFile, setPreviewFile] = useState(null);
    const [anexoParaEditar, setAnexoParaEditar] = useState(null);

    useEffect(() => {
        const fetchTipos = async () => {
            if (organizacaoId) {
                const { data } = await supabase.from('documento_tipos').select('*').order('descricao');
                setTiposDocumento(data || []);
            }
        };

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
        fetchTipos();
        fetchAnexos();
    }, [contratoId, supabase, organizacaoId]);

    const fetchOnlyAnexos = async () => {
        setLoadingAnexos(true);
        const { data } = await supabase.from('contrato_anexos').select('*').eq('contrato_id', contratoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
        if (data) {
            const signedPromises = data.map(a => supabase.storage.from('empreendimento-anexos').createSignedUrl(a.caminho_arquivo, 3600));
            const signedResults = await Promise.all(signedPromises);
            setAnexos(data.map((a, i) => ({ ...a, public_url: signedResults[i].data?.signedUrl || null })));
        }
        setLoadingAnexos(false);
    };

    const handleUploadSuccess = async (result) => {
        const tipoId = result.tipoDocumento;
        const tipoSelecionado = tiposDocumento.find(t => t.id == tipoId);
        const classificacao = tipoSelecionado ? tipoSelecionado.descricao : (result.descricao || 'Documento');

        const { error: dbError, data: newAnexo } = await supabase
            .from('contrato_anexos')
            .insert({
                contrato_id: contratoId,
                caminho_arquivo: result.path,
                nome_arquivo: result.fileName,
                tipo_documento: classificacao,
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">
                        {/* Header do Modal */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faUpload} className="text-blue-600" />
                                Lista Pessoal e Otimizada de Envios
                            </h2>
                            <button
                                onClick={() => setShowUploader(false)}
                                className="text-white/70 hover:text-white transition-colors p-1 rounded-md bg-gray-400 hover:bg-red-500"
                                title="Fechar"
                            >
                                <FontAwesomeIcon icon={faTimesCircle} className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Corpo do Modal em Lista - O Uploader List é Self Contained em height */}
                        <div className="p-6 bg-gray-50 flex-1 overflow-hidden">
                            <UppyListUploader
                                bucketName="empreendimento-anexos"
                                folderPath={`${organizacaoId}/contratos/${contratoId}`}
                                hideClassificacao={false}
                                onUploadSuccess={handleUploadSuccess}
                                tiposDocumento={tiposDocumento}
                                onUploadComplete={() => setShowUploader(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div>
                {loadingAnexos ? (
                    <p className="text-center text-gray-500 py-4">Carregando anexos...</p>
                ) : (
                    <GerenciadorAnexosGlobal
                        anexos={anexos.map(anexo => ({ ...anexo, descricao: anexo.tipo_documento }))}
                        tiposDocumento={tiposDocumento}
                        viewMode="list"
                        storageBucket="empreendimento-anexos"
                        onDelete={handleDelete}
                        onPreview={setPreviewFile}
                        onEdit={setAnexoParaEditar}
                    />
                )}
            </div>

            {anexoParaEditar && (
                <ModalEditarAnexo 
                    anexo={{
                        ...anexoParaEditar,
                        tipo_documento_id: tiposDocumento.find(t => t.descricao === anexoParaEditar.tipo_documento)?.id || "",
                    }}
                    isOpen={!!anexoParaEditar}
                    onClose={() => setAnexoParaEditar(null)}
                    onSuccess={() => { setAnexoParaEditar(null); fetchOnlyAnexos(); }}
                    tableName="contrato_anexos"
                    tiposDocumento={tiposDocumento}
                />
            )}
        </div>
    );
}

