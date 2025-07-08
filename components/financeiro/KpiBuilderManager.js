"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartLine, faCalculator, faPlus, faTrash, faPen, faSyncAlt } from '@fortawesome/free-solid-svg-icons';

// --- COMPONENTE DO MODAL (sem alterações) ---
const KpiFormModal = ({ isOpen, onClose, onSave, indicesDisponiveis }) => {
    const getInitialState = () => ({
        nome_kpi: '',
        descricao: '',
        formula: '',
        formato_exibicao: 'numero'
    });

    const [kpiData, setKpiData] = useState(getInitialState());
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setKpiData(getInitialState());
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setKpiData(prev => ({ ...prev, [name]: value }));
    };

    const handleInsertIndice = (nomeIndice) => {
        setKpiData(prev => ({ ...prev, formula: prev.formula + `[${nomeIndice}]` }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        await onSave(kpiData);
        setIsLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-full max-w-3xl space-y-4">
                <h3 className="text-xl font-bold mb-4">Novo KPI Financeiro</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Nome do KPI *</label>
                        <input type="text" name="nome_kpi" value={kpiData.nome_kpi} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Margem de Lucro da Obra"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Formato de Exibição *</label>
                        <select name="formato_exibicao" value={kpiData.formato_exibicao} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                            <option value="numero">Número</option>
                            <option value="moeda">Moeda (R$)</option>
                            <option value="porcentagem">Porcentagem (%)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium">Descrição</label>
                    <input type="text" name="descricao" value={kpiData.descricao} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="O que este KPI representa?"/>
                </div>
                
                <div>
                    <label className="block text-sm font-medium">Índices Disponíveis (Clique para adicionar à fórmula)</label>
                    <div className="flex flex-wrap gap-2 mt-2 p-2 bg-gray-100 rounded-md">
                        {indicesDisponiveis.length === 0 ? (
                            <p className="text-xs text-gray-500">Crie índices na aba anterior para usá-los aqui.</p>
                        ) : (
                             indicesDisponiveis.map(indice => (
                                <button type="button" key={indice.id} onClick={() => handleInsertIndice(indice.nome_indice)} className="bg-blue-100 text-blue-800 text-xs font-mono font-bold px-2 py-1 rounded hover:bg-blue-200">
                                    {indice.nome_indice}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium">Fórmula *</label>
                    <textarea name="formula" value={kpiData.formula} onChange={handleChange} required rows="4" className="mt-1 w-full p-2 border rounded-md font-mono text-sm" placeholder="Ex: ([RECEITA_TOTAL] - [CUSTO_TOTAL]) / [RECEITA_TOTAL]"></textarea>
                    <p className="text-xs text-gray-500 mt-1">Use parênteses para ordem de operações e os operadores +, -, *, /.</p>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Cancelar</button>
                    <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
                        {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar KPI'}
                    </button>
                </div>
            </form>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL (com as correções) ---
export default function KpiBuilderManager() {
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState('indices');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const [savedFilters, setSavedFilters] = useState([]);
    const [indices, setIndices] = useState([]);
    const [kpis, setKpis] = useState([]);

    const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
    const [kpiResults, setKpiResults] = useState({}); // NOVO: Armazena os resultados dos KPIs
    const [isCalculating, setIsCalculating] = useState(false); // NOVO: Controla o estado de cálculo

    const fetchData = useCallback(async (recalculate = false) => {
        if (!recalculate) setLoading(true);
        else setIsCalculating(true);

        const loadedFilters = JSON.parse(localStorage.getItem('savedFinancialFilters') || '[]');
        setSavedFilters(loadedFilters);

        const { data: indicesData } = await supabase.from('indices_financeiros').select('*');
        setIndices(indicesData || []);
        
        const { data: kpisData } = await supabase.from('kpis_financeiros').select('*');
        setKpis(kpisData || []);

        // NOVO: Dispara o cálculo dos KPIs
        if (kpisData && kpisData.length > 0) {
            const results = {};
            for (const kpi of kpisData) {
                const { data, error } = await supabase.rpc('calcular_kpi', { p_kpi_id: kpi.id });
                if (error) {
                    console.error(`Erro ao calcular KPI "${kpi.nome_kpi}":`, error);
                    results[kpi.id] = { error: error.message };
                } else {
                    results[kpi.id] = { value: data };
                }
            }
            setKpiResults(results);
        }
        
        if (!recalculate) setLoading(false);
        else setIsCalculating(false);

    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatKpiValue = (value, format) => {
        if (value === null || value === undefined) return 'N/A';
        try {
            if (format === 'moeda') {
                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
            }
            if (format === 'porcentagem') {
                return `${(value * 100).toFixed(2)}%`;
            }
            return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
        } catch (e) {
            return 'Erro de Formato';
        }
    };


    const handleCreateIndice = async (filtro) => {
        const nomeIndice = prompt(`Dê um nome para este índice (use apenas letras e underscores, ex: CUSTO_OBRA_X):\nFiltro: ${filtro.name}`);
        if (!nomeIndice || !/^[A-Z_]+$/i.test(nomeIndice)) {
            alert("Nome inválido. Use apenas letras e underscores (sem espaços ou números).");
            return;
        }
        const { error } = await supabase.from('indices_financeiros').insert({
            nome_indice: nomeIndice.toUpperCase(),
            descricao: filtro.name,
            configuracao_filtro: filtro.settings
        });
        if (error) setMessage(`Erro: ${error.message}`);
        else { setMessage("Índice criado com sucesso!"); fetchData(); }
    };
    
    const handleDeleteIndice = async (id) => {
        if (!window.confirm("Tem certeza que deseja apagar este índice? Isso pode quebrar KPIs que o utilizam.")) return;
        await supabase.from('indices_financeiros').delete().eq('id', id);
        fetchData();
    }
    
    const handleSaveKpi = async (kpiData) => {
        const { error } = await supabase.from('kpis_financeiros').insert(kpiData);
        if (error) setMessage(`Erro ao criar KPI: ${error.message}`);
        else { setMessage("KPI criado com sucesso!"); fetchData(true); }
    };

    const handleDeleteKpi = async (id) => {
        if (!window.confirm("Tem certeza que deseja apagar este KPI?")) return;
        await supabase.from('kpis_financeiros').delete().eq('id', id);
        fetchData();
    }

    const TabButton = ({ tabName, label, icon }) => (
        <button onClick={() => setActiveTab(tabName)} className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <FontAwesomeIcon icon={icon} /> {label}
        </button>
    );

    if (loading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Construtor de Indicadores</h1>
            <p className="text-sm text-gray-600">Transforme filtros em índices e crie KPIs com fórmulas personalizadas.</p>
            {message && <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</div>}
            <div className="border-b"><nav className="flex gap-4"><TabButton tabName="indices" label="1. Gerenciar Índices" icon={faChartLine} /><TabButton tabName="kpis" label="2. Gerenciar KPIs" icon={faCalculator} /></nav></div>
            {activeTab === 'indices' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold mb-2">Filtros Salvos</h3>
                        <p className="text-xs text-gray-500 mb-4">Estes são os filtros que você salvou na tela de lançamentos. Clique em "+" para transformá-los em um índice.</p>
                        <div className="space-y-2 max-h-96 overflow-y-auto p-2 border rounded-md">
                            {savedFilters.length === 0 ? <p className="text-sm text-gray-500 text-center p-4">Nenhum filtro salvo encontrado.</p> :
                            savedFilters.map(filtro => (<div key={filtro.name} className="flex justify-between items-center p-2 bg-gray-50 rounded"><span>{filtro.name}</span><button onClick={() => handleCreateIndice(filtro)} title="Criar índice a partir deste filtro" className="bg-green-500 text-white w-6 h-6 rounded flex items-center justify-center hover:bg-green-600"><FontAwesomeIcon icon={faPlus} /></button></div>))}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Índices Criados</h3>
                        <p className="text-xs text-gray-500 mb-4">Estes são os índices disponíveis para usar nas fórmulas dos KPIs.</p>
                        <div className="space-y-2 max-h-96 overflow-y-auto p-2 border rounded-md">
                            {indices.length === 0 ? <p className="text-sm text-gray-500 text-center p-4">Nenhum índice criado.</p> :
                            indices.map(indice => (<div key={indice.id} className="flex justify-between items-center p-2 bg-blue-50 rounded"><div><p className="font-mono font-bold text-blue-800">{indice.nome_indice}</p><p className="text-xs text-gray-600">Origem: {indice.descricao}</p></div><button onClick={() => handleDeleteIndice(indice.id)} title="Excluir índice" className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button></div>))}
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'kpis' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">KPIs Personalizados</h3>
                        <div className="flex items-center gap-4">
                            <button onClick={() => fetchData(true)} disabled={isCalculating} className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-wait" title="Recalcular KPIs"><FontAwesomeIcon icon={faSyncAlt} spin={isCalculating} /></button>
                            <button onClick={() => setIsKpiModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"><FontAwesomeIcon icon={faPlus}/> Novo KPI</button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {kpis.length === 0 ? (
                            <p className="p-4 border rounded-md text-center text-gray-500">Nenhum KPI criado ainda.</p>
                        ) : (
                            kpis.map(kpi => (
                                <div key={kpi.id} className="p-4 bg-white border rounded-lg shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg text-gray-800">{kpi.nome_kpi}</p>
                                            <p className="text-xs text-gray-500">{kpi.descricao}</p>
                                            <p className="text-sm font-mono bg-gray-100 p-1 rounded inline-block mt-2">{kpi.formula}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-4">
                                            {kpiResults[kpi.id]?.error ? (
                                                <span className="font-bold text-xl text-red-500" title={kpiResults[kpi.id].error}>Erro!</span>
                                            ) : (
                                                <span className="font-bold text-2xl text-blue-700">
                                                    {isCalculating ? <FontAwesomeIcon icon={faSpinner} spin /> : formatKpiValue(kpiResults[kpi.id]?.value, kpi.formato_exibicao)}
                                                </span>
                                            )}
                                            <button onClick={() => handleDeleteKpi(kpi.id)} className="text-gray-400 hover:text-red-500 text-xs ml-2"><FontAwesomeIcon icon={faTrash} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <KpiFormModal isOpen={isKpiModalOpen} onClose={() => setIsKpiModalOpen(false)} onSave={handleSaveKpi} indicesDisponiveis={indices} />
                </div>
            )}
        </div>
    );
}