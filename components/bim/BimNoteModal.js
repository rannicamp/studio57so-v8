// Caminho: components/bim/BimNoteModal.js
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCamera, faSpinner, faLink, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimNoteModal({ 
    isOpen, 
    onClose, 
    captureData, // Objeto contendo { cameraState, snapshot, elementId, projectId }
    activities = [], // Lista de atividades para o dropdown
    onSuccess 
}) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();

    // Estados do Formulário
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [tipo, setTipo] = useState('geral'); // interferencia, seguranca, execucao
    const [prioridade, setPrioridade] = useState('normal');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Reset ao abrir
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

    const handleSave = async () => {
        if (!titulo.trim()) return toast.error("O título é obrigatório.");
        if (!captureData?.cameraState) return toast.error("Erro ao capturar estado da câmera.");

        setIsSaving(true);
        try {
            const payload = {
                organizacao_id,
                projeto_bim_id: captureData.projetoBimId,
                elemento_vinculado_id: captureData.elementId || null,
                
                titulo,
                descricao,
                tipo,
                prioridade,
                status: 'aberta',
                
                // O VÍNCULO IMPORTANTE
                atividade_id: selectedActivity || null,

                // O CONTEXTO 3D
                camera_state: captureData.cameraState, // JSON puro
                snapshot: captureData.snapshot, // String Base64 da imagem
                
                criado_por: user.id
            };

            const { error } = await supabase.from('bim_notas').insert(payload);

            if (error) throw error;

            toast.success("Nota criada com sucesso!");
            if (onSuccess) onSuccess();
            onClose();

        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar nota: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-100 max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCamera} className="text-blue-600" />
                        Nova Nota / Problema
                    </h3>
                    <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-red-500"><FontAwesomeIcon icon={faTimes}/></button>
                </div>

                {/* Body com Scroll */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                    
                    {/* Preview da Imagem */}
                    {captureData?.snapshot && (
                        <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                            <img src={captureData.snapshot} alt="Snapshot" className="w-full h-full object-cover" />
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
                                Vista Capturada
                            </div>
                        </div>
                    )}

                    {/* Vínculo com Atividade (Destaque) */}
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                        <label className="block text-[10px] font-bold text-blue-800 uppercase mb-1 flex items-center gap-2">
                            <FontAwesomeIcon icon={faLink} /> Vincular a Atividade (Opcional)
                        </label>
                        <select 
                            value={selectedActivity} 
                            onChange={(e) => setSelectedActivity(e.target.value)}
                            className="w-full border border-blue-200 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none text-blue-900"
                        >
                            <option value="">-- Nenhuma (Nota Solta) --</option>
                            {activities.map(act => (
                                <option key={act.id} value={act.id}>
                                    {act.nome} ({new Date(act.data_inicio_prevista).toLocaleDateString()})
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-blue-600 mt-1">
                            Ao vincular, esta nota aparecerá no card da atividade no Cronograma.
                        </p>
                    </div>

                    {/* Campos de Texto */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Título do Problema *</label>
                        <input 
                            type="text" 
                            value={titulo} 
                            onChange={(e) => setTitulo(e.target.value)} 
                            placeholder="Ex: Interferência Tubo x Viga"
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo</label>
                            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white outline-none">
                                <option value="geral">Geral</option>
                                <option value="interferencia">Interferência (Clash)</option>
                                <option value="seguranca">Segurança</option>
                                <option value="execucao">Execução</option>
                                <option value="duvida">Dúvida de Projeto</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prioridade</label>
                            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white outline-none">
                                <option value="baixa">Baixa</option>
                                <option value="normal">Normal</option>
                                <option value="alta">Alta</option>
                                <option value="critica">Crítica 🚨</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Descrição Detalhada</label>
                        <textarea 
                            rows={3}
                            value={descricao} 
                            onChange={(e) => setDescricao(e.target.value)} 
                            placeholder="Descreva o que precisa ser resolvido..."
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving || !titulo} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} Criar Nota
                    </button>
                </div>
            </div>
        </div>
    );
}