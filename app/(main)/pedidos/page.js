'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import ComprasKanban from '../../../components/ComprasKanban'; // O painel que vamos criar
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';

export default function PedidosPage() {
    const { setPageTitle } = useLayout();
    const [pedidos, setPedidos] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [selectedEmpreendimento, setSelectedEmpreendimento] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        setPageTitle('Painel de Compras');

        const fetchEmpreendimentos = async () => {
            const { data, error } = await supabase.from('empreendimentos').select('id, nome').order('nome');
            if (error) {
                setError('Falha ao carregar empreendimentos.');
            } else {
                setEmpreendimentos(data);
                // Se houver empreendimentos, seleciona o primeiro por padrão
                if (data.length > 0) {
                    setSelectedEmpreendimento(data[0].id);
                }
            }
        };
        fetchEmpreendimentos();
    }, [setPageTitle, supabase]);

    const fetchPedidos = useCallback(async () => {
        if (!selectedEmpreendimento) return;
        setLoading(true);
        setError('');
        const { data, error } = await supabase
            .from('pedidos_compra')
            .select('*, solicitante:solicitante_id(nome), itens:pedidos_compra_itens(*)')
            .eq('empreendimento_id', selectedEmpreendimento)
            .order('data_solicitacao', { ascending: false });

        if (error) {
            console.error(error);
            setError('Falha ao carregar os pedidos.');
        } else {
            setPedidos(data);
        }
        setLoading(false);
    }, [selectedEmpreendimento, supabase]);

    useEffect(() => {
        fetchPedidos();
    }, [fetchPedidos]);
    
    // Função para criar um novo pedido em branco e navegar para a página de edição
    const handleCreateNewPedido = async () => {
        if (!selectedEmpreendimento) {
            alert('Por favor, selecione um empreendimento primeiro.');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { data: newPedido, error } = await supabase
            .from('pedidos_compra')
            .insert({
                empreendimento_id: selectedEmpreendimento,
                solicitante_id: user.id,
                status: 'Pedido Realizado'
            })
            .select()
            .single();

        if (error) {
            alert('Erro ao criar novo pedido: ' + error.message);
        } else {
            router.push(`/pedidos/${newPedido.id}`);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex-1 w-full md:w-auto">
                    <label htmlFor="empreendimento-select" className="sr-only">Selecione o Empreendimento</label>
                    <select
                        id="empreendimento-select"
                        value={selectedEmpreendimento}
                        onChange={(e) => setSelectedEmpreendimento(e.target.value)}
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    >
                        <option value="">Selecione um empreendimento</option>
                        {empreendimentos.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleCreateNewPedido}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 w-full md:w-auto"
                >
                    + Nova Solicitação de Compra
                </button>
            </div>
            {loading ? (
                <div className="text-center py-10">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                    <p>Carregando pedidos...</p>
                </div>
            ) : error ? (
                <p className="text-center text-red-500">{error}</p>
            ) : (
                <ComprasKanban pedidos={pedidos} setPedidos={setPedidos} />
            )}
        </div>
    );
}