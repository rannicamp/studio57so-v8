"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';

export default function ContratoList({ initialContratos }) {
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    const filteredContratos = useMemo(() => {
        return initialContratos.filter(c => {
            const cliente = c.contato?.nome || c.contato?.razao_social || '';
            const produto = c.produto?.unidade || '';
            const empreendimento = c.empreendimento?.nome || '';
            return (
                cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                empreendimento.toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
    }, [initialContratos, searchTerm]);
    
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pt-BR');
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
                            <tr key={contrato.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/contratos/${contrato.id}`)}>
                                <td className="px-6 py-4 whitespace-nowrap">{contrato.contato?.nome || contrato.contato?.razao_social || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">Unidade {contrato.produto?.unidade || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{contrato.empreendimento?.nome || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(contrato.data_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">{formatCurrency(contrato.valor_final_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <FontAwesomeIcon icon={faEye} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}