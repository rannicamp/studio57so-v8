"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faReceipt, faCalendarAlt, faRetweet, faExchangeAlt, faArrowUp, faArrowDown, faTimes } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

// Botão para alternar entre os tipos de lançamento
const TipoToggleButton = ({ label, icon, isActive, onClick, colorClass = 'bg-blue-500 hover:bg-blue-600' }) => {
    const baseClasses = "w-full p-2 rounded-md font-semibold text-sm flex items-center justify-center gap-2 transition-colors";
    const activeClasses = `shadow text-white ${colorClass}`;
    const inactiveClasses = "bg-transparent text-gray-500 hover:bg-gray-200";
    return (
        <button type="button" onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
            <FontAwesomeIcon icon={icon} />
            {label}
        </button>
    );
};

// Componente para destacar o texto da busca
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>
            )}
        </span>
    );
};

export default function LancamentoFormModal({ isOpen, onClose, onSave, initialData }) {
    const supabase = createClient();
    const isEditing = Boolean(initialData?.id);
    
    const getInitialState = () => ({
        descricao: '', valor: '', data_transacao: new Date().toISOString().split('T')[0],
        tipo: 'Despesa', form_type: 'simples', status: 'Pendente', conta_id: null, categoria_id: null,
        empreendimento_id: null, etapa_id: null, conta_destino_id: null, favorecido_contato_id: null,
        numero_parcelas: 2, data_primeiro_vencimento: new Date().toISOString().split('T')[0],
        frequencia: 'Mensal', recorrencia_data_inicio: new Date().toISOString().split('T')[0], recorrencia_data_fim: null,
    });

    const [formData, setFormData] = useState(getInitialState());
    const [loading, setLoading] = useState(false);
    
    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [etapas, setEtapas] = useState([]);
    
    const [favorecidoSearchTerm, setFavorecidoSearchTerm] = useState('');
    const [favorecidoSearchResults, setFavorecidoSearchResults] = useState([]);
    const [isSearchingFavorecido, setIsSearchingFavorecido] = useState(false);

    useEffect(() => {
        const fetchDropdownData = async () => {
            setLoading(true);
            const { data: contasData } = await supabase.from('contas_financeiras').select('id, nome').order('nome');
            setContas(contasData || []);
            const { data: categoriasData } = await supabase.from('categorias_financeiras').select('id, nome, tipo').order('nome');
            setCategorias(categoriasData || []);
            const { data: empreendimentosData } = await supabase.from('empreendimentos').select('id, nome').order('nome');
            setEmpreendimentos(empreendimentosData || []);
            const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa').order('nome_etapa');
            setEtapas(etapasData || []);
            setLoading(false);
        };

        if (isOpen) {
            fetchDropdownData();
            if (isEditing) {
                setFormData(initialData);
                setFormData(prev => ({ ...prev, form_type: 'simples' }));
            } else {
                setFormData(getInitialState());
                setFavorecidoSearchTerm('');
                setFavorecidoSearchResults([]);
            }
        }
    }, [isOpen, isEditing, initialData, supabase]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : (value === '' ? null : value);
        let newFormData = { ...formData, [name]: newValue };
        if (name === 'tipo' && newValue === 'Transferência') newFormData.form_type = 'simples';
        if (name === 'form_type' && newValue !== 'simples') newFormData.tipo = formData.tipo === 'Transferência' ? 'Despesa' : formData.tipo;
        if (name === 'empreendimento_id' && !value) newFormData.etapa_id = null;
        setFormData(newFormData);
    };

    const handleFavorecidoSearch = async (e) => {
        const term = e.target.value;
        setFavorecidoSearchTerm(term);
        if (term.length < 3) {
            setFavorecidoSearchResults([]);
            return;
        }
        setIsSearchingFavorecido(true);
        const { data, error } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term });
        if (error) console.error(error);
        else setFavorecidoSearchResults(data || []);
        setIsSearchingFavorecido(false);
    };

    const handleSelectFavorecido = (contato) => {
        setFormData(prev => ({ ...prev, favorecido_contato_id: contato.id }));
        setFavorecidoSearchTerm(contato.nome_exibicao);
        setFavorecidoSearchResults([]);
    };
    
    const handleClearFavorecido = () => {
        setFormData(prev => ({...prev, favorecido_contato_id: null}));
        setFavorecidoSearchTerm('');
        setFavorecidoSearchResults([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const valorNumerico = parseFloat(String(formData.valor).replace(/[^0-9,.]/g, '').replace('.', '').replace(',', '.')) || 0;
        const success = await onSave({ ...formData, valor: valorNumerico });
        setLoading(false);
        if (success) onClose();
    };

    if (!isOpen) return null;

    const filteredCategorias = categorias.filter(c => c.tipo === formData.tipo);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-6 text-center">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {!isEditing && (
                        <div className="grid grid-cols-2 gap-6 p-2 bg-gray-100 rounded-lg">
                            <div className="flex flex-col gap-2"><label className="text-sm font-semibold text-center text-gray-600">Natureza</label>
                                <TipoToggleButton label="Despesa" icon={faArrowDown} isActive={formData.tipo === 'Despesa'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Despesa' }})} colorClass="bg-red-500 hover:bg-red-600" />
                                <TipoToggleButton label="Receita" icon={faArrowUp} isActive={formData.tipo === 'Receita'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Receita' }})} colorClass="bg-green-500 hover:bg-green-600" />
                                <TipoToggleButton label="Transferência" icon={faExchangeAlt} isActive={formData.tipo === 'Transferência'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Transferência' }})} colorClass="bg-yellow-500 hover:bg-yellow-600 text-gray-800" />
                            </div>
                            <div className="flex flex-col gap-2"><label className="text-sm font-semibold text-center text-gray-600">Estrutura</label>
                                <TipoToggleButton label="Simples" icon={faReceipt} isActive={formData.form_type === 'simples'} onClick={() => handleChange({ target: { name: 'form_type', value: 'simples' }})} />
                                <TipoToggleButton label="Parcelado" icon={faCalendarAlt} isActive={formData.form_type === 'parcelado'} onClick={() => handleChange({ target: { name: 'form_type', value: 'parcelado' }})} />
                                <TipoToggleButton label="Recorrente" icon={faRetweet} isActive={formData.form_type === 'recorrente'} onClick={() => handleChange({ target: { name: 'form_type', value: 'recorrente' }})} />
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-4 pt-4 border-t">
                        <input type="text" name="descricao" value={formData.descricao || ''} onChange={handleChange} required placeholder="Descrição do Lançamento *" className="w-full p-2 border rounded-md" />

                        {/* --- CAMPOS PRINCIPAIS --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} name="valor" placeholder={`Valor ${formData.form_type === 'parcelado' ? 'Total' : ''} *`} value={String(formData.valor || '')} onAccept={(v) => setFormData(p => ({...p, valor: v}))} required className="w-full p-2 border rounded-md" />
                            <input type="date" name="data_transacao" value={formData.data_transacao} onChange={handleChange} required className="w-full p-2 border rounded-md"/>
                        </div>

                        {/* --- SEÇÃO DE PARCELAMENTO --- */}
                        {formData.form_type === 'parcelado' && !isEditing && (
                             <fieldset className="p-3 border rounded-lg bg-gray-50"><legend className="font-semibold px-2 text-sm text-gray-600">Detalhes do Parcelamento</legend>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <input type="number" name="numero_parcelas" value={formData.numero_parcelas} onChange={handleChange} min="2" required placeholder="Nº de Parcelas" className="w-full p-2 border rounded-md"/>
                                    <input type="date" name="data_primeiro_vencimento" value={formData.data_primeiro_vencimento} onChange={handleChange} required className="w-full p-2 border rounded-md"/>
                                </div>
                            </fieldset>
                        )}
                        
                        {/* --- BLOCO DE ASSOCIAÇÃO - INCLUINDO FAVORECIDO --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {formData.tipo === 'Transferência' ? (
                                <>
                                    <div><label className="block text-sm font-medium">De (Origem)</label><select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                    <div><label className="block text-sm font-medium">Para (Destino)</label><select name="conta_destino_id" value={formData.conta_destino_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{contas.filter(c => c.id !== formData.conta_id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                </>
                            ) : (
                                <>
                                    <div><label className="block text-sm font-medium">Conta*</label><select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                    <div><label className="block text-sm font-medium">Categoria</label><select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{filteredCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                    <div className="md:col-span-2 relative">
                                        <label className="block text-sm font-medium">Favorecido (Opcional)</label>
                                        <input type="text" value={favorecidoSearchTerm} onChange={handleFavorecidoSearch} placeholder="Busque um contato..." className="mt-1 w-full p-2 border rounded-md pr-8"/>
                                        {formData.favorecido_contato_id && <button type="button" onClick={handleClearFavorecido} className="absolute right-2 top-8 text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTimes} /></button>}
                                        {favorecidoSearchResults.length > 0 && (
                                            <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                                {favorecidoSearchResults.map(c => <li key={c.id} onClick={() => handleSelectFavorecido(c)} className="p-3 hover:bg-gray-100 cursor-pointer text-sm">
                                                    <div className="font-semibold"><HighlightedText text={c.nome_exibicao} highlight={favorecidoSearchTerm} /></div>
                                                    <div className="text-xs text-gray-500">{c.detalhe}</div>
                                                </li>)}
                                            </ul>
                                        )}
                                    </div>
                                    <div><label className="block text-sm font-medium">Empreendimento</label><select name="empreendimento_id" value={formData.empreendimento_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhum</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
                                    <div><label className="block text-sm font-medium">Etapa da Obra</label><select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empreendimento_id}><option value="">Nenhuma</option>{etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}</select></div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : (isEditing ? 'Salvar Alterações' : 'Criar Lançamento')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}