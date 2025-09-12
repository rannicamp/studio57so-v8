'use client';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext'; // <-- CORREÇÃO APLICADA AQUI
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faFilePdf, faFileLines, faTrashAlt, faSpinner, faBrain, faShareSquare, faLock } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Componente para o Switch (Toggle)
const ToggleSwitch = ({ checked, onChange, disabled }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
);

export default function TreinamentoIAPage() {
    const router = useRouter();
    const { hasPermission, loading: authLoading } = useAuth();

    // --- LÓGICA DE SEGURANÇA ADICIONADA AQUI ---
    const canViewPage = hasPermission('config_treinamento_ia', 'pode_ver');

    useEffect(() => {
        if (!authLoading && !canViewPage) {
            router.push('/');
        }
    }, [authLoading, canViewPage, router]);


    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [selectedEmpreendimento, setSelectedEmpreendimento] = useState('');
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [anexos, setAnexos] = useState([]);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [savingPrompt, setSavingPrompt] = useState(false);
    const [loadingPrompt, setLoadingPrompt] = useState(true);
    const [dragging, setDragging] = useState(false);

    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        setFiles(prev => [...prev, ...droppedFiles]);
    };
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selectedFiles]);
    };
    const removeFile = (indexToRemove) => setFiles(files.filter((_, index) => index !== indexToRemove));

    const fetchSystemPrompt = useCallback(async () => {
        if (!canViewPage) return;
        setLoadingPrompt(true);
        const { data } = await supabase.from('configuracoes_ia').select('system_prompt').eq('nome', 'stella_whatsapp').single();
        if (data) setSystemPrompt(data.system_prompt);
        setLoadingPrompt(false);
    }, [supabase, canViewPage]);

    const handleSavePrompt = useCallback(async () => {
        setSavingPrompt(true);
        const { error } = await supabase.from('configuracoes_ia').update({ system_prompt: systemPrompt, updated_at: new Date().toISOString() }).eq('nome', 'stella_whatsapp');
        if (error) { toast.error("Erro ao salvar: " + error.message); } else { toast.success("Instruções salvas!"); }
        setSavingPrompt(false);
    }, [supabase, systemPrompt]);

    const fetchEmpreendimentos = useCallback(async () => {
        if (!canViewPage) return;
        const { data } = await supabase.from('empreendimentos').select('id, nome');
        if (data) {
            setEmpreendimentos(data);
            if (data.length > 0) setSelectedEmpreendimento(data[0].id);
        }
    }, [supabase, canViewPage]);

    const fetchAnexosDoEmpreendimento = useCallback(async (empreendimentoId) => {
        if (!empreendimentoId || !canViewPage) return;
        const { data, error } = await supabase.from('empreendimento_anexos').select('id, nome_arquivo, status, created_at, usar_para_pesquisa, pode_enviar_anexo').eq('empreendimento_id', empreendimentoId).order('created_at', { ascending: false });
        if (error) { toast.error("Erro ao buscar anexos: " + error.message); setAnexos([]); } else { setAnexos(data || []); }
    }, [supabase, canViewPage]);

    const handleToggleAnexoPermission = async (anexoId, column, newValue) => {
        const originalAnexos = [...anexos];
        setAnexos(prevAnexos => prevAnexos.map(anexo => anexo.id === anexoId ? { ...anexo, [column]: newValue } : anexo));
        const { error } = await supabase.from('empreendimento_anexos').update({ [column]: newValue }).eq('id', anexoId);
        if (error) {
            toast.error(`Erro ao atualizar: ${error.message}`);
            setAnexos(originalAnexos);
        } else {
            toast.success("Permissão atualizada!");
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !selectedEmpreendimento) { toast.error('Selecione um empreendimento e um arquivo.'); return; }
        setUploading(true);
        for (const file of files) {
            const promise = (async () => {
                const filePath = `${selectedEmpreendimento}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage.from('empreendimento-anexos').upload(filePath, file, { upsert: true });
                if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);
                const { data: newAnexo, error: dbError } = await supabase.from('empreendimento_anexos').insert({ empreendimento_id: selectedEmpreendimento, caminho_arquivo: filePath, nome_arquivo: file.name, status: 'Pendente' }).select().single();
                if (dbError) throw new Error(`Registro falhou: ${dbError.message}`);
                await fetch('/api/empreendimentos/process-anexo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anexoId: newAnexo.id }) });
                return `${file.name} enviado!`;
            })();
            toast.promise(promise, { loading: `Enviando ${file.name}...`, success: (msg) => msg, error: (err) => err.message });
        }
        await Promise.allSettled(files.map(() => {}));
        setUploading(false);
        setFiles([]);
        fetchAnexosDoEmpreendimento(selectedEmpreendimento);
    };
    
    useEffect(() => {
        if(canViewPage) {
            fetchEmpreendimentos();
            fetchSystemPrompt();
        }
    }, [canViewPage, fetchEmpreendimentos, fetchSystemPrompt]);

    useEffect(() => {
        if (selectedEmpreendimento && canViewPage) fetchAnexosDoEmpreendimento(selectedEmpreendimento);
    }, [selectedEmpreendimento, canViewPage, fetchAnexosDoEmpreendimento]);

    // --- BLOCOS DE RENDERIZAÇÃO CONDICIONAL ---
    if (authLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-gray-600">Verificando permissões...</span>
            </div>
        );
    }

    if (!canViewPage) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para acessar esta página.</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Personalidade da Stella (WhatsApp)</h2>
                {loadingPrompt ? ( <div className="flex justify-center items-center h-40"><FontAwesomeIcon icon={faSpinner} className="fa-spin text-3xl text-gray-500" /></div> ) : (
                    <>
                        <p className="text-sm text-gray-500 mb-4">Instruções de como a IA deve se comportar, seu tom de voz e as regras que ela deve seguir.</p>
                        <textarea id="system-prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={10} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        <div className="flex justify-end mt-4">
                            <button onClick={handleSavePrompt} disabled={savingPrompt} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center">
                                {savingPrompt && <FontAwesomeIcon icon={faSpinner} className="fa-spin mr-2" />}
                                Salvar
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Fonte de Conhecimento da Stella</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-800">1. Enviar Novos Arquivos</h3>
                        <div>
                            <label className="block text-sm font-medium">Selecione o Empreendimento</label>
                            <select className="w-full mt-1 rounded-md border-gray-300 shadow-sm" value={selectedEmpreendimento} onChange={(e) => setSelectedEmpreendimento(e.target.value)}>
                                {empreendimentos.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
                            </select>
                        </div>
                        <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`relative p-10 border-2 border-dashed rounded-md text-center cursor-pointer ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                            <input type="file" id="fileUpload" multiple className="hidden" onChange={handleFileChange} />
                            <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-gray-400 mb-2" />
                                <p className="text-gray-500">Arraste e solte os arquivos aqui</p>
                            </label>
                        </div>
                        {files.length > 0 && (
                            <div className="space-y-2">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between text-sm">
                                        <span className="truncate">{file.name}</span>
                                        <button onClick={() => removeFile(index)}><FontAwesomeIcon icon={faTrashAlt} className="text-red-500"/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end mt-4">
                            <button onClick={handleUpload} disabled={uploading || files.length === 0 || !selectedEmpreendimento} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center">
                                {uploading && <FontAwesomeIcon icon={faSpinner} className="fa-spin mr-2" />}
                                Enviar
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-800">2. Gerenciar Arquivos Enviados</h3>
                        <div className="max-h-96 overflow-y-auto border rounded-lg p-3 space-y-3">
                            {anexos.length > 0 ? anexos.map(anexo => (
                                <div key={anexo.id} className="bg-gray-50 p-3 rounded-md border">
                                    <p className="font-medium text-sm truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p>
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t">
                                        <div className="flex items-center gap-2">
                                            <ToggleSwitch checked={anexo.usar_para_pesquisa} onChange={(e) => handleToggleAnexoPermission(anexo.id, 'usar_para_pesquisa', e.target.checked)} />
                                            <span className="text-xs font-medium text-gray-600"><FontAwesomeIcon icon={faBrain} /> Pesquisa</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <ToggleSwitch checked={anexo.pode_enviar_anexo} onChange={(e) => handleToggleAnexoPermission(anexo.id, 'pode_enviar_anexo', e.target.checked)} />
                                            <span className="text-xs font-medium text-gray-600"><FontAwesomeIcon icon={faShareSquare} /> Enviar</span>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-gray-500 text-center py-4">Nenhum anexo.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}