//components\OrcamentoManager.js
'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import OrcamentoDetalhes from './OrcamentoDetalhes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// --- Componente do Modal (sem alteração na sua lógica interna) ---
const NovoOrcamentoModal = ({ isOpen, onClose, onSave, empreendimentoNome }) => {
    const [nome, setNome] = useState(`Orçamento Padrão - ${empreendimentoNome}`);
    const [versao, setVersao] = useState(1);
    
    const handleSubmit = () => {
        onSave({ nome_orcamento: nome, versao });
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
                    <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        Criar Orçamento
                    </button>
                </div>
            </div>
        </div>
    );
};


const OrcamentoManager = () => {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    // O PORQUÊ DA MUDANÇA: Padronizando para 'user' para manter consistência com outros componentes.
    const { user } = useAuth(); 
    
    const [selectedOrcamento, setSelectedOrcamento] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // O PORQUÊ: O ID da organização é pego diretamente do objeto 'user'.
    const organizacaoId = user?.organizacao_id;

    const fetchOrcamentos = async () => {
        if (!selectedEmpreendimento || selectedEmpreendimento === 'all' || !organizacaoId) {
            return [];
        }
        const { data, error } = await supabase
            .from('orcamentos')
            .select('*')
            .eq('empreendimento_id', selectedEmpreendimento)
            .eq('organizacao_id', organizacaoId) // Blindagem de segurança na leitura.
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error('Não foi possível carregar os orçamentos: ' + error.message);
        }
        return data || [];
    };

    const { data: orcamentos, isLoading: loadingOrcamentos, error } = useQuery({
        queryKey: ['orcamentos', selectedEmpreendimento, organizacaoId], // Chave da query usa a variável.
        queryFn: fetchOrcamentos,
        enabled: !!selectedEmpreendimento && selectedEmpreendimento !== 'all' && !!organizacaoId,
    });

    const createOrcamentoMutation = useMutation({
        mutationFn: async (orcamentoData) => {
            if (!organizacaoId) {
                throw new Error("Organização não identificada. Não é possível criar o orçamento.");
            }

            const { data, error } = await supabase
                .from('orcamentos')
                .insert({
                    ...orcamentoData,
                    empreendimento_id: selectedEmpreendimento,
                    organizacao_id: organizacaoId // Blindagem de segurança na escrita.
                })
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao criar o orçamento: ' + error.message);
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orcamentos', selectedEmpreendimento, organizacaoId] });
            toast.success('Orçamento criado com sucesso!');
            setIsModalOpen(false);
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });

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
                    disabled={!selectedEmpreendimento || selectedEmpreendimento === 'all' || createOrcamentoMutation.isPending}
                    className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Novo Orçamento
                </button>
            </div>

            {loadingOrcamentos ? (
                <div className="flex justify-center items-center py-10">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                </div>
            ) : error ? (
                 <p className="text-center text-red-500">{error.message}</p>
            ) : orcamentos && orcamentos.length > 0 ? (
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
                    onSave={createOrcamentoMutation.mutate}
                    empreendimentoNome={empreendimentoAtual.nome}
                />
            )}
        </div>
    );
};

export default OrcamentoManager;