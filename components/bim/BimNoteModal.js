// Caminho: components/bim/BimNoteModal.js
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCamera, faSpinner, faLink, faCube } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimNoteModal({ isOpen, onClose, captureData, activities = [], onSuccess }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();

    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [tipo, setTipo] = useState('geral');
    const [prioridade, setPrioridade] = useState('normal');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitulo('');
            setDescricao('');
            setTipo('geral');
            setPrioridade('normal');
            setSelectedActivity('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Helper para contar elementos (suporta formato antigo e novo)
    const getElementCount = () => {
        if (captureData?.elements) return captureData.elements.length;
        if (captureData?.elementIds) return captureData.elementIds.length;
        return 0;
    };

    const handleSave = async () => {
        if (!titulo.trim()) return toast.error("O título é obrigatório.");
        setIsSaving(true);

        try {
            // 1. Inserir a Nota Principal
            const { data: newNote, error: noteError } = await supabase
                .from('bim_notas')
                .insert({
                    organizacao_id,
                    projeto_bim_id: captureData.projetoBimId, // Projeto "Principal" da vista
                    titulo,
                    descricao,
                    tipo,
                    prioridade,
                    status: 'aberta',
                    atividade_id: selectedActivity || null,
                    camera_state: captureData.cameraState,
                    snapshot: captureData.snapshot,
                    criado_por: user.id
                })
                .select()
                .single();

            if (noteError) throw noteError;

            // 2. Inserir os Vínculos de Elementos (Lógica Blindada)
            let vinculos = [];

            // CASO A: Novo formato (Lista de Objetos { externalId, projectId })
            if (captureData.elements && captureData.elements.length > 0) {
                vinculos = captureData.elements.map(el => ({
                    organizacao_id,
                    nota_id: newNote.id,
                    projeto_bim_id: el.projectId, // <--- O PULO DO GATO: Respeita o projeto de cada elemento!
                    external_id: el.externalId
                }));
            } 
            // CASO B: Formato Antigo (Lista de Strings) - Fallback
            else if (captureData.elementIds && captureData.elementIds.length > 0) {
                vinculos = captureData.elementIds.map(extId => ({
                    organizacao_id,
                    nota_id: newNote.id,
                    projeto_bim_id: captureData.projetoBimId,
                    external_id: extId
                }));
            }

            if (vinculos.length > 0) {
                const { error: linkError } = await supabase
                    .from('bim_notas_elementos')
                    .insert(vinculos);
                
                if (linkError) throw linkError;
            }

            toast.success("Nota salva com sucesso!");
            if (onSuccess) onSuccess();
            onClose();

        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCamera} className="text-blue-600" />
                        Nova Nota (Multi-Seleção)
                    </h3>
                    <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-red-500"><FontAwesomeIcon icon={faTimes}/></button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                    {captureData?.snapshot && (
                        <div className="relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                            <img src={captureData.snapshot} alt="Snapshot" className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-lg">
                                <FontAwesomeIcon icon={faCube} className="mr-1"/> 
                                {getElementCount()} elementos vinculados
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                        <label className="block text-[10px] font-bold text-blue-800 uppercase mb-1 flex items-center gap-2">
                            <FontAwesomeIcon icon={faLink} /> Vincular a Atividade
                        </label>
                        <select value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} className="w-full border border-blue-200 rounded-lg p-2 text-sm bg-white outline-none">
                            <option value="">-- Nota Avulsa --</option>
                            {activities.map(act => (
                                <option key={act.id} value={act.id}>{act.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Título *</label>
                        <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do problema..." className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" autoFocus />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm outline-none">
                            <option value="geral">Geral</option>
                            <option value="interferencia">Interferência</option>
                            <option value="execucao">Execução</option>
                        </select>
                        <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm outline-none">
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="critica">Crítica 🚨</option>
                        </select>
                    </div>

                    <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do problema..." className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none resize-none" />
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-400">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving || !titulo} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} Criar Nota
                    </button>
                </div>
            </div>
        </div>
    );
}