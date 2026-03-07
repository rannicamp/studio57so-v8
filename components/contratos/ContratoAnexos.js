//components\contratos\ContratoAnexos.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faTrash, faEye, faFileLines, faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import UppyListUploader from '@/components/ui/UppyListUploader';

export default function ContratoAnexos({ contratoId, onUpdate }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [anexos, setAnexos] = useState([]);
    const [loadingAnexos, setLoadingAnexos] = useState(true);
    const [showUploader, setShowUploader] = useState(false);

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
                setAnexos(data || []);
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
            setAnexos(prev => [newAnexo, ...prev]);
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
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPaperclip} /> Anexos do Contrato
                </h3>
                <button
                    onClick={() => setShowUploader(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-sm transition"
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
                ) : anexos.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">Nenhum anexo encontrado.</p>
                ) : (
                    <ul className="divide-y border rounded-md mt-2">
                        {anexos.map(anexo => (
                            <li key={anexo.id} className="p-3 flex justify-between items-center text-sm hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <FontAwesomeIcon icon={faFileLines} className="text-gray-400" />
                                    <div>
                                        <p className="font-medium">{anexo.nome_arquivo}</p>
                                        <p className="text-xs text-gray-500">{anexo.tipo_documento}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleView(anexo.caminho_arquivo)} className="text-blue-600 hover:text-blue-800" title="Visualizar"><FontAwesomeIcon icon={faEye} /></button>
                                    <button onClick={() => handleDelete(anexo)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

