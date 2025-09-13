//components\contratos\ContratoAnexos.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faTrash, faEye, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function ContratoAnexos({ contratoId, onUpdate }) {
    const supabase = createClient();
    const { user } = useAuth();
    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: Pegamos a "chave mestra" da organização aqui para usar em todas as
    // operações de banco de dados, garantindo a segurança dos dados.
    // =================================================================================
    const organizacaoId = user?.organizacao_id;
    
    const [anexos, setAnexos] = useState([]);
    const [loadingAnexos, setLoadingAnexos] = useState(true);
    
    const [file, setFile] = useState(null);
    const [tipoDocumento, setTipoDocumento] = useState('Contrato Assinado');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchAnexos = async () => {
            if (!contratoId || !organizacaoId) return;
            setLoadingAnexos(true);
            // =================================================================================
            // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
            // O PORQUÊ: Adicionamos o filtro `.eq('organizacao_id', organizacaoId)` para
            // garantir que a busca traga apenas os anexos da organização correta.
            // =================================================================================
            const { data, error } = await supabase
                .from('contrato_anexos')
                .select('*')
                .eq('contrato_id', contratoId)
                .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
                .order('created_at', { ascending: false });
            
            if (error) {
                toast.error("Erro ao carregar anexos: " + error.message);
            } else {
                setAnexos(data || []);
            }
            setLoadingAnexos(false);
        };
        fetchAnexos();
    }, [contratoId, supabase, organizacaoId]); // Adicionamos organizacaoId como dependência

    const handleUpload = async () => {
        if (!file) {
            toast.error("Por favor, selecione um arquivo.");
            return;
        }
        if (!user || !organizacaoId) {
            toast.error("Usuário ou organização não autenticados.");
            return;
        }

        setIsUploading(true);
        const promise = new Promise(async (resolve, reject) => {
            const fileExtension = file.name.split('.').pop();
            // Adicionamos o organizacaoId ao caminho do arquivo para uma camada extra de isolamento no storage
            const newFileName = `${organizacaoId}/contrato_${contratoId}/${tipoDocumento.replace(/ /g, '_')}_${Date.now()}.${fileExtension}`;

            const { error: uploadError } = await supabase.storage
                .from('empreendimento-anexos')
                .upload(newFileName, file);
            
            if (uploadError) return reject(uploadError);

            // =================================================================================
            // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
            // O PORQUÊ: Ao inserir o registro do anexo no banco, "etiquetamos" ele com
            // o `organizacao_id` para garantir que ele pertença à organização correta.
            // =================================================================================
            const { data: newAnexo, error: dbError } = await supabase
                .from('contrato_anexos')
                .insert({
                    contrato_id: contratoId,
                    caminho_arquivo: newFileName,
                    nome_arquivo: file.name,
                    tipo_documento: tipoDocumento,
                    usuario_id: user.id,
                    organizacao_id: organizacaoId // <-- ETIQUETA DE SEGURANÇA!
                })
                .select()
                .single();
            
            if (dbError) return reject(dbError);
            
            setAnexos(prev => [newAnexo, ...prev]);
            resolve("Anexo enviado com sucesso!");
        });

        toast.promise(promise, {
            loading: 'Enviando arquivo...',
            success: (msg) => {
                setFile(null);
                if(fileInputRef.current) fileInputRef.current.value = "";
                return msg;
            },
            error: (err) => `Erro ao enviar: ${err.message}`,
            finally: () => setIsUploading(false),
        });
    };

    const handleDelete = async (anexo) => {
        // =================================================================================
        // ATUALIZAÇÃO DE UX (troca de window.confirm por toast)
        // O PORQUÊ: Uma confirmação mais elegante e segura para uma ação destrutiva.
        // =================================================================================
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
            <h3 className="text-xl font-bold text-gray-800">Anexos do Contrato</h3>
            
            <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Arquivo</label>
                        <input type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files[0])} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tipo</label>
                        <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                            <option>Contrato Assinado</option>
                            <option>Plano de Pagamento</option>
                            <option>Comprovante de Renda</option>
                            <option>Documento Pessoal</option>
                            <option>Outro</option>
                        </select>
                    </div>
                </div>
                <div className="text-right mt-4">
                    <button onClick={handleUpload} disabled={isUploading || !file} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
                        <FontAwesomeIcon icon={isUploading ? faSpinner : faUpload} spin={isUploading} />
                        {isUploading ? 'Enviando...' : 'Adicionar Anexo'}
                    </button>
                </div>
            </div>

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