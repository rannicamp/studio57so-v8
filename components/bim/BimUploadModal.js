// Caminho: components/bim/BimUploadModal.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faCloudUploadAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimUploadModal({ isOpen, onClose, preSelectedContext, onSuccess }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id: organizacaoId } = useAuth();

    // Estados de Seleção
    const [selectedEmpresa, setSelectedEmpresa] = useState('');
    const [selectedObra, setSelectedObra] = useState('');
    const [selectedDisciplina, setSelectedDisciplina] = useState('');
    const [file, setFile] = useState(null);
    
    // Estados de Interface
    const [isUploading, setIsUploading] = useState(false);
    const [statusStep, setStatusStep] = useState('');

    // 1. BUSCA DE DADOS (Dropdowns)
    const { data: dropdownData, isLoading: isLoadingDropdowns } = useQuery({
        queryKey: ['bimUploadDropdowns', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return null;
            const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('razao_social');
            const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
            const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
            return { empresas: empresas || [], disciplinas: disciplinas || [], todasObras: obras || [] };
        },
        enabled: isOpen && !!organizacaoId,
        staleTime: 1000 * 60 * 5 // Cache de 5 minutos
    });

    const obrasFiltradas = dropdownData?.todasObras?.filter(o => String(o.empresa_proprietaria_id) === String(selectedEmpresa)) || [];

    // 2. PRÉ-PREENCHIMENTO INTELIGENTE
    useEffect(() => {
        if (isOpen && preSelectedContext) {
            if (preSelectedContext.empresaId) setSelectedEmpresa(preSelectedContext.empresaId.toString());
            if (preSelectedContext.obraId) setSelectedObra(preSelectedContext.obraId.toString());
            
            // Se clicou numa pasta de disciplina específica
            if (preSelectedContext.type === 'folder') {
                setSelectedDisciplina(preSelectedContext.id.toString());
            }
        } else if (!isOpen) {
            // Limpa o arquivo ao fechar, mas mantém seleções para facilitar múltiplos uploads
            setFile(null);
            setIsUploading(false);
            setStatusStep('');
        }
    }, [isOpen, preSelectedContext]);

    // 3. FUNÇÃO DE UPLOAD
    const handleDirectUpload = async () => {
        if (!file || !selectedDisciplina || !selectedObra) {
            toast.error("Por favor, selecione a Obra, Disciplina e o Arquivo!");
            return;
        }

        setIsUploading(true);
        setStatusStep('Enviando para Autodesk...');

        try {
            // A. Enviar para API Autodesk (Next.js Proxy)
            const formData = new FormData();
            formData.append('file', file);

            // IMPORTANTE: Não defina 'Content-Type' manualmente aqui. Deixe o navegador fazer isso.
            const res = await fetch('/api/aps/upload', {
                method: 'POST',
                body: formData,
            });

            const apiData = await res.json();
            
            if (!res.ok) {
                throw new Error(apiData.error || "Falha no envio para Autodesk");
            }

            if (!apiData.urn) {
                throw new Error("API não retornou o URN do arquivo.");
            }

            setStatusStep('Registrando no Banco...');

            // B. Salvar Metadados no Supabase
            const { error: dbError } = await supabase.from('projetos_bim').insert({
                nome_arquivo: file.name,
                tamanho_bytes: file.size,
                urn_autodesk: apiData.urn,
                status: 'Concluido',
                empresa_id: selectedEmpresa,
                empreendimento_id: selectedObra,
                disciplina_id: selectedDisciplina,
                organizacao_id: organizacaoId,
                criado_por: user.id,
                versao: 1
            });

            if (dbError) throw dbError;

            toast.success("Projeto enviado com sucesso!");
            
            // C. Atualizar a Interface
            // Invalida a query exata que o Sidebar usa para forçar o recarregamento da árvore
            queryClient.invalidateQueries({ queryKey: ['bimStructureWithFiles', organizacaoId] });
            
            if (onSuccess) onSuccess();
            onClose();

        } catch (err) {
            console.error("Erro no upload:", err);
            toast.error(`Erro: ${err.message}`);
        } finally {
            setIsUploading(false);
            setStatusStep('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all scale-100">
                
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCloudUploadAlt} className="text-blue-600" />
                        Novo Upload BIM
                    </h3>
                    <button onClick={onClose} disabled={isUploading} className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                        <FontAwesomeIcon icon={faTimes}/>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Seletores */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Empresa</label>
                            <select 
                                value={selectedEmpresa} 
                                onChange={(e) => {setSelectedEmpresa(e.target.value); setSelectedObra('');}} 
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
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
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm disabled:bg-gray-100 bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                            >
                                <option value="">Selecione...</option>
                                {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Disciplina</label>
                        <select 
                            value={selectedDisciplina} 
                            onChange={(e) => setSelectedDisciplina(e.target.value)} 
                            disabled={isUploading}
                            className="w-full border border-blue-200 rounded-lg p-2 text-sm font-bold text-blue-700 bg-blue-50/50 focus:ring-2 focus:ring-blue-200 outline-none"
                        >
                            <option value="">Selecione a Pasta...</option>
                            {dropdownData?.disciplinas.map(d => <option key={d.id} value={d.id}>{d.sigla} - {d.nome}</option>)}
                        </select>
                    </div>

                    {/* Área de Drop / Seleção */}
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

                    {/* Barra de Status */}
                    {isUploading && (
                        <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-center gap-3 border border-blue-100">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />
                            <span className="text-xs font-bold text-blue-700 animate-pulse">{statusStep}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        disabled={isUploading} 
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleDirectUpload} 
                        disabled={isUploading || !file || !selectedDisciplina || !selectedObra}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                    >
                        {isUploading ? 'Processando...' : 'Confirmar Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
}