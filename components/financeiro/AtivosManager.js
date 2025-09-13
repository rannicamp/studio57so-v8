// components/financeiro/AtivosManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth
import { useQuery } from '@tanstack/react-query'; // 2. Importar o useQuery
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBuilding, faFileSignature, faUser, faLandmark, faDollarSign } from '@fortawesome/free-solid-svg-icons';
import KpiCard from '../KpiCard';
import Link from 'next/link';

// Funções de formatação
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: Esta função agora busca os dados para o useQuery e inclui o filtro
// de segurança `organizacaoId`, garantindo que apenas os ativos da
// organização correta sejam retornados.
// =================================================================================
const fetchAtivos = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    
    const { data, error } = await supabase
        .from('contrato_permutas')
        .select(`
            *,
            contrato:contratos (
                id,
                contato:contato_id ( nome, razao_social ),
                empreendimento:empreendimentos ( nome )
            )
        `)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('data_registro', { ascending: false });

    if (error) {
        console.error("Erro ao buscar ativos:", error);
        throw new Error("Falha ao carregar os ativos.");
    }
    return data || [];
};

export default function AtivosManager() {
    const supabase = createClient();
    const { user } = useAuth(); // 3. Obter o usuário para o organizacaoId
    const organizacaoId = user?.organizacao_id;
    
    const [searchTerm, setSearchTerm] = useState('');

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: Substituímos a lógica antiga por useQuery. Ele gerencia o loading,
    // erros e o cache dos dados de forma automática. A `queryKey` inclui o
    // `organizacaoId` para um cache seguro por organização.
    // =================================================================================
    const { data: ativos = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ['ativos', organizacaoId],
        queryFn: () => fetchAtivos(supabase, organizacaoId),
        enabled: !!organizacaoId, // A busca só é ativada quando o ID da organização existe
    });

    const filteredAtivos = useMemo(() => {
        if (!searchTerm) return ativos;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return ativos.filter(ativo => 
            ativo.descricao.toLowerCase().includes(lowerSearchTerm) ||
            (ativo.contrato?.contato?.nome || '').toLowerCase().includes(lowerSearchTerm) ||
            (ativo.contrato?.contato?.razao_social || '').toLowerCase().includes(lowerSearchTerm) ||
            (ativo.contrato?.empreendimento?.nome || '').toLowerCase().includes(lowerSearchTerm)
        );
    }, [ativos, searchTerm]);

    const kpiData = useMemo(() => {
        const totalValor = filteredAtivos.reduce((sum, ativo) => sum + parseFloat(ativo.valor_permutado || 0), 0);
        return {
            totalAtivos: filteredAtivos.length,
            valorTotal: formatCurrency(totalValor)
        };
    }, [filteredAtivos]);

    if (loading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando ativos...</div>;
    }

    if (isError) {
        return <div className="text-center p-10 text-red-500">Erro ao carregar dados: {error.message}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard title="Total de Ativos" value={kpiData.totalAtivos} icon={faLandmark} color="blue" />
                <KpiCard title="Valor Total em Ativos" value={kpiData.valorTotal} icon={faDollarSign} color="green" />
            </div>
             <input
                type="text"
                placeholder="Buscar por descrição, cliente ou empreendimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded-md"
            />
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Data</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Ativo (Descrição)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Valor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Empreendimento</th>
                            <th className="px-6 py-3 text-center text-xs font-medium uppercase">Contrato</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAtivos.map((ativo) => (
                            <tr key={ativo.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">{formatDate(ativo.data_registro)}</td>
                                <td className="px-6 py-4 font-medium">{ativo.descricao}</td>
                                <td className="px-6 py-4 text-right font-semibold">{formatCurrency(ativo.valor_permutado)}</td>
                                <td className="px-6 py-4">{ativo.contrato?.contato?.nome || ativo.contrato?.contato?.razao_social || 'N/A'}</td>
                                <td className="px-6 py-4">{ativo.contrato?.empreendimento?.nome || 'N/A'}</td>
                                <td className="px-6 py-4 text-center">
                                    <Link href={`/contratos/${ativo.contrato?.id}`} className="text-blue-600 hover:text-blue-800" title="Ver Contrato">
                                        #{ativo.contrato?.id}
                                    </Link>
                                </td>
                            </tr>
                        ))}
                         {filteredAtivos.length === 0 && (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-gray-500">Nenhum ativo encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}