"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faTrash, faCopy, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

export default function ContratoList({ initialContratos }) {
    const [contratos, setContratos] = useState(initialContratos);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();
    const supabase = createClient();
    
    const [sortConfig, setSortConfig] = useState({ key: 'data_venda', direction: 'descending' });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredContratos = useMemo(() => {
        let items = [...contratos];
        
        if (searchTerm) {
            items = items.filter(c => {
                const cliente = c.contato?.nome || c.contato?.razao_social || '';
                const produto = c.produto?.unidade || '';
                const empreendimento = c.empreendimento?.nome || '';
                const corretor = c.corretor?.nome || ''; // Adicionado corretor na busca
                const numeroContrato = c.id?.toString() || ''; // Adicionado nº do contrato na busca
                return (
                    cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    empreendimento.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    corretor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    numeroContrato.includes(searchTerm.toLowerCase())
                );
            });
        }

        if (sortConfig.key) {
            items.sort((a, b) => {
                let valA, valB;

                switch (sortConfig.key) {
                    case 'cliente':
                        valA = a.contato?.nome || a.contato?.razao_social || '';
                        valB = b.contato?.nome || b.contato?.razao_social || '';
                        break;
                    case 'produto':
                        valA = a.produto?.unidade || '';
                        valB = b.produto?.unidade || '';
                        break;
                    case 'empreendimento':
                        valA = a.empreendimento?.nome || '';
                        valB = b.empreendimento?.nome || '';
                        break;
                    case 'corretor': // Adicionada lógica de ordenação para corretor
                        valA = a.corretor?.nome || '';
                        valB = b.corretor?.nome || '';
                        break;
                    default:
                        valA = a[sortConfig.key];
                        valB = b[sortConfig.key];
                }

                // Tratamento para valores numéricos e de texto
                if (typeof valA === 'number' && typeof valB === 'number') {
                    if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                } else {
                    if (String(valA).toLowerCase() < String(valB).toLowerCase()) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (String(valA).toLowerCase() > String(valB).toLowerCase()) return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                
                return 0;
            });
        }

        return items;
    }, [contratos, searchTerm, sortConfig]);
    
    // ATENÇÃO: Corrigi esta função para evitar bugs de fuso horário, conforme nossa regra.
    const formatDate = (dateString) => {
        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return 'N/A';
        }
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
                supabase.from('contratos')
                    .select(`*, contato:contato_id ( nome, razao_social ), produto:produto_id ( unidade, tipo ), empreendimento:empreendimento_id ( nome )`)
                    .order('created_at', { ascending: false })
                    .then(({ data }) => setContratos(data || []));
                
                return response.message;
            },
            error: (err) => `Erro ao duplicar: ${err.message}`
        });
    };

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

    const SortableHeader = ({ label, sortKey }) => {
        const getSortIcon = () => {
            if (sortConfig.key !== sortKey) return faSort;
            return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
        };

        return (
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2">
                    {label}
                    <FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" />
                </button>
            </th>
        );
    };

    return (
        <div className="space-y-4">
            <input
                type="text"
                placeholder="Buscar por nº, cliente, produto, empreendimento ou corretor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded-md"
            />
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {/* NOVAS COLUNAS ADICIONADAS AQUI */}
                            <SortableHeader label="Nº Contrato" sortKey="id" />
                            <SortableHeader label="Cliente" sortKey="cliente" />
                            <SortableHeader label="Produto" sortKey="produto" />
                            <SortableHeader label="Empreendimento" sortKey="empreendimento" />
                            <SortableHeader label="Data da Venda" sortKey="data_venda" />
                            <SortableHeader label="Corretor" sortKey="corretor" />
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase">
                                <button onClick={() => requestSort('valor_final_venda')} className="flex items-center gap-2 ml-auto">
                                    Valor
                                    <FontAwesomeIcon icon={sortConfig.key === 'valor_final_venda' ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort} className="text-gray-400" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredContratos.map((contrato) => (
                            <tr key={contrato.id} className="hover:bg-gray-50">
                                {/* NOVAS CÉLULAS ADICIONADAS AQUI */}
                                <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">{contrato.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/contratos/${contrato.id}`)}>
                                    {contrato.contato?.nome || contrato.contato?.razao_social || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">Unidade {contrato.produto?.unidade || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{contrato.empreendimento?.nome || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(contrato.data_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{contrato.corretor?.nome || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">{formatCurrency(contrato.valor_final_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={() => router.push(`/contratos/${contrato.id}`)} className="text-blue-600 hover:text-blue-800" title="Visualizar/Editar Contrato">
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>
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