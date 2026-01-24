// Caminho: components/bim/BimUploadModal.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faCloudUploadAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
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
    });

    const obrasFiltradas = dropdownData?.todasObras?.filter(o => String(o.empresa_proprietaria_id) === String(selectedEmpresa)) || [];

    // 2. PRÉ-PREENCHIMENTO
    useEffect(() => {
        if (isOpen && preSelectedContext) {
            setSelectedEmpresa(preSelectedContext.empresaId?.toString() || '');
            setSelectedObra(preSelectedContext.obraId?.toString() || '');
            if (preSelectedContext.type === 'folder') {
                setSelectedDisciplina(preSelectedContext.id?.toString() || '');
            }
        }
    }, [isOpen, preSelectedContext]);

    // 3. FUNÇÃO DE UPLOAD DIRETO (PADRÃO TESTE-BIM)
    const handleDirectUpload = async () => {
        if (!file || !selectedDisciplina || !selectedObra) {
            toast.error("Por favor, selecione a Obra, Disciplina e o Arquivo!");
            return;
        }

        setIsUploading(true);
        setStatusStep('Enviando para Autodesk...');

        try {
            // A. Enviar para API Autodesk
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/aps/upload', {
                method: 'POST',
                body: formData,
            });

            const apiData = await res.json();
            if (!res.ok) throw new Error(apiData.error || "Erro na Autodesk");

            setStatusStep('Registrando no Studio 57...');

            // B. Salvar no Banco (Usando o que aprendemos da tabela projetos_bim)
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

            toast.success("Projeto carregado com sucesso!");
            
            // Avisa o sistema para atualizar a Sidebar e a Lista
            queryClient.invalidateQueries({ queryKey: ['bimStructureZero'] });
            queryClient.invalidateQueries({ queryKey: ['projetos_bim'] });
            
            setFile(null);
            if (onSuccess) onSuccess();
            onClose();

        } catch (err) {
            console.error("Erro no upload:", err);
            toast.error(err.message);
        } finally {
            setIsUploading(false);
            setStatusStep('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Novo Upload BIM</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes}/>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Empresa</label>
                            <select value={selectedEmpresa} onChange={(e) => {setSelectedEmpresa(e.target.value); setSelectedObra('');}} className="w-full border rounded-lg p-2 text-sm bg-white">
                                <option value="">Selecione...</option>
                                {dropdownData?.empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Obra</label>
                            <select value={selectedObra} onChange={(e) => setSelectedObra(e.target.value)} disabled={!selectedEmpresa} className="w-full border rounded-lg p-2 text-sm disabled:bg-gray-50 bg-white">
                                <option value="">Selecione...</option>
                                {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Disciplina</label>
                        <select value={selectedDisciplina} onChange={(e) => setSelectedDisciplina(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-bold text-blue-700 bg-blue-50/30">
                            <option value="">Selecione...</option>
                            {dropdownData?.disciplinas.map(d => <option key={d.id} value={d.id}>{d.sigla} - {d.nome}</option>)}
                        </select>
                    </div>

                    {/* Área de Seleção de Arquivo HTML Puro */}
                    <div className="mt-2 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 transition-all group">
                        <input 
                            type="file" 
                            id="direct-file-input" 
                            accept=".rvt" 
                            className="hidden" 
                            onChange={(e) => setFile(e.target.files[0])} 
                        />
                        <label htmlFor="direct-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${file ? 'bg-green-100' : 'bg-gray-50 group-hover:bg-blue-50'}`}>
                                <FontAwesomeIcon icon={faCloudUploadAlt} className={`text-xl ${file ? 'text-green-600' : 'text-gray-300 group-hover:text-blue-400'}`} />
                            </div>
                            <span className="text-xs font-bold text-gray-600">
                                {file ? file.name : "Clique para selecionar o arquivo .rvt"}
                            </span>
                        </label>
                    </div>

                    {isUploading && (
                        <div className="flex items-center justify-center gap-2 text-blue-600 font-bold animate-pulse text-sm py-2">
                            <FontAwesomeIcon icon={faSpinner} spin />
                            {statusStep}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} disabled={isUploading} className="px-4 py-2 text-sm font-bold text-gray-400">Cancelar</button>
                    <button 
                        onClick={handleDirectUpload} 
                        disabled={isUploading || !file || !selectedDisciplina}
                        className="bg-blue-600 text-white px-8 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 disabled:bg-gray-300 transition-all active:scale-95"
                    >
                        {isUploading ? "Processando..." : "Subir Projeto"}
                    </button>
                </div>
            </div>
        </div>
    );
}