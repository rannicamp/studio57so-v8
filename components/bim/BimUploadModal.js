// Caminho: components/bim/BimUploadModal.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faExclamationTriangle, faCloudUploadAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Protocolo Anti-Crash (Uppy)
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

export default function BimUploadModal({ isOpen, onClose, preSelectedContext, onSuccess }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id: organizacaoId } = useAuth();
    const dashboardRef = useRef(null);

    const [selectedEmpresa, setSelectedEmpresa] = useState('');
    const [selectedObra, setSelectedObra] = useState('');
    const [selectedDisciplina, setSelectedDisciplina] = useState('');

    // 1. INSTÂNCIA DO UPPY
    const [uppy] = useState(() => {
        if (typeof window === 'undefined') return null;
        
        const instance = new Uppy({
            id: 'bim-manager-v3', 
            autoProceed: false,
            restrictions: { 
                maxFileSize: 500 * 1024 * 1024, 
                maxNumberOfFiles: 1, 
                allowedFileTypes: ['.rvt'] 
            }
        });

        instance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });
        return instance;
    });

    // 2. BUSCA DE DADOS (Dropdowns) - Melhorado para Razão Social
    const { data: dropdownData, isLoading: isLoadingDropdowns } = useQuery({
        queryKey: ['bimUploadDropdowns', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return null;
            // Buscamos ambos: nome_fantasia e razao_social
            const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('razao_social');
            const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
            const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
            return { empresas: empresas || [], disciplinas: disciplinas || [], todasObras: obras || [] };
        },
        enabled: isOpen && !!organizacaoId,
    });

    const obrasFiltradas = dropdownData?.todasObras?.filter(o => String(o.empresa_proprietaria_id) === String(selectedEmpresa)) || [];

    // 3. MONTAGEM DO DASHBOARD
    useEffect(() => {
        if (!uppy || !dashboardRef.current || !isOpen) return;
        
        if (!uppy.getPlugin('Dashboard')) {
            uppy.use(DashboardPlugin, {
                target: dashboardRef.current,
                inline: true,
                width: '100%',
                height: 250,
                showProgressDetails: true,
                note: "Selecione a disciplina acima para habilitar o envio.",
                locale: { strings: { dropPasteFiles: 'Arraste o arquivo ou %{browse}', browse: 'busque no PC' } }
            });
        }
    }, [uppy, isOpen]);

    // 4. PRÉ-PREENCHIMENTO
    useEffect(() => {
        if (isOpen && preSelectedContext) {
            setSelectedEmpresa(preSelectedContext.empresaId?.toString() || '');
            setSelectedObra(preSelectedContext.obraId?.toString() || '');
            if (preSelectedContext.type === 'folder') {
                setSelectedDisciplina(preSelectedContext.id?.toString() || '');
            }
        }
    }, [isOpen, preSelectedContext]);

    // 5. MUTATION DE UPLOAD - Com invalidação de queries ampliada
    const uploadMutation = useMutation({
        mutationFn: async () => {
            const files = uppy.getFiles();
            if (files.length === 0) throw new Error("Selecione um arquivo no painel!");

            const file = files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `bim/${organizacaoId}/${crypto.randomUUID()}.${fileExt}`;

            // A. Supabase Storage
            const { error: storageError } = await supabase.storage.from('bim-arquivos').upload(filePath, file.data);
            if (storageError) throw storageError;

            // B. Autodesk API
            const formData = new FormData();
            formData.append('file', file.data);
            const res = await fetch('/api/aps/upload', { method: 'POST', body: formData });
            const apiData = await res.json();
            if (!res.ok) throw new Error(apiData.error || "Erro na Autodesk");

            // C. Registro no Banco
            const { error: dbError } = await supabase.from('projetos_bim').insert({
                nome_arquivo: file.name,
                tamanho_bytes: file.size,
                caminho_storage: filePath,
                urn_autodesk: apiData.urn,
                status: 'Concluido',
                empresa_id: selectedEmpresa,
                empreendimento_id: selectedObra,
                disciplina_id: selectedDisciplina,
                organizacao_id: organizacaoId,
                criado_por: user.id,
                versao: 1 // Adicionando versão inicial
            });
            if (dbError) throw dbError;
        },
        onSuccess: () => {
            toast.success("Projeto enviado com sucesso!");
            
            // ATENÇÃO: Invalidamos todas as queries que podem exibir esse arquivo
            queryClient.invalidateQueries({ queryKey: ['projetos_bim'] });
            queryClient.invalidateQueries({ queryKey: ['bimStructure'] }); // Se você tiver uma query para a sidebar
            
            uppy.cancelAll();
            if (onSuccess) onSuccess(); // Chama a função que recarrega a lista no BimContent
            onClose();
        },
        onError: (err) => toast.error("Erro: " + err.message)
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <link href="https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css" rel="stylesheet" />
            
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-gray-800 uppercase text-sm tracking-tighter">BIM Upload <span className="text-blue-600">Studio 57</span></h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Protocolo Anti-Crash Ativo</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes}/>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {isLoadingDropdowns ? (
                        <div className="flex justify-center py-10"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-2xl"/></div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Empresa Proprietária</label>
                                    <select 
                                        value={selectedEmpresa} 
                                        onChange={(e) => {
                                            setSelectedEmpresa(e.target.value);
                                            setSelectedObra('');
                                        }} 
                                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        <option value="">Selecione...</option>
                                        {dropdownData?.empresas.map(e => (
                                            <option key={e.id} value={e.id}>
                                                {/* Fallback: Mostra Nome Fantasia, se não tiver, Razão Social */}
                                                {e.nome_fantasia || e.razao_social}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Obra / Empreendimento</label>
                                    <select value={selectedObra} onChange={(e) => setSelectedObra(e.target.value)} disabled={!selectedEmpresa} className="w-full border rounded-lg p-2 text-sm disabled:bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                        <option value="">{selectedEmpresa ? 'Selecione a Obra...' : 'Selecione a empresa'}</option>
                                        {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Disciplina de Destino (Pasta)</label>
                                <select value={selectedDisciplina} onChange={(e) => setSelectedDisciplina(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-bold text-blue-700 bg-blue-50/30 outline-none">
                                    <option value="">Selecione a pasta...</option>
                                    {dropdownData?.disciplinas.map(d => <option key={d.id} value={d.id}>{d.sigla} - {d.nome}</option>)}
                                </select>
                            </div>

                            <div className={`mt-2 border-2 rounded-xl overflow-hidden transition-all duration-500 ${!selectedDisciplina ? 'opacity-20 grayscale pointer-events-none border-gray-200' : 'opacity-100 border-blue-400 shadow-lg'}`}>
                                <div ref={dashboardRef} />
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg">Cancelar</button>
                    <button 
                        onClick={() => uploadMutation.mutate()} 
                        disabled={uploadMutation.isPending || !selectedDisciplina || !selectedObra}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition-all active:scale-95"
                    >
                        {uploadMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudUploadAlt} />}
                        {uploadMutation.isPending ? 'Enviando...' : 'Subir para Autodesk'}
                    </button>
                </div>
            </div>
        </div>
    );
}