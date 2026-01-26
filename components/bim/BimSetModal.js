// Caminho: components/bim/BimSetModal.js
'use client';

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faLayerGroup, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimSetModal({ isOpen, onClose, selectedFiles, onSuccess }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const [setName, setSetName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!setName.trim()) return toast.error("Dê um nome para o conjunto.");
        
        setIsSaving(true);
        try {
            // Extrai apenas os IDs dos arquivos selecionados
            const projetoIds = selectedFiles.map(f => f.id);

            // Tenta pegar o empreendimento do primeiro arquivo para categorizar (opcional)
            const empreendimentoId = selectedFiles[0]?.empreendimento_id;

            const { error } = await supabase.from('bim_vistas_federadas').insert({
                nome: setName,
                organizacao_id,
                empreendimento_id: empreendimentoId, // Vincula ao empreendimento do 1º arquivo
                projetos_ids: projetoIds, // <--- ARRAY DE IDs (VÍNCULO FORTE)
                modelos_urns: [], // Legado, mandamos vazio ou as URNs atuais como cache
                criado_por: user.id
            });

            if (error) throw error;

            toast.success("Conjunto salvo com sucesso!");
            if (onSuccess) onSuccess();
            onClose();
            setSetName('');
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar conjunto.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col scale-100">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faLayerGroup} className="text-purple-600" />
                        Salvar Conjunto
                    </h3>
                    <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-red-500"><FontAwesomeIcon icon={faTimes}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="text-xs text-gray-500">
                        Você está salvando uma seleção com <strong>{selectedFiles.length} arquivos</strong>.
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome do Conjunto</label>
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="Ex: Hidráulica + Estrutura Térreo"
                            value={setName}
                            onChange={(e) => setSetName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-100 outline-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving || !setName} className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-purple-700 flex items-center gap-2">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}