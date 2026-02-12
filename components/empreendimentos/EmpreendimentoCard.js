"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faStore, faStoreSlash, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function EmpreendimentoCard({ empreendimento, organizacaoId }) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    // Estado local para o toggle refletir o banco
    const [isListed, setIsListed] = useState(empreendimento.listado_para_venda || false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Garante que se o dado mudar externamente, o toggle atualiza
    useEffect(() => {
        setIsListed(empreendimento.listado_para_venda || false);
    }, [empreendimento.listado_para_venda]);

    // Mutação para atualizar o status no banco
    const updateVendaStatus = useMutation({
        mutationFn: async (novoStatus) => {
            setIsUpdating(true);
            const { error } = await supabase
                .from('empreendimentos')
                .update({ listado_para_venda: novoStatus })
                .eq('id', empreendimento.id);

            if (error) {
                throw new Error(error.message);
            }
            return novoStatus;
        },
        onSuccess: (novoStatus) => {
            setIsListed(novoStatus); // Atualiza o estado visual local
            toast.success(novoStatus ? "Empreendimento listado para venda!" : "Removido da listagem de venda.");
            // Invalida a query principal para forçar a recarga dos dados NA LISTA
            queryClient.invalidateQueries({ queryKey: ['empreendimentos', organizacaoId] });
        },
        onError: (error) => {
            toast.error(`Erro ao atualizar: ${error.message}`);
            // Reverte o estado visual em caso de erro
            setIsListed(!isListed);
        },
        onSettled: () => {
            setIsUpdating(false);
        }
    });

    const handleToggleClick = (e) => {
        // O PORQUÊ: Impede que o clique no botão ative o Link do card inteiro
        e.stopPropagation(); 
        e.preventDefault(); 

        const novoStatus = !isListed;
        // Atualiza visualmente primeiro (Optimistic UI)
        setIsListed(novoStatus); 
        updateVendaStatus.mutate(novoStatus);
    };
    
    // Funções de estilo
    const getStatusClass = (status) => {
        switch (status) {
            case 'Lancamento': return 'bg-blue-100 text-blue-800';
            case 'Em Obras': return 'bg-yellow-100 text-yellow-800';
            case 'Concluido': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    const statusLabel = empreendimento.status || 'Não definido';
    const proprietaria = empreendimento.empresa_proprietaria?.razao_social || 'Proprietário não definido';

    return (
        <Link 
            href={`/empreendimentos/${empreendimento.id}`} 
            className="block group rounded-lg overflow-hidden shadow-lg bg-white hover:shadow-xl transition-shadow duration-300 ease-in-out flex flex-col justify-between"
        >
            <div> {/* Div para agrupar imagem e texto */}
                <div className="relative w-full h-48">
                    {empreendimento.imagem_capa_url ? (
                        /* CORREÇÃO APLICADA AQUI: */
                        <Image
                            src={empreendimento.imagem_capa_url}
                            alt={`Imagem de capa do ${empreendimento.nome}`}
                            fill // Substitui o layout="fill"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Boa prática para performance
                            className="object-cover transition-transform duration-300 group-hover:scale-105" // Adicionado object-cover aqui
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <FontAwesomeIcon icon={faBuilding} className="text-gray-400" size="3x" />
                        </div>
                    )}
                </div>
                
                <div className="p-4">
                    <h3 className="text-xl font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors duration-300">
                        {empreendimento.nome}
                    </h3>
                    
                    <p className="text-sm text-gray-600 mt-1 truncate" title={proprietaria}>
                        {proprietaria}
                    </p>

                    <div className="mt-3">
                        <span 
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getStatusClass(statusLabel)}`}
                        >
                            {statusLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* ======================= BOTÃO TOGGLE ======================= */}
            <div 
                className="p-4 border-t border-gray-200 mt-auto bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={handleToggleClick}
                role="button"
                aria-pressed={isListed}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleToggleClick(e); }}
            >
                <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center">
                         <FontAwesomeIcon 
                            icon={isListed ? faStore : faStoreSlash} 
                            className={`mr-2 ${isListed ? 'text-green-500' : 'text-red-500'}`} 
                        />
                        <span className="text-sm font-medium text-gray-700">
                            {isListed ? "Listado para Venda" : "Não Listado"}
                        </span>
                    </div>
                    {isUpdating ? (
                         <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
                    ) : (
                        <div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${ isListed ? 'bg-green-500' : 'bg-gray-300' }`}>
                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${ isListed ? 'translate-x-6' : 'translate-x-1' }`} />
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}