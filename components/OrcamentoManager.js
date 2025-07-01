'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext'; // Importar o contexto
import OrcamentoDetalhes from './OrcamentoDetalhes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Componente do Modal para criar novo orçamento
const NovoOrcamentoModal = ({ isOpen, onClose, onSave, empreendimentoNome }) => {
    const [nome, setNome] = useState(`Orçamento Padrão - ${empreendimentoNome}`);
    const [versao, setVersao] = useState(1);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        await onSave({ nome_orcamento: nome, versao });
        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">Criar Novo Orçamento</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nome do Orçamento</label>
                        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Versão</label>
                        <input type="number" min="1" value={versao} onChange={(e) => setVersao(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSubmit} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                         {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Criar Orçamento'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const OrcamentoManager = () => {
    // Usa o contexto para obter o empreendimento selecionado globalmente
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    
    const [orcamentos, setOrcamentos] = useState([]);
    const [loadingOrcamentos, setLoadingOrcamentos] = useState(false);
    const [error, setError] = useState('');
    const [selectedOrcamento, setSelectedOrcamento] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        // Se nenhum empreendimento (ou 'todos') for selecionado, limpa a lista.
        if (!selectedEmpreendimento || selectedEmpreendimento === 'all') {
            setOrcamentos([]);
            return;
        }

        const fetchOrcamentos = async () => {
            setLoadingOrcamentos(true);
            setSelectedOrcamento(null); 
            const { data, error } = await supabase
                .from('orcamentos')
                .select('*')
                .eq('empreendimento_id', selectedEmpreendimento)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao buscar orçamentos:', error);
                setError('Não foi possível carregar os orçamentos para este empreendimento.');
            } else {
                setOrcamentos(data || []);
            }
            setLoadingOrcamentos(false);
        };

        fetchOrcamentos();
    }, [selectedEmpreendimento, supabase]);

    const handleCreateOrcamento = async (orcamentoData) => {
        const { data, error } = await supabase
            .from('orcamentos')
            .insert({
                ...orcamentoData,
                empreendimento_id: selectedEmpreendimento
            })
            .select()
            .single();

        if (error) {
            setError('Erro ao criar o orçamento: ' + error.message);
        } else {
            setOrcamentos(prev => [data, ...prev]);
        }
    };

    const handleBackToList = () => {
        setSelectedOrcamento(null);
    };

    if (selectedOrcamento) {
        return <OrcamentoDetalhes orcamento={selectedOrcamento} onBack={handleBackToList} />;
    }
    
    const empreendimentoAtual = empreendimentos.find(e => e.id.toString() === selectedEmpreendimento);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                    Orçamentos de: <span className="text-blue-600">{empreendimentoAtual?.nome || 'Nenhum empreendimento selecionado'}</span>
                </h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={!selectedEmpreendimento || selectedEmpreendimento === 'all'}
                    className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Novo Orçamento
                </button>
            </div>

            {loadingOrcamentos ? (
                <p className="text-center text-gray-500">Carregando orçamentos...</p>
            ) : error ? (
                 <p className="text-center text-red-500">{error}</p>
            ) : orcamentos.length > 0 ? (
                <ul className="space-y-3">
                    {orcamentos.map(orc => (
                    <li 
                        key={orc.id} 
                        onClick={() => setSelectedOrcamento(orc)}
                        className="bg-gray-50 p-4 rounded-lg shadow-sm flex justify-between items-center cursor-pointer transition hover:bg-gray-100 hover:shadow-md"
                    >
                        <div>
                        <p className="font-bold text-gray-900">{orc.nome_orcamento}</p>
                        <p className="text-sm text-gray-600">Versão: {orc.versao}</p>
                        <p className="text-sm text-gray-600">Status: {orc.status}</p>
                        </div>
                        <div className="text-right">
                        <p className="font-semibold text-lg text-blue-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.custo_total_previsto || 0)}
                        </p>
                        </div>
                    </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center text-gray-500 py-10">
                    <p>
                        {(!selectedEmpreendimento || selectedEmpreendimento === 'all') 
                            ? "Selecione um empreendimento no cabeçalho para começar." 
                            : "Nenhum orçamento encontrado. Clique em '+ Novo Orçamento' para criar o primeiro."}
                    </p>
                </div>
            )}

            {isModalOpen && empreendimentoAtual && (
                <NovoOrcamentoModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleCreateOrcamento}
                    empreendimentoNome={empreendimentoAtual.nome}
                />
            )}
        </div>
    );
};

export default OrcamentoManager;