'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faCloudUploadAlt, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimUploadModal({ 
    isOpen, 
    onClose, 
    preSelectedContext, 
    onSuccess,
    mode = 'create', 
    fileToUpdate = null 
}) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id: organizacaoId } = useAuth();

    const [selectedEmpresa, setSelectedEmpresa] = useState('');
    const [selectedObra, setSelectedObra] = useState('');
    const [selectedDisciplina, setSelectedDisciplina] = useState('');
    const [file, setFile] = useState(null);
    
    const [isUploading, setIsUploading] = useState(false);
    const [statusStep, setStatusStep] = useState('');

    // 1. BUSCA DE DADOS
    const { data: dropdownData } = useQuery({
        queryKey: ['bimUploadDropdowns', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return null;
            const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('razao_social');
            const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
            const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
            return { empresas: empresas || [], disciplinas: disciplinas || [], todasObras: obras || [] };
        },
        enabled: isOpen && mode === 'create' && !!organizacaoId,
        staleTime: 1000 * 60 * 5 
    });

    const obrasFiltradas = dropdownData?.todasObras?.filter(o => String(o.empresa_proprietaria_id) === String(selectedEmpresa)) || [];

    useEffect(() => {
        if (isOpen) {
            if (mode === 'create' && preSelectedContext) {
                if (preSelectedContext.empresaId) setSelectedEmpresa(preSelectedContext.empresaId.toString());
                if (preSelectedContext.obraId) setSelectedObra(preSelectedContext.obraId.toString());
                if (preSelectedContext.type === 'folder') setSelectedDisciplina(preSelectedContext.id.toString());
            }
        } else {
            setFile(null);
            setIsUploading(false);
            setStatusStep('');
        }
    }, [isOpen, preSelectedContext, mode]);

    // --- FUNÇÃO DE UPLOAD CORRIGIDA (CLIENT-SIDE -> SUPABASE -> LINK -> API) ---
    const handleDirectUpload = async () => {
        if (!file) return toast.error("Selecione um arquivo .RVT!");
        
        if (mode === 'create') {
            if (!selectedDisciplina || !selectedObra) return toast.error("Selecione Obra e Disciplina!");
        }

        setIsUploading(true);
        
        try {
            // PASSO 1: UPLOAD DIRETO PARA O SUPABASE STORAGE
            setStatusStep('1/3: Enviando arquivo para a nuvem...');
            
            // Gera nome único para evitar colisão
            const fileExt = file.name.split('.').pop();
            const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const storagePath = `${uniqueName}`; // Caminho dentro do bucket bim-arquivos

            // Faz o upload binário direto para o Supabase (Bypass do seu servidor)
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('bim-arquivos') // Nome exato do bucket que você confirmou
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false 
                });

            if (uploadError) throw new Error(`Erro Storage: ${uploadError.message}`);

            // Pega a URL pública para o servidor baixar
            const { data: publicUrlData } = supabase.storage
                .from('bim-arquivos')
                .getPublicUrl(storagePath);

            const fileUrl = publicUrlData.publicUrl;

            // PASSO 2: ENVIAR APENAS O LINK PARA O SEU SERVIDOR
            setStatusStep('2/3: Processando na Autodesk...');

            const res = await fetch('/api/aps/upload', { // Mesma rota, mas agora mandamos JSON
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' // <--- AQUI ESTÁ A CHAVE DO SUCESSO
                },
                body: JSON.stringify({ 
                    fileUrl: fileUrl, 
                    fileName: file.name 
                }),
            });

            // Tratamento de resposta
            let apiData;
            try {
                apiData = await res.json();
            } catch (e) {
                console.error("Erro parse JSON:", e);
                throw new Error("Erro fatal no servidor (500). Verifique logs do backend.");
            }
            
            if (!res.ok) throw new Error(apiData.error || "Falha na tradução Autodesk");
            if (!apiData.urn) throw new Error("Autodesk não retornou URN.");

            // PASSO 3: SALVAR NO BANCO DE DADOS
            setStatusStep('3/3: Salvando registro...');

            const updateData = {
                urn_autodesk: apiData.urn,
                nome_arquivo: file.name,
                tamanho_bytes: file.size,
                status: 'Concluido',
                caminho_storage: storagePath,
                criado_em: new Date().toISOString()
            };

            if (mode === 'version' && fileToUpdate) {
                // Update
                const { error: dbError } = await supabase
                    .from('projetos_bim')
                    .update({
                        ...updateData,
                        versao: (fileToUpdate.versao || 1) + 1
                    })
                    .eq('id', fileToUpdate.id);
                if (dbError) throw dbError;
                toast.success(`Versão atualizada para v${(fileToUpdate.versao || 1) + 1}!`);
            } else {
                // Insert
                const { error: dbError } = await supabase
                    .from('projetos_bim')
                    .insert({
                        ...updateData,
                        empresa_id: selectedEmpresa,
                        empreendimento_id: selectedObra,
                        disciplina_id: selectedDisciplina,
                        organizacao_id: organizacaoId,
                        criado_por: user.id,
                        versao: 1
                    });
                if (dbError) throw dbError;
                toast.success("Projeto criado com sucesso!");
            }
            
            queryClient.invalidateQueries({ queryKey: ['bimStructureWithFiles', organizacaoId] });
            if (onSuccess) onSuccess();
            onClose();

        } catch (err) {
            console.error("Erro no upload:", err);
            toast.error(`Falha: ${err.message}`);
        } finally {
            setIsUploading(false);
            setStatusStep('');
        }
    };

    if (!isOpen) return null;
    const isVersionMode = mode === 'version';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all scale-100">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={isVersionMode ? faSyncAlt : faCloudUploadAlt} className="text-blue-600" />
                        {isVersionMode ? 'Atualizar Versão' : 'Novo Upload BIM'}
                    </h3>
                    <button onClick={onClose} disabled={isUploading} className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                        <FontAwesomeIcon icon={faTimes}/>
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {!isVersionMode ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Empresa</label>
                                <select 
                                    value={selectedEmpresa} 
                                    onChange={(e) => {setSelectedEmpresa(e.target.value); setSelectedObra('');}} 
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white outline-none"
                                    disabled={isUploading}
                                >
                                    <option value="">Selecione...</option>
                                    {dropdownData?.empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Obra</label>
                                <select 
                                    value={selectedObra} 
                                    onChange={(e) => setSelectedObra(e.target.value)} 
                                    disabled={!selectedEmpresa || isUploading} 
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm disabled:bg-gray-100 bg-white outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Disciplina</label>
                                <select 
                                    value={selectedDisciplina} 
                                    onChange={(e) => setSelectedDisciplina(e.target.value)} 
                                    disabled={isUploading}
                                    className="w-full border border-blue-200 rounded-lg p-2 text-sm font-bold text-blue-700 bg-blue-50/50 outline-none"
                                >
                                    <option value="">Selecione a Pasta...</option>
                                    {dropdownData?.disciplinas.map(d => <option key={d.id} value={d.id}>{d.sigla} - {d.nome}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <p className="text-xs text-blue-800 font-bold mb-1">Substituindo Arquivo:</p>
                            <p className="text-sm text-gray-700 truncate">{fileToUpdate?.nome_arquivo}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">v{fileToUpdate?.versao}</span>
                                <FontAwesomeIcon icon={faSyncAlt} className="text-gray-400 text-xs" />
                                <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">v{(fileToUpdate?.versao || 1) + 1}</span>
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <input 
                            type="file" 
                            id="bim-file-input" 
                            accept=".rvt" 
                            className="hidden" 
                            onChange={(e) => setFile(e.target.files[0])} 
                            disabled={isUploading}
                        />
                        <label 
                            htmlFor="bim-file-input" 
                            className={`
                                block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                                ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
                                ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3 transition-colors ${file ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-2xl" />
                            </div>
                            
                            {file ? (
                                <div>
                                    <p className="text-sm font-bold text-green-700 break-all">{file.name}</p>
                                    <p className="text-xs text-green-600 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm font-bold text-gray-600">Clique para selecionar</p>
                                    <p className="text-xs text-gray-400 mt-1">Suporta apenas arquivos .RVT</p>
                                </div>
                            )}
                        </label>
                    </div>

                    {isUploading && (
                        <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-center gap-3 border border-blue-100">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />
                            <span className="text-xs font-bold text-blue-700 animate-pulse">{statusStep}</span>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} disabled={isUploading} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all">Cancelar</button>
                    <button 
                        onClick={handleDirectUpload} 
                        disabled={isUploading || !file || (!isVersionMode && (!selectedDisciplina || !selectedObra))}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                    >
                        {isUploading ? 'Processando...' : (isVersionMode ? 'Atualizar Versão' : 'Confirmar Upload')}
                    </button>
                </div>
            </div>
        </div>
    );
}