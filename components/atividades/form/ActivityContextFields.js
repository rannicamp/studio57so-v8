// Caminho: components/atividades/form/ActivityContextFields.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Pequeno componente auxiliar para destacar texto na busca de subetapas
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return (
        <span>
            {text.split(regex).map((part, i) =>
                regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 py-0 rounded">{part}</mark> : <span key={i}>{part}</span>
            )}
        </span>
    );
};

export default function ActivityContextFields({ 
    formData, 
    setFormData, 
    options, // { empresas, empreendimentos } vindos do Root
    organizacaoId 
}) {
    const supabase = createClient();
    
    // Estados locais para Etapas e Subetapas (pois dependem da seleção anterior)
    const [etapas, setEtapas] = useState([]);
    const [subetapas, setSubetapas] = useState([]);
    
    // Estados para o ComboBox de Subetapa
    const [subetapaSearch, setSubetapaSearch] = useState('');
    const [isSubetapaDropdownOpen, setIsSubetapaDropdownOpen] = useState(false);
    const [filteredSubetapas, setFilteredSubetapas] = useState([]);
    const [isCreatingSubetapa, setIsCreatingSubetapa] = useState(false);

    // --- 1. LÓGICA DE FILTRAGEM DE EMPREENDIMENTOS ---
    const filteredEmpreendimentos = useMemo(() => {
        if (!formData.empresa_id || !options.empreendimentos) return [];
        // Filtra obras que pertencem à empresa selecionada
        return options.empreendimentos.filter(e => e.empresa_proprietaria_id === parseInt(formData.empresa_id));
    }, [formData.empresa_id, options.empreendimentos]);

    // --- 2. BUSCA DE ETAPAS ---
    useEffect(() => {
        const fetchEtapas = async () => {
            // Regra de Negócio: Só busca etapas se tiver uma Obra selecionada (ou contexto definido)
            if (formData.empreendimento_id && organizacaoId) {
                const { data } = await supabase
                    .from('etapa_obra')
                    .select('id, nome_etapa, codigo_etapa')
                    .eq('organizacao_id', organizacaoId)
                    .order('codigo_etapa', { ascending: true });
                setEtapas(data || []);
            } else {
                setEtapas([]);
            }
        };
        fetchEtapas();
    }, [formData.empreendimento_id, organizacaoId, supabase]);

    // --- 3. BUSCA DE SUBETAPAS ---
    useEffect(() => {
        const fetchSubetapas = async () => {
            if (formData.etapa_id && organizacaoId) {
                const { data } = await supabase
                    .from('subetapas')
                    .select('id, nome_subetapa')
                    .eq('etapa_id', formData.etapa_id)
                    .eq('organizacao_id', organizacaoId)
                    .order('nome_subetapa');
                
                setSubetapas(data || []);
                
                // Se estiver editando e já tiver ID, preenche o texto da busca
                if (formData.subetapa_id) {
                    const selected = data?.find(s => s.id === formData.subetapa_id);
                    if (selected) setSubetapaSearch(selected.nome_subetapa);
                }
            } else {
                setSubetapas([]);
                setSubetapaSearch('');
            }
        };
        fetchSubetapas();
    }, [formData.etapa_id, formData.subetapa_id, organizacaoId, supabase]);

    // --- 4. FILTRO LOCAL DE SUBETAPAS ---
    useEffect(() => {
        if (!subetapaSearch) {
            setFilteredSubetapas(subetapas);
        } else {
            const lower = subetapaSearch.toLowerCase();
            const filtered = subetapas.filter(s => s.nome_subetapa.toLowerCase().includes(lower));
            setFilteredSubetapas(filtered);
            
            // Se o texto não bate com nenhum ID, limpa o ID selecionado (para forçar criar ou selecionar)
            const exact = subetapas.find(s => s.nome_subetapa.toLowerCase() === lower);
            if (!exact) {
                // Não limpamos o search, apenas o ID no formData
                // setFormData(prev => ({ ...prev, subetapa_id: null })); // Opcional: pode causar loop se não cuidar
            }
        }
    }, [subetapaSearch, subetapas]);

    // --- HANDLERS ---

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            
            // Logica de Reset em Cascata
            if (name === 'empresa_id') {
                newState.empreendimento_id = ''; // Reseta obra
                newState.etapa_id = '';          // Reseta etapa
                newState.subetapa_id = '';       // Reseta subetapa
                setSubetapaSearch('');
            }
            if (name === 'empreendimento_id') {
                newState.etapa_id = '';
                newState.subetapa_id = '';
                setSubetapaSearch('');
            }
            if (name === 'etapa_id') {
                newState.subetapa_id = '';
                setSubetapaSearch('');
            }
            return newState;
        });
    };

    const handleSelectSubetapa = (sub) => {
        setFormData(prev => ({ ...prev, subetapa_id: sub.id }));
        setSubetapaSearch(sub.nome_subetapa);
        setIsSubetapaDropdownOpen(false);
    };

    const handleCreateSubetapa = async () => {
        if (!subetapaSearch.trim() || !formData.etapa_id) return;
        
        setIsCreatingSubetapa(true);
        try {
            const { data, error } = await supabase
                .from('subetapas')
                .insert({
                    nome_subetapa: subetapaSearch.trim(),
                    etapa_id: formData.etapa_id,
                    organizacao_id: organizacaoId
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Subetapa criada!");
            setSubetapas(prev => [...prev, data]);
            handleSelectSubetapa(data);
        } catch (error) {
            toast.error("Erro ao criar subetapa.");
            console.error(error);
        } finally {
            setIsCreatingSubetapa(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
            
            {/* 1. EMPRESA */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                <select 
                    name="empresa_id" 
                    value={formData.empresa_id || ''} 
                    onChange={handleChange} 
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                    <option value="">Selecione a Empresa...</option>
                    {options.empresas?.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.razao_social || emp.nome_fantasia}</option>
                    ))}
                </select>
            </div>

            {/* 2. EMPREENDIMENTO */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empreendimento</label>
                <select 
                    name="empreendimento_id" 
                    value={formData.empreendimento_id || ''} 
                    onChange={handleChange} 
                    disabled={!formData.empresa_id}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                >
                    <option value="">
                        {!formData.empresa_id ? 'Selecione uma empresa primeiro' : 'Selecione o Empreendimento...'}
                    </option>
                    {filteredEmpreendimentos.map(obra => (
                        <option key={obra.id} value={obra.id}>{obra.nome}</option>
                    ))}
                </select>
            </div>

            {/* 3. ETAPA */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etapa da Obra</label>
                <select 
                    name="etapa_id" 
                    value={formData.etapa_id || ''} 
                    onChange={handleChange} 
                    disabled={!formData.empreendimento_id}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                >
                    <option value="">Selecione a Etapa...</option>
                    {etapas.map(etapa => (
                        <option key={etapa.id} value={etapa.id}>
                            {etapa.codigo_etapa ? `${etapa.codigo_etapa} - ` : ''}{etapa.nome_etapa}
                        </option>
                    ))}
                </select>
            </div>

            {/* 4. SUBETAPA (COMBOBOX) */}
            <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subetapa (Opcional)</label>
                <input
                    type="text"
                    value={subetapaSearch}
                    onChange={(e) => setSubetapaSearch(e.target.value)}
                    onFocus={() => setIsSubetapaDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsSubetapaDropdownOpen(false), 200)} // Delay para permitir clique
                    disabled={!formData.etapa_id}
                    placeholder={!formData.etapa_id ? "Selecione uma etapa..." : "Busque ou crie..."}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                    autoComplete="off"
                />
                
                {/* Dropdown de Sugestões */}
                {isSubetapaDropdownOpen && formData.etapa_id && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        {filteredSubetapas.map(sub => (
                            <div 
                                key={sub.id} 
                                onMouseDown={() => handleSelectSubetapa(sub)} // onMouseDown executa antes do onBlur
                                className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-50"
                            >
                                <HighlightedText text={sub.nome_subetapa} highlight={subetapaSearch} />
                            </div>
                        ))}
                        
                        {/* Opção de Criar Nova */}
                        {subetapaSearch && !filteredSubetapas.some(s => s.nome_subetapa.toLowerCase() === subetapaSearch.toLowerCase()) && (
                            <div 
                                onMouseDown={handleCreateSubetapa}
                                className="px-3 py-2 bg-green-50 hover:bg-green-100 cursor-pointer flex items-center gap-2 text-sm text-green-700 font-medium"
                            >
                                {isCreatingSubetapa ? (
                                    <><FontAwesomeIcon icon={faSpinner} spin /> Criando...</>
                                ) : (
                                    <><FontAwesomeIcon icon={faPlus} /> Criar: "{subetapaSearch}"</>
                                )}
                            </div>
                        )}
                        
                        {filteredSubetapas.length === 0 && !subetapaSearch && (
                            <div className="p-3 text-xs text-gray-400 text-center italic">Nenhuma subetapa cadastrada nesta etapa.</div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}