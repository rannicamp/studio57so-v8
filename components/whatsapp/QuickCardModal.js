'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faSpinner, faLayerGroup, faColumns } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function QuickCardModal({ isOpen, onClose, conversation, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [funnels, setFunnels] = useState([]);
    const [columns, setColumns] = useState([]);
    
    const [selectedFunnel, setSelectedFunnel] = useState('');
    const [selectedColumn, setSelectedColumn] = useState('');

    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Carregar Funis ao abrir
    useEffect(() => {
        if (isOpen && organizacaoId) {
            const fetchFunnels = async () => {
                setLoading(true);
                const { data } = await supabase
                    .from('funis')
                    .select('id, nome')
                    .eq('organizacao_id', organizacaoId)
                    .order('nome');
                setFunnels(data || []);
                setLoading(false);
            };
            fetchFunnels();
            
            // Resetar seleções
            setSelectedFunnel('');
            setSelectedColumn('');
        }
    }, [isOpen, organizacaoId, supabase]);

    // 2. Carregar Colunas quando escolher o Funil
    useEffect(() => {
        if (selectedFunnel) {
            const fetchColumns = async () => {
                const { data } = await supabase
                    .from('colunas_funil')
                    .select('id, nome')
                    .eq('funil_id', selectedFunnel)
                    .order('ordem');
                setColumns(data || []);
                setSelectedColumn(''); // Resetar coluna ao trocar funil
            };
            fetchColumns();
        } else {
            setColumns([]);
        }
    }, [selectedFunnel, supabase]);

    const handleSave = async () => {
        if (!selectedColumn) return toast.warning("Selecione uma etapa.");
        if (!conversation?.contato_id) return toast.error("Este conversa não tem um contato salvo.");

        setSaving(true);
        try {
            // Verifica se já existe card (Upsert)
            const { error } = await supabase
                .from('contatos_no_funil')
                .upsert({
                    contato_id: conversation.contato_id,
                    coluna_id: selectedColumn,
                    organizacao_id: organizacaoId,
                    // Campos opcionais que podem ser úteis
                    updated_at: new Date()
                }, { onConflict: 'contato_id' }); // Garante que atualiza se já existir

            if (error) throw error;

            toast.success("Card criado/movido com sucesso!");
            if (onSuccess) onSuccess(); // Atualiza a lista pai
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao criar card.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
                
                {/* Cabeçalho */}
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faLayerGroup} className="text-[#00a884]" />
                        Criar Card no Funil
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* Corpo */}
                <div className="p-6 space-y-4">
                    <div className="text-sm text-gray-600 mb-2">
                        Movendo <strong>{conversation.nome}</strong> para o funil:
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Selecione o Funil</label>
                        <div className="relative">
                            <select 
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884] focus:border-[#00a884] bg-white outline-none appearance-none"
                                value={selectedFunnel}
                                onChange={(e) => setSelectedFunnel(e.target.value)}
                                disabled={loading}
                            >
                                <option value="">-- Escolha um funil --</option>
                                {funnels.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                            </select>
                            {loading && <div className="absolute right-3 top-2.5 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Selecione a Etapa</label>
                        <div className="relative">
                            <select 
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884] focus:border-[#00a884] bg-white outline-none appearance-none disabled:bg-gray-100"
                                value={selectedColumn}
                                onChange={(e) => setSelectedColumn(e.target.value)}
                                disabled={!selectedFunnel}
                            >
                                <option value="">-- Escolha uma etapa --</option>
                                {columns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                            <FontAwesomeIcon icon={faColumns} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Rodapé */}
                <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving || !selectedColumn}
                        className="bg-[#00a884] text-white px-4 py-2 rounded-lg hover:bg-[#008f6f] disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                    >
                        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        Salvar Card
                    </button>
                </div>
            </div>
        </div>
    );
}