"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faReceipt, faCalendarAlt, faRetweet, faExchangeAlt, faArrowUp, faArrowDown, faTimes, faPlus, faPaperclip, faUpload, faFileLines, faEye, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
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
        empresa_id: null,
        numero_parcelas: 2, data_primeiro_vencimento: new Date().toISOString().split('T')[0],
        frequencia: 'Mensal', recorrencia_data_inicio: new Date().toISOString().split('T')[0], recorrencia_data_fim: null,
        novo_favorecido: null,
        anexo: { file: null, descricao: '', tipo_documento_id: null }
    });

    const [formData, setFormData] = useState(getInitialState());
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
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
                setFormData({ ...getInitialState(), ...initialData, anexo: { file: null, ...anexoData } });
            } else {
                setFormData(getInitialState());
            }
            setFavorecidoSearchTerm('');
            setFavorecidoSearchResults([]);
            setSearchAttempted(false);
        }
    }, [isOpen, isEditing, initialData, supabase]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('Salvando, por favor aguarde...');

        try {
            if (!user) { throw new Error("Usuário não autenticado. Por favor, faça login novamente."); }

            const dataToSave = {
                descricao: formData.descricao,
                valor: parseFloat(String(formData.valor || '0').replace(/[^0-9,.]/g, '').replace('.', '').replace(',', '.')) || 0,
                data_transacao: formData.data_transacao,
                data_vencimento: formData.data_vencimento,
                tipo: formData.tipo,
                status: formData.status,
                conta_id: formData.conta_id,
                categoria_id: formData.categoria_id,
                empreendimento_id: formData.empreendimento_id,
                etapa_id: formData.etapa_id,
                empresa_id: formData.empresa_id,
                observacoes: formData.observacoes,
            };

            if (formData.novo_favorecido && formData.novo_favorecido.nome) {
                const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ nome: formData.novo_favorecido.nome, tipo_contato: 'Fornecedor' }).select().single();
                if (contatoError) throw contatoError;
                dataToSave.favorecido_contato_id = novoContato.id;
            } else {
                dataToSave.favorecido_contato_id = formData.favorecido_contato_id;
            }

            if (formData.tipo === 'Transferência') {
                dataToSave.conta_destino_id = formData.conta_destino_id;
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
            
            // ***** INÍCIO DA CORREÇÃO DO NOME DO ARQUIVO *****
            if (formData.anexo && formData.anexo.file && lancamentoId) {
                const file = formData.anexo.file;
                
                // 1. "Limpa" o nome do arquivo, removendo espaços e caracteres especiais.
                const sanitizedFileName = file.name
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^\w.\-]/g, '_');

                // 2. Cria o caminho para o armazenamento com o nome "limpo".
                const filePath = `lancamento-${lancamentoId}/${Date.now()}-${sanitizedFileName}`;
                
                // 3. Envia o arquivo para o armazenamento.
                const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);
                if (uploadError) throw uploadError;
                
                // 4. Salva no banco de dados o caminho com o nome limpo, mas mantém o nome ORIGINAL para exibição.
                await supabase.from('lancamentos_anexos').insert({ 
                    lancamento_id: lancamentoId, 
                    caminho_arquivo: filePath, 
                    nome_arquivo: file.name, // Mantém o nome original aqui!
                    descricao: formData.anexo.descricao, 
                    tipo_documento_id: formData.anexo.tipo_documento_id 
                });
            }
            // ***** FIM DA CORREÇÃO DO NOME DO ARQUIVO *****

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
    
    // Demais funções (Handlers de UI) permanecem iguais...
    const handleChange = (e) => { const { name, value, type, checked } = e.target; const newValue = type === 'checkbox' ? checked : (value === '' ? null : value); let newFormData = { ...formData, [name]: newValue }; if (name === 'tipo' && newValue === 'Transferência') newFormData.form_type = 'simples'; if (name === 'form_type' && newValue !== 'simples') newFormData.tipo = formData.tipo === 'Transferência' ? 'Despesa' : formData.tipo; if (name === 'empreendimento_id') { if (newValue) { const emp = empreendimentos.find(e => e.id == newValue); newFormData.empresa_id = emp?.empresa_id || null; } else { newFormData.empresa_id = null; } newFormData.etapa_id = null; } setFormData(newFormData); };
    const handleFavorecidoSearch = async (e) => { const term = e.target.value; setFavorecidoSearchTerm(term); setSearchAttempted(false); if (term.length < 3) { setFavorecidoSearchResults([]); return; } setIsSearchingFavorecido(true); const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term }); setFavorecidoSearchResults(data || []); setIsSearchingFavorecido(false); setSearchAttempted(true); };
    const handleSelectFavorecido = (contato) => { setFormData(prev => ({ ...prev, favorecido_contato_id: contato.id, novo_favorecido: null })); setFavorecidoSearchTerm(contato.nome_exibicao); setFavorecidoSearchResults([]); };
    const handleClearFavorecido = () => { setFormData(prev => ({...prev, favorecido_contato_id: null, novo_favorecido: null})); setFavorecidoSearchTerm(''); setFavorecidoSearchResults([]); setSearchAttempted(false); };
    const handleAddNewFavorecido = () => { setFormData(prev => ({ ...prev, novo_favorecido: { nome: favorecidoSearchTerm, tipo_contato: 'Fornecedor' } })); setFavorecidoSearchResults([]); };
    const handleAnexoChange = (files) => { if (files && files.length > 0) { setFormData(prev => ({...prev, anexo: { ...prev.anexo, file: files[0] }})); } else { setFormData(prev => ({...prev, anexo: { ...prev.anexo, file: null }})); } };
    const handleDragEvents = (e) => { e.preventDefault(); e.stopPropagation(); if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true); else if (e.type === 'dragleave') setIsDragging(false); };
    const handleDrop = (e) => { handleDragEvents(e); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { handleAnexoChange(e.dataTransfer.files); e.dataTransfer.clearData(); } };
    const handleViewAnexo = async () => { if (!formData.anexo?.caminho_arquivo) return; const { data } = await supabase.storage.from('documentos-financeiro').createSignedUrl(formData.anexo.caminho_arquivo, 3600); if (data?.signedUrl) window.open(data.signedUrl, '_blank'); };
    const handleRemoveAnexo = async () => { if (!formData.anexo?.id || !formData.anexo?.caminho_arquivo) return; if (!window.confirm("Tem certeza?")) return; await supabase.storage.from('documentos-financeiro').remove([formData.anexo.caminho_arquivo]); await supabase.from('lancamentos_anexos').delete().eq('id', formData.anexo.id); setFormData(prev => ({...prev, anexo: { file: null, descricao: '', tipo_documento_id: null }})); };

    if (!isOpen) return null;
    const filteredCategorias = categorias.filter(c => c.tipo === formData.tipo);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 text-center">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                {message && <p className={`text-center p-3 rounded-md text-sm font-semibold mb-4 ${message.includes('ERRO') ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{message}</p>}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* O restante do JSX do formulário não precisa de alterações */}
                     {!isEditing && (
                        <div className="flex flex-col md:flex-row gap-6 p-2 bg-gray-100 rounded-lg">
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-semibold text-center text-gray-600 block">Natureza</label>
                                <div className="flex gap-2">
                                    <TipoToggleButton label="Despesa" icon={faArrowDown} isActive={formData.tipo === 'Despesa'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Despesa' }})} colorClass="bg-red-500 hover:bg-red-600" />
                                    <TipoToggleButton label="Receita" icon={faArrowUp} isActive={formData.tipo === 'Receita'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Receita' }})} colorClass="bg-green-500 hover:bg-green-600" />
                                    <TipoToggleButton label="Transferência" icon={faExchangeAlt} isActive={formData.tipo === 'Transferência'} onClick={() => handleChange({ target: { name: 'tipo', value: 'Transferência' }})} colorClass="bg-yellow-500 hover:bg-yellow-600 text-gray-800" />
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-semibold text-center text-gray-600 block">Estrutura</label>
                                <div className="flex gap-2">
                                    <TipoToggleButton label="Simples" icon={faReceipt} isActive={formData.form_type === 'simples'} onClick={() => handleChange({ target: { name: 'form_type', value: 'simples' }})} />
                                    <TipoToggleButton label="Parcelado" icon={faCalendarAlt} isActive={formData.form_type === 'parcelado'} onClick={() => handleChange({ target: { name: 'form_type', value: 'parcelado' }})} />
                                    <TipoToggleButton label="Recorrente" icon={faRetweet} isActive={formData.form_type === 'recorrente'} onClick={() => handleChange({ target: { name: 'form_type', value: 'recorrente' }})} />
                                </div>
                            </div>
                        </div>
                    )}
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
                                <div><label className="block text-sm font-medium">Valor *</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} name="valor" value={String(formData.valor || '')} onAccept={(v) => setFormData(p => ({...p, valor: v}))} required className="w-full p-2 border rounded-md" /></div>
                                <div><label className="block text-sm font-medium">Data de Vencimento *</label><input type="date" name="data_vencimento" value={formData.data_vencimento || formData.data_transacao} onChange={handleChange} required className="w-full p-2 border rounded-md"/></div>
                             </div>
                        )}
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
                            <label className="block text-sm font-medium mb-2">Anexo</label>
                            {isEditing && formData.anexo?.nome_arquivo && (
                                <div className="flex items-center justify-between p-2 mb-2 bg-gray-100 border rounded-md">
                                    <div className="flex items-center gap-2 text-sm"><FontAwesomeIcon icon={faFileLines} className="text-gray-600"/><a onClick={handleViewAnexo} className="font-semibold text-blue-600 hover:underline cursor-pointer">{formData.anexo.nome_arquivo}</a><span className="text-gray-500">({formData.anexo.descricao})</span></div>
                                    <button type="button" onClick={handleRemoveAnexo} className="text-red-500 hover:text-red-700" title="Remover anexo"><FontAwesomeIcon icon={faTrashAlt}/></button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-xs font-medium text-gray-700">Tipo do Documento</label><select value={formData.anexo.tipo_documento_id || ''} onChange={(e) => setFormData(p => ({...p, anexo: {...p.anexo, tipo_documento_id: e.target.value}}))} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione um tipo...</option>{tiposDocumento.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.descricao} ({tipo.sigla})</option>)}</select></div>
                                 <div><label className="block text-xs font-medium text-gray-700">Descrição do Anexo</label><input type="text" value={formData.anexo.descricao} onChange={(e) => setFormData(p => ({...p, anexo: {...p.anexo, descricao: e.target.value}}))} placeholder="Ex: Conta de Luz - Jul/25" className="mt-1 w-full p-2 border rounded-md" /></div>
                            </div>
                            <div onDragEnter={handleDragEvents} onDragLeave={handleDragEvents} onDragOver={handleDragEvents} onDrop={handleDrop} className={`relative mt-4 w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                                <input type="file" id="anexo-upload" className="absolute w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleAnexoChange(e.target.files)}/>
                                {formData.anexo.file ? ( <div className="flex items-center gap-2 p-2 text-sm text-green-800"><FontAwesomeIcon icon={faFileLines} /><span className="font-semibold">{formData.anexo.file.name}</span><button type="button" onClick={() => handleAnexoChange(null)} className="ml-2 text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTimes} /></button></div> ) : ( <> <FontAwesomeIcon icon={faUpload} className="text-gray-400 text-2xl mb-1" /><p className="text-sm text-gray-500">Arraste e solte ou <span className="font-semibold text-blue-600">clique aqui</span></p> </> )}
                            </div>
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