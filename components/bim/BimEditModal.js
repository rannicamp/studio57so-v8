// Caminho: components/bim/BimEditModal.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faPen, faExchangeAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimEditModal({ isOpen, onClose, fileToEdit, onSuccess }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { organizacao_id: organizacaoId } = useAuth();

    const [selectedEmpresa, setSelectedEmpresa] = useState('');
    const [selectedObra, setSelectedObra] = useState('');
    const [selectedDisciplina, setSelectedDisciplina] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Busca Dropdowns (Cacheado)
    const { data: dropdownData } = useQuery({
        queryKey: ['bimUploadDropdowns', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return null;
            const { data: emp } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('nome_fantasia');
            const { data: disc } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
            const { data: obr } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
            return { empresas: emp || [], disciplinas: disc || [], todasObras: obr || [] };
        },
        enabled: isOpen && !!organizacaoId,
        staleTime: 1000 * 60 * 5 
    });

    const obrasFiltradas = dropdownData?.todasObras?.filter(o => String(o.empresa_proprietaria_id) === String(selectedEmpresa)) || [];

    // Preenche os dados ao abrir
    useEffect(() => {
        if (isOpen && fileToEdit) {
            setSelectedEmpresa(fileToEdit.empresa_id?.toString() || '');
            setSelectedObra(fileToEdit.empreendimento_id?.toString() || '');
            setSelectedDisciplina(fileToEdit.disciplina_id?.toString() || '');
        }
    }, [isOpen, fileToEdit]);

    const handleSave = async () => {
        if (!selectedEmpresa || !selectedObra || !selectedDisciplina) {
            toast.error("Todos os campos são obrigatórios.");
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('projetos_bim')
                .update({
                    empresa_id: selectedEmpresa,
                    empreendimento_id: selectedObra,
                    disciplina_id: selectedDisciplina,
                    atualizado_em: new Date().toISOString()
                })
                .eq('id', fileToEdit.id);

            if (error) throw error;

            toast.success("Arquivo movido com sucesso!");
            queryClient.invalidateQueries(['bimStructureWithFiles']);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all scale-100">
                
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPen} className="text-blue-600" />
                        Editar / Mover Arquivo
                    </h3>
                    <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes}/>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-xs text-yellow-800 mb-2">
                        <FontAwesomeIcon icon={faExchangeAlt} className="mr-2" />
                        Você está movendo o arquivo: <strong>{fileToEdit?.nome_arquivo}</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Empresa</label>
                            <select 
                                value={selectedEmpresa} 
                                onChange={(e) => {setSelectedEmpresa(e.target.value); setSelectedObra('');}} 
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                disabled={isSaving}
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
                                disabled={!selectedEmpresa || isSaving} 
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm disabled:bg-gray-100 bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                            >
                                <option value="">Selecione...</option>
                                {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Disciplina (Pasta)</label>
                        <select 
                            value={selectedDisciplina} 
                            onChange={(e) => setSelectedDisciplina(e.target.value)} 
                            disabled={isSaving}
                            className="w-full border border-blue-200 rounded-lg p-2 text-sm font-bold text-blue-700 bg-blue-50/50 focus:ring-2 focus:ring-blue-200 outline-none"
                        >
                            <option value="">Selecione a Pasta...</option>
                            {dropdownData?.disciplinas.map(d => <option key={d.id} value={d.id}>{d.sigla} - {d.nome}</option>)}
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2">
                        {isSaving ? <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</> : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
}