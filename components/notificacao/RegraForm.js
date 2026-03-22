"use client";

import { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown, faMobileAlt, faColumns, faSave, faSpinner, faMagic, faLink, faPlus, faTrash
} from '@fortawesome/free-solid-svg-icons';
// Importação do novo gerenciador
import VariableManagerModal from './VariableManagerModal';
import { AVAILABLE_ICONS } from './constants';
// Importação do hook de persistência
import { usePersistentState } from '@/hooks/usePersistentState';

// --- LISTA DE OPERADORES NOVOS ---
const OPERADORES = [
    { value: 'igual', label: '=' },
    { value: 'diferente', label: '!=' },
    { value: 'contem', label: 'Contém' },
    { value: 'nao_contem', label: 'Não Contém' },
    { value: 'maior', label: '>' },
    { value: 'menor', label: '<' },
    { value: 'vazio', label: 'Vazio' },
    { value: 'nao_vazio', label: 'Preenchido' },
    { value: 'mudou', label: 'Mudou' }
];

export default function RegraForm({ initialData, tabelas, campos, funcoes, variaveisVirtuais, onSubmit, isSaving, onCancel }) {

    // Valor padrão
    const defaultValues = {
        nome_regra: '', tabela_alvo: '', evento: 'INSERT',
        // Mantemos compatibilidade com legado
        coluna_monitorada: '', valor_gatilho: '',
        enviar_para_dono: false,
        titulo_template: 'Nova notificação', mensagem_template: '{conteudo}', link_template: '/',
        ativo: true, icone: 'fa-bell',
        // NOVA LISTA DE FILTROS
        regras_avancadas: []
    };

    // Usa 'notif_formData' para lembrar o que estava sendo digitado (Persistência)
    const [formData, setFormData] = usePersistentState('notif_formData', initialData || defaultValues);

    // Sincroniza se o initialData mudar (Converte regra antiga para lista nova)
    useEffect(() => {
        if (initialData) {
            let dadosProntos = { ...initialData };

            // Se tiver filtro antigo (coluna_monitorada) mas não o novo array, converte para exibir na lista
            if (dadosProntos.coluna_monitorada && (!dadosProntos.regras_avancadas || dadosProntos.regras_avancadas.length === 0)) {
                dadosProntos.regras_avancadas = [{
                    campo: dadosProntos.coluna_monitorada,
                    operador: 'igual',
                    valor: dadosProntos.valor_gatilho || ''
                }];
            }

            // Garante que o array existe
            if (!dadosProntos.regras_avancadas) dadosProntos.regras_avancadas = [];

            setFormData(dadosProntos);
        }
    }, [initialData, setFormData]);

    const [showSuggestions, setShowSuggestions] = useState({ visible: false, field: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [showLinkerModal, setShowLinkerModal] = useState(false);

    // --- LÓGICA DE ADICIONAR/REMOVER FILTROS ---
    const addCondition = () => {
        const novas = [...(formData.regras_avancadas || [])];
        novas.push({ campo: '', operador: 'igual', valor: '' });
        setFormData(prev => ({ ...prev, regras_avancadas: novas }));
    };

    const removeCondition = (index) => {
        const novas = [...(formData.regras_avancadas || [])];
        novas.splice(index, 1);
        setFormData(prev => ({ ...prev, regras_avancadas: novas }));
    };

    const updateCondition = (index, field, value) => {
        const novas = [...(formData.regras_avancadas || [])];
        novas[index] = { ...novas[index], [field]: value };
        setFormData(prev => ({ ...prev, regras_avancadas: novas }));
    };

    // --- CÁLCULO DE VARIÁVEIS (Mantido Original) ---
    const todasVariaveis = useMemo(() => {
        if (!formData.tabela_alvo) return [];

        let variaveis = [];

        if (tabelas && campos) {
            const tabelaObj = tabelas.find(t => t.nome_tabela === formData.tabela_alvo);
            if (tabelaObj) {
                variaveis = campos
                    .filter(c => c.tabela_id === tabelaObj.id)
                    .map(c => ({ id: c.nome_coluna, nome: c.nome_coluna, desc: c.tipo_dado, tipo: 'coluna' }));
            }
        }

        if (variaveisVirtuais) {
            const virtuaisDaTabela = variaveisVirtuais.filter(v => v.tabela_gatilho === formData.tabela_alvo);
            virtuaisDaTabela.forEach(v => {
                variaveis.push({
                    id: v.nome_variavel,
                    nome: v.nome_variavel,
                    desc: `Link: ${v.tabela_destino}.${v.coluna_retorno}`,
                    tipo: 'virtual'
                });
            });
        }

        if (formData.tabela_alvo === 'whatsapp_messages') {
            variaveis.push({ id: 'nome_remetente', nome: 'nome_remetente', desc: 'Automático', tipo: 'magic' });
            variaveis.push({ id: 'content', nome: 'content', desc: 'Mensagem', tipo: 'magic' });
        }

        return variaveis;
    }, [formData.tabela_alvo, tabelas, campos, variaveisVirtuais]);

    const variaveisFiltradas = useMemo(() => {
        if (!searchTerm) return todasVariaveis;
        return todasVariaveis.filter(v =>
            v.nome.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [todasVariaveis, searchTerm]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'titulo_template' || name === 'mensagem_template') {
            const lastOpenBrace = value.lastIndexOf('{');
            const lastCloseBrace = value.lastIndexOf('}');

            if (lastOpenBrace > -1 && lastOpenBrace > lastCloseBrace) {
                const termoDigitado = value.slice(lastOpenBrace + 1);
                setSearchTerm(termoDigitado);
                setShowSuggestions({ visible: true, field: name });
            } else {
                setShowSuggestions({ visible: false, field: null });
                setSearchTerm('');
            }
        }

        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const insertVariable = (variableName) => {
        if (!showSuggestions.field) return;

        setFormData(prev => {
            const fieldName = showSuggestions.field;
            const currentValue = prev[fieldName];
            const lastOpenBrace = currentValue.lastIndexOf('{');
            const prefix = currentValue.slice(0, lastOpenBrace);

            return {
                ...prev,
                [fieldName]: `${prefix}{${variableName}} `
            };
        });

        setShowSuggestions({ visible: false, field: null });
        setSearchTerm('');
    };

    // Preparação final para envio: limpa campos legados se usar lista nova
    const handleFinalSubmit = () => {
        const payload = { ...formData };

        // Se usar filtros novos, anula os antigos para o banco não se confundir
        if (payload.regras_avancadas && payload.regras_avancadas.length > 0) {
            payload.coluna_monitorada = null;
            payload.valor_gatilho = null;
        }

        onSubmit(payload);
    };

    return (
        <div className="space-y-8 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER DO FORMULÁRIO */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center">
                        <FontAwesomeIcon icon={faMagic} />
                    </div>
                    {initialData?.id ? 'Editar Regra Existente' : initialData ? 'Nova Regra (A partir de Cópia)' : 'Criar Nova Notificação'}
                </h3>
                <button onClick={onCancel} className="text-sm font-bold text-gray-400 hover:text-gray-800 hover:bg-gray-50 px-4 py-2 rounded-xl transition-all">
                    Voltar para lista
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* COLUNA 1: IDENTIDADE */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <label className="block text-[11px] font-extrabold text-gray-500 mb-3 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-5 h-5 rounded flex items-center justify-center bg-gray-200 text-gray-600 text-[10px]">1</span>
                            Identidade
                        </label>

                        <input required name="nome_regra" value={formData.nome_regra} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 shadow-sm mb-5" placeholder="Nomeie sua regra..." />

                        <label className="block text-[10px] font-bold text-gray-400 mt-2 mb-2 uppercase tracking-wide">Escolha um Ícone</label>
                        <div className="grid grid-cols-4 gap-2">
                            {AVAILABLE_ICONS.map((item) => (
                                <button key={item.name} type="button" onClick={() => setFormData(prev => ({ ...prev, icone: item.name }))} className={`aspect-square rounded-xl flex items-center justify-center text-lg transition-all ${formData.icone === item.name ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105 ring-2 ring-blue-100' : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-100 hover:text-gray-600'}`} title={item.label}>
                                    <FontAwesomeIcon icon={item.icon} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLUNA 2 E 3: CONFIGURAÇÃO (GATILHO + AÇÃO) */}
                <div className="lg:col-span-3 space-y-6">

                    {/* SESSÃO 1: ONDE (GATILHO) */}
                    <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>

                        <div className="relative z-10">
                            <h4 className="text-[11px] font-extrabold text-blue-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                                <span className="w-5 h-5 rounded flex items-center justify-center bg-blue-200 text-blue-700 text-[10px]">2</span>
                                Gatilho do Alerta (Onde)
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wide">Módulo / Tabela do Banco</label>
                                    <select required name="tabela_alvo" value={formData.tabela_alvo} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
                                        <option value="" className="text-gray-900 bg-white font-bold">Selecione...</option>
                                        {tabelas && tabelas.map(t => <option key={t.id} value={t.nome_tabela} className="text-gray-900 bg-white font-medium">{t.nome_exibicao} ({t.modulo})</option>)}
                                        <option value="activities" className="text-gray-900 bg-white font-medium">Atividades (Manual)</option>
                                        <option value="whatsapp_messages" className="text-gray-900 bg-white font-medium">WhatsApp (Manual)</option>
                                        <option value="produtos_empreendimento" className="text-gray-900 bg-white font-medium">Produtos (Manual)</option>
                                        <option value="contratos" className="text-gray-900 bg-white font-medium">Contratos (Manual)</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wide">O que vai acontecer? (Evento)</label>
                                    <select name="evento" value={formData.evento} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
                                        <option value="INSERT" className="text-gray-900 bg-white font-medium">Sempre que Criar</option>
                                        <option value="UPDATE" className="text-gray-900 bg-white font-medium">Sempre que Atualizar</option>
                                        <option value="DELETE" className="text-gray-900 bg-white font-medium">Sempre que Excluir</option>
                                    </select>
                                </div>
                            </div>

                            {/* --- AQUI ESTÁ A MELHORIA: FILTROS MÚLTIPLOS --- */}
                            <div className="mt-8 pt-5 border-t border-blue-200/50">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[11px] font-extrabold text-blue-500 uppercase tracking-wider flex items-center gap-2">
                                        <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                                            <FontAwesomeIcon icon={faColumns} />
                                        </div>
                                        Filtros / Condições Específicas
                                    </p>
                                    <button type="button" onClick={addCondition} className="text-[11px] font-bold bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 hover:shadow-sm transition-all flex items-center gap-2">
                                        <FontAwesomeIcon icon={faPlus} /> Adicionar Filtro
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* Renderiza a lista de regras */}
                                    {formData.regras_avancadas && formData.regras_avancadas.map((cond, idx) => (
                                        <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-center bg-white/50 p-2 rounded-xl border border-blue-100 animate-in slide-in-from-left-2 duration-300">
                                            {/* Select de Campo */}
                                            <div className="w-full md:w-1/3">
                                                <select
                                                    value={cond.campo}
                                                    onChange={(e) => updateCondition(idx, 'campo', e.target.value)}
                                                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-400 outline-none shadow-sm transition-all"
                                                >
                                                    <option value="" className="text-gray-900 bg-white font-bold">Selecione o Campo...</option>
                                                    {todasVariaveis.filter(v => v.tipo === 'coluna').map(c => <option key={c.id} value={c.nome} className="text-gray-900 bg-white font-medium">{c.nome}</option>)}
                                                </select>
                                            </div>

                                            {/* Select de Operador */}
                                            <div className="w-full md:w-1/4">
                                                <select
                                                    value={cond.operador}
                                                    onChange={(e) => updateCondition(idx, 'operador', e.target.value)}
                                                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 text-center focus:ring-2 focus:ring-blue-400 outline-none shadow-sm transition-all"
                                                >
                                                    {OPERADORES.map(op => <option key={op.value} value={op.value} className="text-gray-900 bg-white font-medium">{op.label}</option>)}
                                                </select>
                                            </div>

                                            {/* Input de Valor */}
                                            <div className="flex-1 w-full md:w-auto">
                                                {!['vazio', 'nao_vazio', 'mudou'].includes(cond.operador) ? (
                                                    <input
                                                        value={cond.valor}
                                                        onChange={(e) => updateCondition(idx, 'valor', e.target.value)}
                                                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-400 outline-none shadow-sm transition-all placeholder-gray-400"
                                                        placeholder="Digite o valor esperado..."
                                                    />
                                                ) : (
                                                    <div className="w-full px-3 py-2 border border-dashed border-gray-300 text-xs font-medium text-gray-400 italic bg-gray-50 rounded-lg text-center">
                                                        (Automático pelo Operador)
                                                    </div>
                                                )}
                                            </div>

                                            {/* Botão de Excluir Linha */}
                                            <button type="button" onClick={() => removeCondition(idx)} className="text-red-400 hover:text-red-700 w-10 h-10 flex items-center justify-center hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shrink-0">
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    ))}

                                    {(!formData.regras_avancadas || formData.regras_avancadas.length === 0) && (
                                        <div className="text-center p-6 border-2 border-dashed border-blue-100 rounded-xl text-xs font-medium text-blue-400/80 italic bg-white/40">
                                            Nenhum filtro definido. O alerta disparará para <strong>todos</strong> os registros do evento.
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* --- FIM DA MELHORIA --- */}

                        </div>
                    </div>

                    <div className="flex justify-center -my-3 relative z-20">
                        <div className="bg-white border-2 border-gray-100 rounded-full w-10 h-10 flex items-center justify-center text-gray-400 shadow-sm z-20 ring-4 ring-white">
                            <FontAwesomeIcon icon={faArrowDown} />
                        </div>
                    </div>

                    {/* SESSÃO 2: AÇÃO */}
                    <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-3xl border border-orange-100 shadow-sm relative overflow-visible group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>

                        <div className="relative z-10">
                            <h4 className="text-[11px] font-extrabold text-orange-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                                <span className="w-5 h-5 rounded flex items-center justify-center bg-orange-200 text-orange-700 text-[10px]">3</span>
                                Ação (O que Enviar)
                            </h4>

                            <div className="mb-6">
                                <label className="block text-[10px] font-bold text-orange-600 mb-2 uppercase tracking-wide">Regras Especiais de Envio</label>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="w-full md:w-1/2 flex flex-col gap-2">
                                        <label className="flex items-center gap-3 cursor-pointer bg-white p-4 rounded-xl border border-orange-200 hover:bg-orange-50 transition-colors h-full shadow-sm group-hover:border-orange-300">
                                            <input type="checkbox" name="enviar_para_dono" checked={formData.enviar_para_dono} onChange={handleChange} className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500" />
                                            <div>
                                                <span className="text-xs font-bold text-gray-700 block transition-colors group-hover:text-orange-700">Responsável / Dono</span>
                                                <span className="text-[10px] text-gray-400">Notifica sempre quem criou o registro, independente do Cargo.</span>
                                            </div>
                                        </label>
                                    </div>
                                    <div className="w-full md:w-1/2 flex items-center bg-orange-50 p-4 rounded-xl border border-orange-100">
                                        <span className="text-xs text-orange-600 font-medium">Os Cargos (Funções) que receberão este alerta serão definidos pelos Donos de Franquia no próprio painel.</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 relative bg-white/50 p-4 rounded-2xl border border-orange-100">
                                {/* CAMPO TÍTULO */}
                                <input required name="titulo_template" value={formData.titulo_template} onChange={handleChange} className="w-full px-4 py-3 border border-orange-200 rounded-xl text-sm font-bold placeholder-orange-300 focus:ring-2 focus:ring-orange-400 outline-none shadow-sm transition-all" placeholder="Título (Digite { para injetar variáveis)" autoComplete="off" />

                                {/* CAMPO MENSAGEM */}
                                <textarea required name="mensagem_template" value={formData.mensagem_template} onChange={handleChange} rows="3" className="w-full px-4 py-3 border border-orange-200 rounded-xl text-sm placeholder-orange-300 focus:ring-2 focus:ring-orange-400 outline-none shadow-sm transition-all resize-none" placeholder="Descrição ou mensagem completa... (Digite { para variáveis)" autoComplete="off" />

                                {/* AUTOCOMPLETE DE VARIÁVEIS */}
                                {showSuggestions.visible && (
                                    <div className="absolute z-50 left-4 right-4 bg-white border border-gray-200 shadow-2xl rounded-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 mt-1 border-t-0 rounded-t-none">
                                        <div className="bg-gray-50 px-4 py-2 text-[10px] text-gray-500 font-bold border-b flex justify-between items-center sticky top-0 uppercase tracking-widest backdrop-blur-sm bg-gray-50/90 z-10">
                                            <span>
                                                {searchTerm ? `BUSCA: "${searchTerm}"` : 'VARIÁVEIS DISPONÍVEIS'}
                                            </span>
                                            <button onClick={() => { setShowSuggestions({ visible: false, field: null }); setSearchTerm('') }} className="text-gray-400 hover:text-red-500 px-2 py-1 bg-white rounded-lg border border-gray-200 hover:border-red-200 shadow-sm transition-all">Fechar (x)</button>
                                        </div>

                                        {variaveisFiltradas.length > 0 ? (
                                            variaveisFiltradas.map((col) => (
                                                <button
                                                    key={col.id}
                                                    type="button"
                                                    onClick={() => insertVariable(col.nome)}
                                                    className="w-full text-left px-4 py-3 text-xs hover:bg-blue-50 text-gray-700 hover:text-blue-700 border-b border-gray-50 last:border-0 flex justify-between group transition-colors items-center"
                                                >
                                                    <span className={`font-mono font-bold text-sm ${col.tipo === 'virtual' ? 'text-purple-600' : 'text-blue-600'}`}>
                                                        {col.tipo === 'virtual' && <FontAwesomeIcon icon={faLink} className="mr-2 text-[10px]" />}
                                                        {`{${col.nome}}`}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-500 bg-gray-50 group-hover:bg-blue-100 px-2 py-1 rounded-md">{col.desc || 'texto'}</span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-6 text-center text-sm text-gray-400 italic">
                                                Nenhuma variável encontrada com "<strong>{searchTerm}</strong>".
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                                    <p className="text-[11px] text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                                        <FontAwesomeIcon icon={faMagic} className="text-purple-500 mr-2" />
                                        Digite <strong>{'{'}</strong> dentro do texto para injetar variáveis automáticas.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => setShowLinkerModal(true)}
                                        className="text-[11px] font-bold text-purple-600 bg-purple-50 hover:text-purple-700 hover:bg-purple-100 px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-purple-100 shadow-sm disabled:opacity-50"
                                        disabled={!formData.tabela_alvo}
                                        title={!formData.tabela_alvo ? "Selecione uma tabela no Onde primeiro" : "Gerenciar vínculos com outras tabelas"}
                                    >
                                        <FontAwesomeIcon icon={faLink} /> Variáveis Avançadas
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 pt-5 border-t border-orange-200/50 flex flex-col md:flex-row justify-end items-center gap-4">
                                <div className="w-full md:w-1/2 flex relative">
                                    <span className="absolute left-3 top-2.5 text-xs text-orange-400 font-bold">URL:</span>
                                    <input name="link_template" value={formData.link_template || ''} onChange={handleChange} className="w-full pl-12 pr-4 py-2.5 border border-orange-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-400 outline-none shadow-sm placeholder-orange-200" placeholder="Ex: /projetos/123 (Ao clicar na notificação)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-8 flex justify-end gap-3 mt-4">
                <button type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 hover:text-gray-800 transition-colors">
                    Cancelar Edição
                </button>
                <button type="button" onClick={handleFinalSubmit} disabled={isSaving || !formData.nome_regra || !formData.tabela_alvo} className="px-8 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden group">
                    <span className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out"></span>
                    {isSaving ? <FontAwesomeIcon icon={faSpinner} spin className="text-lg relative" /> : <FontAwesomeIcon icon={faSave} className="text-lg relative" />}
                    <span className="relative">Salvar Automação</span>
                </button>
            </div>

            {/* MODAL LINKADOR (GERENCIADOR) */}
            <VariableManagerModal
                isOpen={showLinkerModal}
                onClose={() => setShowLinkerModal(false)}
                tabelaGatilho={formData.tabela_alvo}
                tabelas={tabelas}
                campos={campos}
            />
        </div>
    );
}