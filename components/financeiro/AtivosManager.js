"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLandmark, faDollarSign, faFileContract, faUser, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import KpiCard from '@/components/shared/KpiCard';
import Link from 'next/link';
import { toast } from 'sonner';

// Funções de formatação
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A';

// =================================================================================
// CORREÇÃO DA QUERY - RESOLUÇÃO DE AMBIGUIDADE
// O PORQUÊ: A tabela 'contratos' tem várias ligações com 'contatos' (cliente, corretor, etc).
// Para o Supabase saber qual trazer, usamos a notação explícita com o nome da FK:
// contato:contatos!contratos_contato_id_fkey (...)
// Isso diz: "Traga a tabela contatos usando a ligação do campo contato_id".
// =================================================================================
const fetchAtivos = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    
    const { data, error } = await supabase
        .from('contrato_permutas')
        .select(`
            *,
            contrato:contratos (
                id,
                contato:contatos!contratos_contato_id_fkey ( nome, razao_social ),
                empreendimento:empreendimentos ( nome )
            )
        `)
        .eq('organizacao_id', organizacaoId)
        .order('data_registro', { ascending: false });

    if (error) {
        console.error("Erro detalhado ao buscar ativos:", error);
        throw new Error(error.message || "Erro desconhecido ao buscar ativos.");
    }
    return data || [];
};

export default function AtivosManager() {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    
    const [searchTerm, setSearchTerm] = useState('');

    const { data: ativos = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ['ativos', organizacaoId],
        queryFn: () => fetchAtivos(supabase, organizacaoId),
        enabled: !!organizacaoId,
        retry: 1, 
    });

    if (isError) {
        // Evita toast duplicado se o componente renderizar o erro visualmente
        // toast.error(`Erro no banco de dados: ${error.message}`);
    }

    const filteredAtivos = useMemo(() => {
        if (!searchTerm) return ativos;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return ativos.filter(ativo => 
            ativo.descricao?.toLowerCase().includes(lowerSearchTerm) ||
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
        return (
            <div className="text-center p-10 bg-red-50 rounded-lg border border-red-200">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 text-3xl mb-3" />
                <h3 className="text-red-800 font-bold">Não foi possível carregar os ativos</h3>
                <p className="text-red-600 mt-2 text-sm font-mono bg-white p-2 rounded border inline-block max-w-full overflow-auto">
                    {error.message}
                </p>
                <p className="text-gray-600 mt-4 text-sm">
                    Verifique a conexão ou tente recarregar a página.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard 
                    title="Total de Permutas/Ativos" 
                    value={kpiData.totalAtivos} 
                    icon={faLandmark} 
                    color="blue" 
                />
                <KpiCard 
                    title="Valor Total em Carteira" 
                    value={kpiData.valorTotal} 
                    icon={faDollarSign} 
                    color="green" 
                />
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border">
                <div className="mb-4">
                     <input
                        type="text"
                        placeholder="Buscar por descrição, cliente ou empreendimento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 border rounded-md"
                    />
                </div>

                <div className="overflow-x-auto rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold uppercase text-gray-600">Data</th>
                                <th className="px-4 py-3 text-left font-bold uppercase text-gray-600">Descrição do Ativo</th>
                                <th className="px-4 py-3 text-right font-bold uppercase text-gray-600">Valor Permutado</th>
                                <th className="px-4 py-3 text-left font-bold uppercase text-gray-600"><FontAwesomeIcon icon={faUser} /> Cliente Origem</th>
                                <th className="px-4 py-3 text-left font-bold uppercase text-gray-600"><FontAwesomeIcon icon={faLandmark} /> Empreendimento</th>
                                <th className="px-4 py-3 text-center font-bold uppercase text-gray-600">Link</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAtivos.map((ativo) => (
                                <tr key={ativo.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-4 py-3 text-gray-500">{formatDate(ativo.data_registro)}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{ativo.descricao}</td>
                                    <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(ativo.valor_permutado)}</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {ativo.contrato?.contato?.nome || ativo.contrato?.contato?.razao_social || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {ativo.contrato?.empreendimento?.nome || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {ativo.contrato?.id ? (
                                            <Link href={`/contratos/${ativo.contrato.id}`} className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                                <FontAwesomeIcon icon={faFileContract} /> Ver Contrato
                                            </Link>
                                        ) : (
                                            <span className="text-xs text-gray-400">Sem contrato</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                             {filteredAtivos.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-10 text-gray-500">
                                        <p>Nenhum ativo encontrado.</p>
                                        <p className="text-xs mt-2">Verifique se as permutas foram cadastradas corretamente.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}