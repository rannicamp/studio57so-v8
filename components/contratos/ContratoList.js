//components\contratos\ContratoList.js
"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faTrash, faCopy, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

export default function ContratoList({ initialContratos }) {
    const [contratos, setContratos] = useState(initialContratos);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para pegar o ID da organização
    const organizacaoId = user?.organizacao_id;
    
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
                const corretor = c.corretor?.nome || '';
                const numeroContrato = c.id?.toString() || '';
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
                    case 'corretor':
                        valA = a.corretor?.nome || '';
                        valB = b.corretor?.nome || '';
                        break;
                    default:
                        valA = a[sortConfig.key];
                        valB = b[sortConfig.key];
                }

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
    
    const formatDate = (dateString) => {
        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return 'N/A';
        }
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const handleDuplicate = (e, contratoParaDuplicar) => {
        e.stopPropagation();

        toast("Confirmar Duplicação", {
            description: `Deseja criar uma cópia do contrato da Unidade ${contratoParaDuplicar.produto?.unidade}? Um novo contrato será criado como rascunho.`,
            action: {
                label: "Duplicar",
                onClick: () => {
                    // =================================================================================
                    // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
                    // O PORQUÊ: Passamos o `organizacaoId` para a função do banco de dados
                    // para garantir que a duplicação ocorra de forma segura.
                    // =================================================================================
                    const promise = supabase.rpc('duplicar_contrato_e_detalhes', {
                        p_contrato_id: contratoParaDuplicar.id,
                        p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
                    });

                    toast.promise(promise, {
                        loading: 'Duplicando contrato...',
                        success: (response) => {
                            // Atualiza a lista de contratos de forma segura
                            supabase.from('contratos')
                                .select(`*, contato:contato_id ( nome, razao_social ), produto:produto_id ( unidade, tipo ), empreendimento:empreendimento_id ( nome ), corretor:corretor_id(nome)`)
                                .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
                                .order('created_at', { ascending: false })
                                .then(({ data }) => setContratos(data || []));
                            
                            return response.message;
                        },
                        error: (err) => `Erro ao duplicar: ${err.message}`
                    });
                }
            },
            cancel: { label: "Cancelar" }
        });
    };

    const handleDelete = (e, contratoParaExcluir) => {
        e.stopPropagation();

        toast("Confirmar Exclusão", {
            description: `Tem certeza que deseja excluir o contrato para a Unidade ${contratoParaExcluir.produto?.unidade}? Esta ação não pode ser desfeita.`,
            action: {
                label: "Excluir",
                onClick: () => {
                    // =================================================================================
                    // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
                    // O PORQUÊ: Passamos o `organizacaoId` para a função do banco de dados
                    // para garantir que a exclusão ocorra de forma segura.
                    // =================================================================================
                    const promise = supabase.rpc('excluir_contrato_e_liberar_unidade', {
                        p_contrato_id: contratoParaExcluir.id,
                        p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
                    });

                    toast.promise(promise, {
                        loading: 'Excluindo contrato...',
                        success: (data) => {
                            setContratos(prevContratos => prevContratos.filter(c => c.id !== contratoParaExcluir.id));
                            return data;
                        },
                        error: (err) => `Erro ao excluir: ${err.message}`
                    });
                }
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
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
                                <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">{contrato.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-blue-600" onClick={() => router.push(`/contratos/${contrato.id}`)}>
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