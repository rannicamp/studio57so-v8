"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faReceipt, faCalendarAlt, faRetweet, faExchangeAlt, faArrowUp, faArrowDown, faTimes, faPlus, faPaperclip, faUpload, faFileLines, faEye, faTrashAlt, faRobot } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

// Componentes internos (sem alterações)
const TipoToggleButton = ({ label, icon, isActive, onClick, colorClass = 'bg-blue-500 hover:bg-blue-600' }) => {
    const baseClasses = "flex-1 p-2 rounded-md font-semibold text-xs flex items-center justify-center gap-2 transition-colors";
    const activeClasses = `shadow text-white ${colorClass}`;
    const inactiveClasses = "bg-gray-200 text-gray-600 hover:bg-gray-300";
    return (
        <button type="button" onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
            <FontAwesomeIcon icon={icon} />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
};
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

export default function LancamentoFormModal({ isOpen, onClose, onSuccess, initialData, empresas = [] }) {
    const supabase = createClient();
    const { user } = useAuth();
    const isEditing = Boolean(initialData?.id);
    
    const getInitialState = () => ({
        descricao: '', valor: '', data_transacao: new Date().toISOString().split('T')[0],
        tipo: 'Despesa', form_type: 'simples', status: 'Pendente', conta_id: null, categoria_id: null,
        empreendimento_id: null, etapa_id: null, conta_destino_id: null, favorecido_contato_id: null,
        empresa_id: null, observacoes: '',
        numero_parcelas: 2, data_primeiro_vencimento: new Date().toISOString().split('T')[0],
        frequencia: 'Mensal', recorrencia_data_inicio: new Date().toISOString().split('T')[0], recorrencia_data_fim: null,
        novo_favorecido: null,
        anexo: { file: null, descricao: '', tipo_documento_id: null }
    });

    const [formData, setFormData] = useState(getInitialState());
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiFile, setAiFile] = useState(null);

    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [etapas, setEtapas] = useState([]);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    
    const [favorecidoSearchTerm, setFavorecidoSearchTerm] = useState('');
    const [favorecidoSearchResults, setFavorecidoSearchResults] = useState([]);
    const [isSearchingFavorecido, setIsSearchingFavorecido] = useState(false);
    const [searchAttempted, setSearchAttempted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    useEffect(() => {
        const fetchDropdownData = async () => {
            setLoading(true);
            const { data: contasData } = await supabase.from('contas_financeiras').select('id, nome').order('nome');
            setContas(contasData || []);
            const { data: categoriasData } = await supabase.from('categorias_financeiras').select('id, nome, tipo').order('nome');
            setCategorias(categoriasData || []);
            const { data: empreendimentosData } = await supabase.from('empreendimentos').select('id, nome, empresa_id:empresa_proprietaria_id').order('nome');
            setEmpreendimentos(empreendimentosData || []);
            const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa').order('nome_etapa');
            setEtapas(etapasData || []);
            const { data: tiposDocData } = await supabase.from('documento_tipos').select('*').order('sigla');
            setTiposDocumento(tiposDocData || []);
            setLoading(false);
        };

        if (isOpen) {
            fetchDropdownData();
            setMessage('');
            if (isEditing) {
                const anexoData = initialData.anexos && initialData.anexos[0] ? initialData.anexos[0] : null;
                
                // --- INÍCIO DA CORREÇÃO ---
                const dataToLoad = { 
                    ...initialData, 
                    observacoes: initialData.observacao || '',
                    valor: initialData.valor ? String(initialData.valor).replace('.', ',') : '',
                    data_transacao: initialData.data_transacao ? new Date(initialData.data_transacao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    data_vencimento: initialData.data_vencimento ? new Date(initialData.data_vencimento).toISOString().split('T')[0] : null,
                };
                
                setFormData({ ...getInitialState(), ...dataToLoad, anexo: { file: null, ...anexoData } });
                
                if(initialData.favorecido) {
                    setFavorecidoSearchTerm(initialData.favorecido.nome || initialData.favorecido.razao_social);
                }
                // --- FIM DA CORREÇÃO ---

            } else {
                setFormData(getInitialState());
            }

            if(!isEditing || !initialData.favorecido) {
                 setFavorecidoSearchTerm('');
            }
            setFavorecidoSearchResults([]);
            setSearchAttempted(false);
            setAiFile(null);
        }
    }, [isOpen, isEditing, initialData, supabase]);

    const handleAiFileChange = (e) => { /* ...código sem alteração... */ };
    const handleAiExtract = async () => { /* ...código sem alteração... */ };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('Salvando, por favor aguarde...');

        try {
            if (!user) { throw new Error("Usuário não autenticado. Por favor, faça login novamente."); }

            const statusFinal = formData.tipo === 'Transferência' ? 'Pago' : formData.status;

            // --- INÍCIO DA CORREÇÃO ---
            // Lógica de parse do valor melhorada para ser mais robusta
            const valorNumerico = parseFloat(String(formData.valor || '0').replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

            const dataToSave = {
                descricao: formData.descricao,
                valor: valorNumerico,
                data_transacao: formData.data_transacao,
                data_vencimento: formData.data_vencimento, // Já está no formato correto
                tipo: formData.tipo,
                status: statusFinal,
                conta_id: formData.conta_id,
                categoria_id: formData.categoria_id,
                empreendimento_id: formData.empreendimento_id,
                etapa_id: formData.etapa_id,
                empresa_id: formData.empresa_id,
                observacao: formData.observacoes,
            };
            // --- FIM DA CORREÇÃO ---

            if (formData.novo_favorecido && formData.novo_favorecido.nome) {
                const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ nome: formData.novo_favorecido.nome, tipo_contato: 'Fornecedor' }).select().single();
                if (contatoError) throw contatoError;
                dataToSave.favorecido_contato_id = novoContato.id;
            } else {
                dataToSave.favorecido_contato_id = formData.favorecido_contato_id;
            }

            if (formData.tipo === 'Transferência') {
                dataToSave.conta_destino_id = formData.conta_destino_id;
            } else {
                dataToSave.conta_destino_id = null; // Garante que o campo seja nulo se não for transferência
            }

            let lancamentoId = null;
            if (isEditing) {
                lancamentoId = formData.id;
                dataToSave.criado_por_usuario_id = formData.criado_por_usuario_id;
                const { error } = await supabase.from('lancamentos').update(dataToSave).eq('id', lancamentoId);
                if (error) throw error;
            } else {
                dataToSave.criado_por_usuario_id = user.id;
                const { data: newLancamento, error } = await supabase.from('lancamentos').insert(dataToSave).select().single();
                if (error) throw error;
                lancamentoId = newLancamento.id;
            }
            
            if (formData.anexo && formData.anexo.file && lancamentoId) {
                const file = formData.anexo.file;
                const sanitizedFileName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\-]/g, '_');
                const filePath = `lancamento-${lancamentoId}/${Date.now()}-${sanitizedFileName}`;
                const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);
                if (uploadError) throw uploadError;
                await supabase.from('lancamentos_anexos').insert({ 
                    lancamento_id: lancamentoId, 
                    caminho_arquivo: filePath, 
                    nome_arquivo: file.name,
                    descricao: formData.anexo.descricao, 
                    tipo_documento_id: formData.anexo.tipo_documento_id 
                });
            }

            setMessage(`Lançamento ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
            if (onSuccess) onSuccess();
            setTimeout(onClose, 1500);

        } catch (error) {
            const detailedError = `ERRO: ${error.message}. Detalhes: ${error.details || 'N/A'}. Código: ${error.code || 'N/A'}`;
            setMessage(detailedError);
            console.error("FALHA AO SALVAR:", error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleChange = (e) => { const { name, value, type, checked } = e.target; const newValue = type === 'checkbox' ? checked : (value === '' ? null : value); let newFormData = { ...formData, [name]: newValue }; if (name === 'tipo' && newValue === 'Transferência') newFormData.form_type = 'simples'; if (name === 'form_type' && newValue !== 'simples') newFormData.tipo = formData.tipo === 'Transferência' ? 'Despesa' : formData.tipo; if (name === 'empreendimento_id') { if (newValue) { const emp = empreendimentos.find(e => e.id == newValue); newFormData.empresa_id = emp?.empresa_id || null; } else { newFormData.empresa_id = null; } newFormData.etapa_id = ''; } setFormData(newFormData); };
    const handleFavorecidoSearch = async (e) => { /* ...código sem alteração... */ };
    const handleSelectFavorecido = (contato) => { /* ...código sem alteração... */ };
    const handleClearFavorecido = () => { /* ...código sem alteração... */ };
    const handleAddNewFavorecido = () => { /* ...código sem alteração... */ };
    const handleAnexoChange = (files) => { /* ...código sem alteração... */ };
    const handleDragEvents = (e) => { /* ...código sem alteração... */ };
    const handleDrop = (e) => { /* ...código sem alteração... */ };
    const handleViewAnexo = async () => { /* ...código sem alteração... */ };
    const handleRemoveAnexo = async () => { /* ...código sem alteração... */ };

    if (!isOpen) return null;
    const filteredCategorias = categorias.filter(c => c.tipo === formData.tipo);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 text-center">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                {message && <p className={`text-center p-3 rounded-md text-sm font-semibold mb-4 ${message.includes('ERRO') ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{message}</p>}
                
                <div className="p-4 border-2 border-dashed border-purple-300 bg-purple-50 rounded-lg mb-6">
                    {/* ...código da IA sem alteração... */}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 p-2 bg-gray-100 rounded-lg">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-semibold text-center text-gray-600 block">Natureza</label>
                            <div className="flex gap-2">
                                <TipoToggleButton label="Despesa" icon={faArrowDown} isActive={formData.tipo === 'Despesa'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Despesa' }})} colorClass="bg-red-500 hover:bg-red-600" />
                                <TipoToggleButton label="Receita" icon={faArrowUp} isActive={formData.tipo === 'Receita'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Receita' }})} colorClass="bg-green-500 hover:bg-green-600" />
                                <TipoToggleButton label="Transferência" icon={faExchangeAlt} isActive={formData.tipo === 'Transferência'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Transferência' }})} colorClass="bg-yellow-500 hover:bg-yellow-600 text-gray-800" />
                            </div>
                        </div>
                        {!isEditing && (
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-semibold text-center text-gray-600 block">Estrutura</label>
                                <div className="flex gap-2">
                                    <TipoToggleButton label="Simples" icon={faReceipt} isActive={formData.form_type === 'simples'} onClick={() => handleChange({ target: { name: 'form_type', value: 'simples' }})} />
                                    <TipoToggleButton label="Parcelado" icon={faCalendarAlt} isActive={formData.form_type === 'parcelado'} onClick={() => handleChange({ target: { name: 'form_type', value: 'parcelado' }})} />
                                    <TipoToggleButton label="Recorrente" icon={faRetweet} isActive={formData.form_type === 'recorrente'} onClick={() => handleChange({ target: { name: 'form_type', value: 'recorrente' }})} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-4 pt-4 border-t">
                        <input type="text" name="descricao" value={formData.descricao || ''} onChange={handleChange} required placeholder="Descrição do Lançamento *" className="w-full p-2 border rounded-md" />
                        {formData.form_type === 'parcelado' && !isEditing && (
                            <fieldset className="p-3 border rounded-lg bg-gray-50"><legend className="font-semibold px-2 text-sm text-gray-600">Detalhes do Parcelamento</legend>
                                <div className="grid grid-cols-3 gap-4 pt-2">
                                    <div><label className="block text-xs font-medium">Valor Total*</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} name="valor" value={String(formData.valor || '')} onAccept={(v) => setFormData(p => ({...p, valor: v}))} required className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="block text-xs font-medium">Nº de Parcelas*</label><input type="number" name="numero_parcelas" value={formData.numero_parcelas} onChange={handleChange} min="2" required className="mt-1 w-full p-2 border rounded-md"/></div>
                                    <div><label className="block text-xs font-medium">1º Vencimento*</label><input type="date" name="data_primeiro_vencimento" value={formData.data_primeiro_vencimento} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/></div>
                                </div>
                            </fieldset>
                        )}
                        {formData.form_type === 'simples' && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Valor *</label>
                                    <IMaskInput 
                                        mask="R$ num" 
                                        blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} 
                                        name="valor" 
                                        value={String(formData.valor || '')} 
                                        onAccept={(v) => setFormData(p => ({...p, valor: v}))} 
                                        required 
                                        className="w-full p-2 border rounded-md" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Data de Vencimento *</label>
                                    {/* ***** INÍCIO DA CORREÇÃO ***** */}
                                    <input 
                                        type="date" 
                                        name="data_vencimento" 
                                        value={formData.data_vencimento || ''} 
                                        onChange={handleChange} 
                                        required 
                                        className="w-full p-2 border rounded-md"
                                    />
                                    {/* ***** FIM DA CORREÇÃO ***** */}
                                </div>
                             </div>
                        )}
                        {/* O restante do formulário continua igual */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {formData.tipo === 'Transferência' ? (
                                <>
                                    <div><label className="block text-sm font-medium">De (Origem)*</label><select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                    <div><label className="block text-sm font-medium">Para (Destino)*</label><select name="conta_destino_id" value={formData.conta_destino_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{contas.filter(c => c.id !== formData.conta_id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                </>
                            ) : (
                                <>
                                    <div><label className="block text-sm font-medium">Conta*</label><select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                    <div><label className="block text-sm font-medium">Categoria</label><select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{filteredCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                    <div className="md:col-span-2 relative">
                                        <label className="block text-sm font-medium">Favorecido (Opcional)</label>
                                        {formData.favorecido_contato_id || formData.novo_favorecido ? (
                                            <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                                                <span className="font-semibold text-gray-800">{formData.novo_favorecido ? `Novo: ${formData.novo_favorecido.nome}` : favorecidoSearchTerm}</span>
                                                <button type="button" onClick={handleClearFavorecido} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Alterar</button>
                                            </div>
                                        ) : (
                                            <>
                                                <input type="text" value={favorecidoSearchTerm} onChange={handleFavorecidoSearch} placeholder="Busque ou digite um novo nome..." className="mt-1 w-full p-2 border rounded-md"/>
                                                {isSearchingFavorecido && <p className="text-xs text-gray-500 pl-1">Buscando...</p>}
                                                <div className="absolute z-20 w-full bg-white border rounded-md mt-1 shadow-lg">
                                                    {favorecidoSearchResults.length > 0 && (
                                                        <ul className="max-h-48 overflow-y-auto">
                                                            {favorecidoSearchResults.map(c => <li key={c.id} onClick={() => handleSelectFavorecido(c)} className="p-3 hover:bg-gray-100 cursor-pointer text-sm">
                                                                <div className="font-semibold"><HighlightedText text={c.nome_exibicao} highlight={favorecidoSearchTerm} /></div>
                                                                <div className="text-xs text-gray-500">{c.detalhe}</div>
                                                            </li>)}
                                                        </ul>
                                                    )}
                                                    {searchAttempted && favorecidoSearchResults.length === 0 && !isSearchingFavorecido && favorecidoSearchTerm.length > 2 && (
                                                        <div className="p-2">
                                                            <button type="button" onClick={handleAddNewFavorecido} className="w-full text-left text-blue-600 font-semibold flex items-center gap-2 p-2 hover:bg-blue-50 rounded-md"><FontAwesomeIcon icon={faPlus} /> Adicionar novo contato: &quot;{favorecidoSearchTerm}&quot;</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div><label className="block text-sm font-medium">Empresa</label><select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!!formData.empreendimento_id}><option value="">Nenhuma</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}</select></div>
                                    <div><label className="block text-sm font-medium">Empreendimento</label><select name="empreendimento_id" value={formData.empreendimento_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhum</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
                                    <div><label className="block text-sm font-medium">Etapa da Obra</label><select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empreendimento_id}><option value="">Nenhuma</option>{etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}</select></div>
                                </>
                            )}
                        </div>
                        <div className="pt-4 border-t">
                            {/* ...código do anexo sem alteração... */}
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