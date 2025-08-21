"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// Ícone de "copiar" foi adicionado
import { faEye, faTrash, faCopy } from '@fortawesome/free-solid-svg-icons';

export default function ContratoList({ initialContratos }) {
    const [contratos, setContratos] = useState(initialContratos);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();
    const supabase = createClient();

    const filteredContratos = useMemo(() => {
        return contratos.filter(c => {
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
    
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      return new Date(dateString + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // --- INÍCIO DA NOVA FUNÇÃO ---
    // Nova função para lidar com a duplicação
    const handleDuplicate = async (e, contratoParaDuplicar) => {
        e.stopPropagation();

        if (!window.confirm(`Deseja criar uma cópia do contrato da Unidade ${contratoParaDuplicar.produto?.unidade}? Um novo contrato será criado como rascunho.`)) {
            return;
        }
        
        const promise = supabase.rpc('duplicar_contrato_e_detalhes', {
            p_contrato_id: contratoParaDuplicar.id
        });

        toast.promise(promise, {
            loading: 'Duplicando contrato...',
            success: (response) => {
                // Para atualizar a lista, buscamos os dados novamente
                supabase.from('contratos')
                    .select(`*, contato:contato_id ( nome, razao_social ), produto:produto_id ( unidade, tipo ), empreendimento:empreendimento_id ( nome )`)
                    .order('created_at', { ascending: false })
                    .then(({ data }) => setContratos(data || []));
                
                return response.message; // Mensagem de sucesso da função do banco
            },
            error: (err) => `Erro ao duplicar: ${err.message}`
        });
    };
    // --- FIM DA NOVA FUNÇÃO ---

    const handleDelete = async (e, contratoParaExcluir) => {
        e.stopPropagation();

        if (!window.confirm(`Tem certeza que deseja excluir o contrato para a Unidade ${contratoParaExcluir.produto?.unidade}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        const promise = supabase.rpc('excluir_contrato_e_liberar_unidade', {
            p_contrato_id: contratoParaExcluir.id
        });

        toast.promise(promise, {
            loading: 'Excluindo contrato...',
            success: (data) => {
                setContratos(prevContratos => prevContratos.filter(c => c.id !== contratoParaExcluir.id));
                return data;
            },
            error: (err) => `Erro ao excluir: ${err.message}`
        });
    };

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
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={() => router.push(`/contratos/${contrato.id}`)} className="text-blue-600 hover:text-blue-800" title="Visualizar/Editar Contrato">
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>
                                        {/* --- BOTÃO DE DUPLICAR ADICIONADO --- */}
                                        <button onClick={(e) => handleDuplicate(e, contrato)} className="text-gray-500 hover:text-gray-700" title="Duplicar Contrato">
                                            <FontAwesomeIcon icon={faCopy} />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, contrato)} className="text-red-600 hover:text-red-800" title="Excluir Contrato">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}