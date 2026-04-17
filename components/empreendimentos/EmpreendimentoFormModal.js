// components/empreendimentos/EmpreendimentoFormModal.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faImage, faSave, faFileAlt, faBuilding, faHouse } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import FileUploadWithAI from '@/components/shared/FileUploadWithAI';
import ThumbnailUploader from '@/components/shared/ThumbnailUploader';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export default function EmpreendimentoFormModal({ isOpen, onClose, empreendimentoToEdit, onSaveSuccess }) {
    // --- ESTADOS ---
    const [formData, setFormData] = useState({});
    const [isApiLoading, setIsApiLoading] = useState(false);
    
    // Estados de busca (typeahead)
    const [searchTerms, setSearchTerms] = useState({ incorporadora: '', construtora: '' });
    const [searchResults, setSearchResults] = useState({ incorporadora: [], construtora: [] });

    // --- HOOKS ---
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { userData } = useAuth();

    const isEditing = Boolean(empreendimentoToEdit);

    // --- BUSCA EXTERNA DE OPÇÕES NO RENDER DO MODAL ---
    const { data: corporateEntities = [] } = useQuery({
        queryKey: ['corporateEntities', userData?.organizacao_id],
        queryFn: async () => {
            const { data } = await supabase.rpc('get_corporate_entities', { p_organizacao_id: userData.organizacao_id });
            return data || [];
        },
        enabled: !!userData?.organizacao_id && isOpen
    });

    const { data: proprietariaOptions = [] } = useQuery({
        queryKey: ['proprietariaOptions', userData?.organizacao_id],
        queryFn: async () => {
            const { data } = await supabase.from('cadastro_empresa').select('id, razao_social, nome_fantasia').eq('organizacao_id', userData.organizacao_id);
            return data || [];
        },
        enabled: !!userData?.organizacao_id && isOpen
    });

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        if (!isOpen) return;
        
        const initialState = {
            nome: empreendimentoToEdit?.nome || '',
            nome_empreendimento: empreendimentoToEdit?.nome_empreendimento || '',
            status: empreendimentoToEdit?.status || 'Em Planejamento',
            categoria: empreendimentoToEdit?.categoria || 'Vertical',
            cep: empreendimentoToEdit?.cep || '',
            address_street: empreendimentoToEdit?.address_street || '',
            address_number: empreendimentoToEdit?.address_number || '',
            address_complement: empreendimentoToEdit?.address_complement || '',
            neighborhood: empreendimentoToEdit?.neighborhood || '',
            city: empreendimentoToEdit?.city || '',
            state: empreendimentoToEdit?.state || '',
            terreno_area_total: empreendimentoToEdit?.terreno_area_total || '',
            data_inicio: empreendimentoToEdit?.data_inicio || '',
            data_fim_prevista: empreendimentoToEdit?.data_fim_prevista || '',
            prazo_entrega: empreendimentoToEdit?.prazo_entrega || '',
            incorporadora_id: empreendimentoToEdit?.incorporadora_id || null,
            construtora_id: empreendimentoToEdit?.construtora_id || null,
            empresa_proprietaria_id: empreendimentoToEdit?.empresa_proprietaria_id || null,
            matricula_numero: empreendimentoToEdit?.matricula_numero || '',
            matricula_cartorio: empreendimentoToEdit?.matricula_cartorio || '',
            estrutura_tipo: empreendimentoToEdit?.estrutura_tipo || '',
            alvenaria_tipo: empreendimentoToEdit?.alvenaria_tipo || '',
            cobertura_detalhes: empreendimentoToEdit?.cobertura_detalhes || '',
            dados_contrato: empreendimentoToEdit?.dados_contrato || '',
            indice_reajuste: empreendimentoToEdit?.indice_reajuste || '',
            thumbnail_url: empreendimentoToEdit?.thumbnail_url || null,
            logo_url: empreendimentoToEdit?.logo_url || null,
            observacoes: empreendimentoToEdit?.observacoes || '*Correção mensal pelo INCC até a entrega das chaves, após entrega IGP-M + 1% a.m.\n**Sujeito a alteração sem aviso prévio.',
        };
        setFormData(initialState);

        if (empreendimentoToEdit && corporateEntities.length > 0) {
            const incorporadora = corporateEntities.find(e => e.id === empreendimentoToEdit.incorporadora_id);
            const construtora = corporateEntities.find(e => e.id === empreendimentoToEdit.construtora_id);
            setSearchTerms({
                incorporadora: incorporadora ? (incorporadora.nome || incorporadora.razao_social) : '',
                construtora: construtora ? (construtora.nome || construtora.razao_social) : ''
            });
        }
    }, [empreendimentoToEdit, isOpen, corporateEntities]);

    // --- MUTATION DE SALVAMENTO ---
    const { mutateAsync: saveEmpreendimento, isPending: isSaving } = useMutation({
        mutationFn: async (data) => {
            const dataToSubmit = {
                ...data,
                organizacao_id: userData.organizacao_id
            };

            if (isEditing) {
                const { error, data: resData } = await supabase.from('empreendimentos').update(dataToSubmit).eq('id', empreendimentoToEdit.id).select().single();
                if (error) throw error;
                return resData;
            } else {
                const { data: newData, error } = await supabase.from('empreendimentos').insert(dataToSubmit).select().single();
                if (error) throw error;
                return newData;
            }
        },
        onSuccess: (savedData) => {
            queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
            queryClient.invalidateQueries({ queryKey: ['empreendimentoData'] });
            toast.success(isEditing ? 'Empreendimento editado com sucesso!' : 'Novo empreendimento criado!');
            if (onSaveSuccess) onSaveSuccess(savedData.id);
            onClose();
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    });

    // --- HANDLERS ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleMaskedChange = (name, value) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleImageUpdate = (field, url) => {
        setFormData(prev => ({ ...prev, [field]: url }));
    };

    const handleManualSave = async (e) => {
        e.preventDefault();
        try {
            await saveEmpreendimento(formData);
        } catch (err) {}
    };

    // --- BUSCAS E CEP ---
    const handleSearchChange = async (type, term) => {
        setSearchTerms(prev => ({ ...prev, [type]: term }));
        if (term.length < 2) { setSearchResults(prev => ({ ...prev, [type]: [] })); return; }
        const { data } = await supabase.from('contatos').select('id, nome, razao_social').or(`nome.ilike.%${term}%,razao_social.ilike.%${term}%`).eq('organizacao_id', userData.organizacao_id).limit(10);
        setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    };

    const handleSelectEntity = (type, entity) => {
        setFormData(prev => ({ ...prev, [`${type}_id`]: entity.id }));
        setSearchTerms(prev => ({ ...prev, [type]: entity.razao_social || entity.nome }));
        setSearchResults(prev => ({ ...prev, [type]: [] }));
    };

    const handleCepBlur = useCallback(async (e) => {
        const cep = e.target.value?.replace(/\D/g, '');
        if (cep?.length !== 8) return;
        setIsApiLoading(true);
        try {
            const response = await fetch(`/api/cep?cep=${cep}`);
            const data = await response.json();
            setFormData((prev) => ({ ...prev, cep: data.cep, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }));
        } catch (err) { toast.error("Erro ao buscar CEP"); }
        setIsApiLoading(false);
    }, []);

    if (!isOpen) return null;

    // --- RENDER ---
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header Dourado do Modal */}
                <div className="bg-gray-50 border-b px-6 py-4 flex justify-between items-center text-gray-800 flex-shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-3 tracking-tight">
                        <FontAwesomeIcon icon={faBuilding} className="text-blue-600" />
                        {isEditing ? 'Editar Ficha do Empreendimento' : 'Cadastrar Novo Empreendimento'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center" title="Fechar Formulário">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow bg-white">
                    <form id="empreendimento-form" onSubmit={handleManualSave} className="space-y-8 relative">

                        {!isEditing && (
                            <FileUploadWithAI
                                onAnalysisComplete={(data) => { setFormData(prev => ({ ...prev, ...data })); toast.success('Dados preenchidos via IA!'); }}
                                analysisEndpoint="/api/empreendimentos/analyze-document"
                                prompt="Analise a matrícula e extraia: nome_empreendimento, matricula_numero, terreno_area_total, address_street..."
                            />
                        )}

                        {/* CAMPOS GERAIS + CATEGORIA */}
                        <fieldset>
                            <legend className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Dados Principais</legend>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Nome Fantasia *</label>
                                    <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Residencial Alfa" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Categoria *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                           <FontAwesomeIcon icon={formData.categoria === 'Horizontal' ? faHouse : faBuilding} />
                                        </div>
                                        <select name="categoria" value={formData.categoria || 'Vertical'} onChange={handleChange} required className="mt-1 w-full pl-9 p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-gray-700 appearance-none">
                                            <option value="Vertical">Vertical</option>
                                            <option value="Horizontal">Horizontal</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Status *</label>
                                    <select name="status" value={formData.status || 'Em Planejamento'} onChange={handleChange} required className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-700 font-medium">
                                        <option>Em Planejamento</option> <option>Em Lançamento</option> <option>Em Obras</option> <option>Entregue</option>
                                    </select>
                                </div>
                            </div>
                        </fieldset>

                        {/* SEÇÃO IMAGENS (COM object-contain PARA PROPORCIONALIDADE) */}
                        <fieldset>
                            <legend className="text-lg font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faImage} className="text-blue-500" /> Identidade Visual
                            </legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                <div>
                                    <ThumbnailUploader
                                        label="Imagem de Capa (Thumbnail)"
                                        url={formData.thumbnail_url}
                                        onUpload={(url) => handleImageUpdate('thumbnail_url', url)}
                                        bucketName="empreendimentos"
                                        objectFit="object-contain" // GARANTIA DE PROPORÇÃO!
                                        aspectRatio="aspect-video"
                                    />
                                </div>
                                <div>
                                    <ThumbnailUploader
                                        label="Logo do Empreendimento"
                                        url={formData.logo_url}
                                        onUpload={(url) => handleImageUpdate('logo_url', url)}
                                        bucketName="empreendimentos"
                                        aspectRatio="aspect-square"
                                        objectFit="object-contain" // GARANTIA DE PROPORÇÃO!
                                    />
                                </div>
                            </div>
                        </fieldset>

                        {/* ENDEREÇO */}
                        <fieldset>
                            <legend className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Localização da Obra</legend>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-6 relative">
                                {isApiLoading && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-2xl"/></div>}
                                <div className="md:col-span-2"> <label className="block text-sm font-medium text-gray-700">CEP</label> <IMaskInput mask="00000-000" name="cep" onAccept={(v) => handleMaskedChange('cep', v)} onBlur={handleCepBlur} value={formData.cep || ''} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /> </div>
                                <div className="md:col-span-4"><label className="block text-sm font-medium text-gray-700">Rua/Logradouro</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div className="md:col-span-1"><label className="block text-sm font-medium text-gray-700">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div className="md:col-span-3"><label className="block text-sm font-medium text-gray-700">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div className="md:col-span-4"><label className="block text-sm font-medium text-gray-700">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase" maxLength={2} /></div>
                            </div>
                        </fieldset>

                        {/* DADOS REGISTRO */}
                        <fieldset>
                            <legend className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Registro e Detalhes Construtivos</legend>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><label className="block text-sm font-medium text-gray-700">Área Terreno (m²)</label><input type="number" name="terreno_area_total" value={formData.terreno_area_total || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Nome Oficial (Lançado no Cartório)</label><input type="text" name="nome_empreendimento" value={formData.nome_empreendimento || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div><label className="block text-sm font-medium text-gray-700">Nº da Matrícula Mãe</label><input type="text" name="matricula_numero" value={formData.matricula_numero || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Cartório / Comarca</label><input type="text" name="matricula_cartorio" value={formData.matricula_cartorio || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div><label className="block text-sm font-medium text-gray-700">Ínicio das Obras</label><input type="date" name="data_inicio" value={formData.data_inicio || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                                <div><label className="block text-sm font-medium text-gray-700">Término Previsto</label><input type="date" name="data_fim_prevista" value={formData.data_fim_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                            </div>
                        </fieldset>

                        {/* OBSERVAÇÕES (RODAPÉ DA TABELA) */}
                        <fieldset>
                            <legend className="text-lg font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faFileAlt} className="text-blue-600" /> Observações da Tabela Impressa
                            </legend>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <textarea
                                        name="observacoes"
                                        rows={4}
                                        value={formData.observacoes || ''}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium text-gray-900 bg-gray-50"
                                        placeholder="Ex: *Correção mensal pelo INCC... **1 Vaga de garagem..."
                                    />
                                    <p className="text-xs text-gray-500 mt-2 italic">Este texto funcionará como Termos e Condições rodapé da apresentação que o corretor entregará ao cliente.</p>
                                </div>
                            </div>
                        </fieldset>

                        {/* ENTIDADES DA OBRA (COM BUSCA LIGADA) */}
                        <fieldset>
                            <legend className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Quadro Societário / Parcerias</legend>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">SPE / Proprietária</label>
                                    <select name="empresa_proprietaria_id" value={formData.empresa_proprietaria_id || ''} onChange={handleChange} className="mt-1 w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium">
                                        <option value="">Nenhuma / Pendente...</option>
                                        {proprietariaOptions.map(o => (<option key={o.id} value={o.id}>{o.nome_fantasia || o.razao_social}</option>))}
                                    </select>
                                </div>

                                {/* INCORPORADORA */}
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700">Incorporadora (Contato)</label>
                                    {formData.incorporadora_id ? (
                                        <div className="flex items-center justify-between mt-1 p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-800 font-medium text-sm transition-colors">
                                            <span className="truncate">{searchTerms.incorporadora}</span>
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, incorporadora_id: null }))} className="text-red-500 hover:bg-red-100 p-1 rounded-md" title="Remover Vínculo"><FontAwesomeIcon icon={faTimes} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <input type="text" value={searchTerms.incorporadora} onChange={(e) => handleSearchChange('incorporadora', e.target.value)} placeholder="Procurar contatos..." className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                            {searchResults.incorporadora.length > 0 && <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 shadow-xl rounded-lg max-h-48 overflow-y-auto divide-y">{searchResults.incorporadora.map(e => (<li key={e.id} onClick={() => handleSelectEntity('incorporadora', e)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm font-medium text-gray-700 transition-colors">{e.razao_social || e.nome}</li>))}</ul>}
                                        </>
                                    )}
                                </div>

                                {/* CONSTRUTORA */}
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700">Construtora (Contato)</label>
                                    {formData.construtora_id ? (
                                        <div className="flex items-center justify-between mt-1 p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-800 font-medium text-sm transition-colors">
                                            <span className="truncate">{searchTerms.construtora}</span>
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, construtora_id: null }))} className="text-red-500 hover:bg-red-100 p-1 rounded-md" title="Remover Vínculo"><FontAwesomeIcon icon={faTimes} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <input type="text" value={searchTerms.construtora} onChange={(e) => handleSearchChange('construtora', e.target.value)} placeholder="Procurar contatos..." className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                            {searchResults.construtora.length > 0 && <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 shadow-xl rounded-lg max-h-48 overflow-y-auto divide-y">{searchResults.construtora.map(e => (<li key={e.id} onClick={() => handleSelectEntity('construtora', e)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm font-medium text-gray-700 transition-colors">{e.razao_social || e.nome}</li>))}</ul>}
                                        </>
                                    )}
                                </div>
                            </div>
                        </fieldset>
                    </form>
                </div>

                {/* BOTÕES DO MODAL (FOOTER) */}
                <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-4 flex-shrink-0 relative z-10 w-full">
                    <button type="button" onClick={onClose} className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-100 text-sm font-bold transition-colors shadow-sm">
                        Cancelar
                    </button>
                    <button form="empreendimento-form" type="submit" disabled={isSaving} className="bg-blue-600 text-white text-sm font-bold px-8 py-2.5 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2 transition-all min-w-[200px]">
                        {isSaving ? <><FontAwesomeIcon icon={faSpinner} spin /> Processando...</> : <><FontAwesomeIcon icon={faSave} /> {isEditing ? 'Gravar Alterações' : 'Concluir Cadastro'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
