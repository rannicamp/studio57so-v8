// Local do Arquivo: components/configuracoes/CotacoesManager.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

// ... (o componente CotacaoList continua o mesmo, não precisa mexer)
const CotacaoList = ({ title, items, selectedItems, onToggle, searchTerm, setSearchTerm }) => (
    <div className="flex flex-col p-4 border rounded-md h-full">
        <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">{title}</h3>
        <input
            type="text"
            placeholder={`Pesquisar ${title.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 mb-4 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <div className="overflow-y-auto flex-grow pr-2">
            {items.map(cotacao => (
                <label key={cotacao.id} htmlFor={cotacao.id} className="flex items-center justify-between py-2 cursor-pointer">
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                        {cotacao.name}
                    </span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            id={cotacao.id}
                            className="sr-only peer"
                            checked={selectedItems.includes(cotacao.id)}
                            onChange={() => onToggle(cotacao.id)}
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </div>
                </label>
            ))}
        </div>
    </div>
);


export default function CotacoesManager({ user }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    // Estados para as preferências
    const [showBar, setShowBar] = useState(true);
    const [selectedCotacoes, setSelectedCotacoes] = useState([]);

    // Estados para pesquisa
    const [currencySearch, setCurrencySearch] = useState('');
    const [commoditySearch, setCommoditySearch] = useState('');

    // Carrega as configurações do usuário quando o componente é montado
    useEffect(() => {
        if (user) {
            setShowBar(user.mostrar_barra_cotacoes ?? true); // ?? true garante que não seja nulo
            setSelectedCotacoes(user.cotacoes_visiveis || []);
        }
    }, [user]);

    const { data: availableCotacoes, isLoading, isError, error } = useQuery({
        queryKey: ['availableCotacoes'],
        queryFn: () => fetch('/api/cotacoes').then(res => res.json()),
    });

    // Mutação para salvar TODAS as preferências de uma vez
    const mutation = useMutation({
        mutationFn: async (preferences) => {
            const { error } = await supabase
                .from('usuarios')
                .update({ 
                    mostrar_barra_cotacoes: preferences.showBar,
                    cotacoes_visiveis: preferences.selectedCotacoes 
                })
                .eq('id', user.id);

            if (error) throw new Error(error.message);
            return preferences;
        },
        onSuccess: () => {
            toast.success('Preferências de cotações salvas com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
        onError: (error) => toast.error(`Erro ao salvar: ${error.message}`),
    });

    const handleToggle = (cotacaoId) => {
        setSelectedCotacoes(prev =>
            prev.includes(cotacaoId) ? prev.filter(id => id !== cotacaoId) : [...prev, cotacaoId]
        );
    };

    const handleSave = () => {
        mutation.mutate({ showBar, selectedCotacoes });
    };

    const { currencies, commodities } = useMemo(() => {
        const filtered = { currencies: [], commodities: [] };
        if (!availableCotacoes) return filtered;
        filtered.currencies = availableCotacoes.filter(c => c.type === 'currency' && c.name.toLowerCase().includes(currencySearch.toLowerCase()));
        filtered.commodities = availableCotacoes.filter(c => c.type === 'commodity' && c.name.toLowerCase().includes(commoditySearch.toLowerCase()));
        return filtered;
    }, [availableCotacoes, currencySearch, commoditySearch]);

    if (isLoading) return <div>Carregando opções de cotações...</div>;
    if (isError) return <div>Erro ao carregar opções: {error.message}</div>;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md dark:bg-gray-800">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">Gerenciar Cotações</h2>
            
            {/* ##### 1. INTERRUPTOR PRINCIPAL ##### */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md mb-8">
                <label htmlFor="show-bar-toggle" className="flex items-center justify-between cursor-pointer">
                    <span className="text-lg font-bold text-gray-800 dark:text-white">Exibir Barra de Cotações no Topo</span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            id="show-bar-toggle"
                            className="sr-only peer"
                            checked={showBar}
                            onChange={() => setShowBar(!showBar)}
                        />
                        <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
                    </div>
                </label>
            </div>

            {/* A seleção de cotações só aparece se o interruptor principal estiver ligado */}
            {showBar && (
                <>
                    <p className="mb-6 text-gray-600 dark:text-gray-300">
                        Selecione abaixo quais cotações você deseja visualizar.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8" style={{ minHeight: '400px' }}>
                        <CotacaoList
                            title="Moedas"
                            items={currencies}
                            selectedItems={selectedCotacoes}
                            onToggle={handleToggle}
                            searchTerm={currencySearch}
                            setSearchTerm={setCurrencySearch}
                        />
                        <CotacaoList
                            title="Commodities"
                            items={commodities}
                            selectedItems={selectedCotacoes}
                            onToggle={handleToggle}
                            searchTerm={commoditySearch}
                            setSearchTerm={setCommoditySearch}
                        />
                    </div>
                </>
            )}

            <div className="mt-8 flex justify-end">
                <button 
                    onClick={handleSave} 
                    disabled={mutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mutation.isPending ? 'Salvando...' : 'Salvar Preferências'}
                </button>
            </div>
        </div>
    );
}