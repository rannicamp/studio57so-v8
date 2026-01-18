// components/rh/GerenciamentoTerceirizados.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // <--- O GPS DO NEXT.JS
import { createClient } from '../../utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFileContract, 
    faPlus, 
    faCalendarAlt, 
    faMoneyBillWave, 
    faSpinner,
    faTrash,
    faExclamationTriangle,
    faFolderOpen, // <--- Ícone novo para "Abrir Pasta"
    faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import NovoContratoModal from './NovoContratoModal';

export default function GerenciamentoTerceirizados({ searchTerm }) {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- QUERY: Buscar Contratos Ativos ---
    const { data: contratos = [], isLoading, error } = useQuery({
        queryKey: ['contratos_terceirizados', user?.organizacao_id],
        queryEnabled: !!user?.organizacao_id,
        queryFn: async () => {
            // Buscamos o contrato E os dados do fornecedor conectado
            const { data, error } = await supabase
                .from('contratos_terceirizados')
                .select(`
                    *,
                    fornecedor:contatos(nome, razao_social, cnpj, foto_url)
                `)
                .eq('organizacao_id', user.organizacao_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
    });

    // --- MUTATION: Excluir Contrato ---
    const deleteContrato = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('contratos_terceirizados').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['contratos_terceirizados']);
            toast.success('Contrato removido.');
        },
        onError: () => toast.error('Erro ao excluir contrato.')
    });

    // --- FILTRAGEM ---
    const filteredList = contratos.filter(c => {
        const nomeFornecedor = c.fornecedor?.nome || c.fornecedor?.razao_social || '';
        const titulo = c.titulo || '';
        const termo = searchTerm?.toLowerCase() || '';
        
        return nomeFornecedor.toLowerCase().includes(termo) || 
               titulo.toLowerCase().includes(termo);
    });

    if (isLoading) return <div className="p-12 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>;
    if (error) return <div className="p-8 text-center text-red-500">Erro ao carregar contratos.</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Cabeçalho da Seção */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Contratos Vigentes</h3>
                    <p className="text-sm text-gray-500">Gerencie os serviços terceirizados ativos.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Novo Contrato
                </button>
            </div>

            {/* Grid de Contratos */}
            {filteredList.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <FontAwesomeIcon icon={faFileContract} className="text-gray-300 text-5xl mb-4" />
                    <p className="text-gray-500 font-medium">Nenhum contrato ativo encontrado.</p>
                    <p className="text-sm text-gray-400 mt-1">Clique em "Novo Contrato" para começar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredList.map(contrato => (
                        <ContratoCard 
                            key={contrato.id} 
                            contrato={contrato} 
                            onDelete={() => {
                                if(confirm('Tem certeza que deseja excluir este contrato?')) {
                                    deleteContrato.mutate(contrato.id);
                                }
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <NovoContratoModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries(['contratos_terceirizados'])}
            />
        </div>
    );
}

// Card Individual do Contrato
function ContratoCard({ contrato, onDelete }) {
    const router = useRouter(); // Hook para navegação
    const nome = contrato.fornecedor?.nome || contrato.fornecedor?.razao_social || 'Fornecedor Desconhecido';
    
    // Formatação de Moeda
    const valorFormatado = contrato.valor_total 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contrato.valor_total)
        : 'A combinar';

    // Formatação de Data
    const formatDate = (dateString) => {
        if (!dateString) return 'Indeterminado';
        const [ano, mes, dia] = dateString.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const handleOpenDossier = () => {
        // Navega para a página de detalhes
        router.push(`/recursos-humanos/contratos/${contrato.id}`);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow relative group flex flex-col h-full">
            
            {/* Header do Card */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        {nome.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 leading-tight truncate max-w-[150px]" title={nome}>
                            {nome}
                        </h4>
                        <p className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">
                            {contrato.titulo}
                        </p>
                    </div>
                </div>
                
                {/* Menu de Ações Rápido (Excluir) */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors p-2"
                    title="Excluir Contrato"
                >
                    <FontAwesomeIcon icon={faTrash} />
                </button>
            </div>

            <hr className="border-gray-100 my-3" />

            {/* Detalhes (Corpo) */}
            <div className="space-y-2 text-sm text-gray-600 flex-grow">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-400 w-4" />
                    <span>
                        <span className="font-medium">Vigência:</span> {formatDate(contrato.data_inicio)} 
                        {contrato.data_fim ? ` até ${formatDate(contrato.data_fim)}` : ' (Indeterminado)'}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-green-500 w-4" />
                    <span className="font-bold text-green-700">{valorFormatado}</span>
                </div>

                {contrato.descricao && (
                    <div className="mt-3 bg-gray-50 p-2 rounded text-xs text-gray-500 italic line-clamp-2">
                        "{contrato.descricao}"
                    </div>
                )}
            </div>

            {/* Rodapé do Card com Botão de Ação */}
            <div className="mt-4 pt-3 border-t border-gray-100">
                <button 
                    onClick={handleOpenDossier}
                    className="w-full py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 group-hover:shadow-sm"
                >
                    <FontAwesomeIcon icon={faFolderOpen} />
                    Gerenciar Contrato
                    <FontAwesomeIcon icon={faArrowRight} className="text-xs opacity-60" />
                </button>
            </div>
            
            {/* Indicador de Vencido */}
            {contrato.data_fim && new Date(contrato.data_fim) < new Date() && (
                <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded shadow-sm border border-red-200 flex items-center gap-1 z-10">
                    <FontAwesomeIcon icon={faExclamationTriangle} /> Vencido
                </div>
            )}
        </div>
    );
}