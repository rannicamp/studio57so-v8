"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client'; // Importa o Supabase client
import { toast } from 'sonner'; // Importa o toast para notificações
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faTrash } from '@fortawesome/free-solid-svg-icons'; // Importa o ícone de lixeira

export default function ContratoList({ initialContratos }) {
    const [contratos, setContratos] = useState(initialContratos); // Adiciona estado para a lista
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();
    const supabase = createClient(); // Cria a instância do Supabase

    const filteredContratos = useMemo(() => {
        return contratos.filter(c => { // Filtra a partir do estado local
            const cliente = c.contato?.nome || c.contato?.razao_social || '';
            const produto = c.produto?.unidade || '';
            const empreendimento = c.empreendimento?.nome || '';
            return (
                cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                empreendimento.toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
    }, [contratos, searchTerm]);
    
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pt-BR');
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // --- INÍCIO DA CORREÇÃO ---
    // Nova função para lidar com a exclusão
    const handleDelete = async (e, contratoParaExcluir) => {
        e.stopPropagation(); // Impede que o clique navegue para a página de detalhes

        if (!window.confirm(`Tem certeza que deseja excluir o contrato para a Unidade ${contratoParaExcluir.produto?.unidade}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        const promise = supabase.rpc('excluir_contrato_e_liberar_unidade', {
            p_contrato_id: contratoParaExcluir.id
        });

        toast.promise(promise, {
            loading: 'Excluindo contrato...',
            success: (data) => {
                // Remove o contrato da lista na tela para um feedback visual imediato
                setContratos(prevContratos => prevContratos.filter(c => c.id !== contratoParaExcluir.id));
                return data; // Mensagem de sucesso da função do banco
            },
            error: (err) => `Erro ao excluir: ${err.message}`
        });
    };
    // --- FIM DA CORREÇÃO ---

    return (
        <div className="space-y-4">
            <input
                type="text"
                placeholder="Buscar por cliente, produto ou empreendimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded-md"
            />
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Produto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Empreendimento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Data da Venda</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Valor</th>
                            <th className="px-6 py-3 text-center text-xs font-medium uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredContratos.map((contrato) => (
                            <tr key={contrato.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/contratos/${contrato.id}`)}>
                                    {contrato.contato?.nome || contrato.contato?.razao_social || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">Unidade {contrato.produto?.unidade || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{contrato.empreendimento?.nome || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(contrato.data_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">{formatCurrency(contrato.valor_final_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {/* --- INÍCIO DA CORREÇÃO --- */}
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={() => router.push(`/contratos/${contrato.id}`)} className="text-blue-600 hover:text-blue-800" title="Visualizar/Editar Contrato">
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, contrato)} className="text-red-600 hover:text-red-800" title="Excluir Contrato">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                    {/* --- FIM DA CORREÇÃO --- */}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}