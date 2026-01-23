// Caminho: app/(admin)/contatos/components/ContatoForm.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; 
import { faSpinner, faTrashAlt, faPlusCircle, faTimes, faFingerprint, faSave, faMoneyBillWave, faPiggyBank, faBriefcase } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { buscarDadosCnpj } from './actions';

// -- COMPONENTES AUXILIARES --
const SearchableField = ({ label, selectedName, onClear, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {selectedName ? (
            <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                <span className="font-semibold text-gray-800">{selectedName}</span>
                <button type="button" onClick={onClear} className="text-red-500 hover:text-red-700" title="Limpar Seleção">
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>
        ) : (
            <div>{children}</div>
        )}
    </div>
);

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${'}'}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const countries = [
    { name: "Brasil", code: "BR", dial_code: "+55", mask: "(00) 0000-0000[0]" },
    { name: "Estados Unidos", code: "US", dial_code: "+1", mask: "(000) 000-0000" },
    { name: "Portugal", code: "PT", dial_code: "+351", mask: "000 000 000" },
];

const DynamicInputRow = ({ item, index, onUpdate, onRemove, isPhone, countries }) => {
    const handleUpdate = (field, newValue) => onUpdate(index, field, newValue);
    
    if (isPhone) {
        const selectedCountry = countries.find(c => c.dial_code === item.country_code) || countries[0];
        const mask = selectedCountry.mask;

        return (
            <div className="flex items-center gap-2 mb-2">
                <select 
                    value={item.country_code || '+55'} 
                    onChange={(e) => handleUpdate('country_code', e.target.value)} 
                    className="p-2 border rounded-md bg-gray-50 text-sm max-w-[150px]"
                >
                    {countries.map(c => (<option key={c.code} value={c.dial_code}>{c.name} ({c.dial_code})</option>))}
                </select>
                
                <IMaskInput
                    mask={mask}
                    placeholder="(DDD) Telefone"
                    value={item.telefone || ''}
                    unmask={true} 
                    onAccept={(value) => handleUpdate('telefone', value)}
                    className="flex-grow p-2 border rounded-md"
                />
                
                <button type="button" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full" title="Remover telefone">
                    <FontAwesomeIcon icon={faTrashAlt} />
                </button>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 mb-2">
            <input
                type="email"
                placeholder="email@exemplo.com"
                value={item.email || ''}
                onChange={(e) => handleUpdate('email', e.target.value)}
                className="flex-grow p-2 border rounded-md"
            />
            <button type="button" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full" title="Remover e-mail">
                <FontAwesomeIcon icon={faTrashAlt} />
            </button>
        </div>
    );
};

// --- LISTA VIP (Whitelist para limpeza) ---
const ALLOWED_COLUMNS = [
    'empresa_id', 'nome', 'cargo', 'address_street', 'address_number', 'address_complement',
    'cep', 'city', 'state', 'neighborhood', 'tipo_contato', 'foto_url', 'razao_social',
    'nome_fantasia', 'cnpj', 'inscricao_estadual', 'inscricao_municipal', 'responsavel_legal',
    'cpf', 'rg', 'birth_date', 'estado_civil', 'contract_role', 'admission_date',
    'demission_date', 'status', 'base_salary', 'total_salary', 'daily_value', 'payment_method',
    'pix_key', 'bank_details', 'observations', 'numero_ponto', 'nacionalidade',
    'personalidade_juridica', 'data_fundacao', 'tipo_servico_produto', 'pessoa_contato',
    'objetivo', 'is_awaiting_name_response', 'origem', 'organizacao_id', 'conjuge_id', 
    'regime_bens', 'criado_por_usuario_id', 'creci', 'lixeira', 'renda_familiar', 'fgts',
    'mais_de_3_anos_clt'
];

// FORMULÁRIO PRINCIPAL
export default function ContatoForm({ contactToEdit, onClose, onSaveSuccess, organizacaoId }) {
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();
    const isEditing = Boolean(contactToEdit);
    const { user } = useAuth();
    
    const currentOrgId = organizacaoId || user?.organizacao_id;

    // Helper para formatar moeda na inicialização
    const formatCurrencyInitial = (value) => {
        if (!value) return '';
        // Converte o número vindo do banco (ex: 1500.50) para string formatada (1.500,50)
        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    };

    const getInitialState = () => ({
        nome: '', razao_social: '', nome_fantasia: '', cnpj: '', cpf: '', rg: '',
        birth_date: '', estado_civil: '', nacionalidade: '', personalidade_juridica: 'Pessoa Física',
        data_fundacao: '', tipo_servico_produto: '', pessoa_contato: '', cargo: '',
        empresa_id: null, tipo_contato: 'Lead', origem: 'Manual', address_street: '',
        address_number: '', address_complement: '', cep: '', city: '', state: '',
        neighborhood: '', observations: '', objetivo: '',
        telefones: [{ telefone: '', country_code: '+55' }],
        emails: [{ email: '' }],
        regime_bens: '', conjuge_id: null, renda_familiar: '', fgts: null,
        mais_de_3_anos_clt: null,
        inscricao_estadual: '',
        inscricao_municipal: '',
        responsavel_legal: '',
        organizacao_id: currentOrgId 
    });

    const [formData, setFormData] = useState(getInitialState());
    const [isApiLoading, setIsApiLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [conjugeSearchTerm, setConjugeSearchTerm] = useState('');
    const [conjugeSearchResults, setConjugeSearchResults] = useState([]);
    const [selectedConjugeName, setSelectedConjugeName] = useState('');
    
    // --- NOVO: Estado para armazenar as opções vindas do banco ---
    const [tipoContatoOptions, setTipoContatoOptions] = useState(['Lead', 'Cliente', 'Fornecedor', 'Parceiro', 'Corretor', 'Candidato']);

    // Buscar Tipos de Contato do Banco (Automático)
    useEffect(() => {
        const fetchTiposContato = async () => {
            try {
                const { data, error } = await supabase.rpc('get_tipo_contato_options');
                if (!error && data && data.length > 0) {
                    setTipoContatoOptions(data);
                }
            } catch (err) {
                console.error("Erro ao buscar tipos de contato, usando padrão.", err);
            }
        };
        fetchTiposContato();
    }, [supabase]);

    useEffect(() => {
        const initializeData = async () => {
            if (isEditing && contactToEdit) {
                // Prepara telefones para exibição
                const phonesData = (contactToEdit.telefones || []).map(tel => {
                    let rawPhone = tel.telefone ? String(tel.telefone).replace(/\D/g, '') : '';
                    let countryCode = tel.country_code || '+55';
                    if (countryCode === '+55' && rawPhone.startsWith('55')) rawPhone = rawPhone.substring(2);
                    return { ...tel, telefone: rawPhone, country_code: countryCode };
                });

                const emailsData = contactToEdit.emails || [{ email: '' }];
                
                if (contactToEdit.conjuge_id && !selectedConjugeName) {
                    const { data: conjugeData } = await supabase.from('contatos').select('nome, razao_social').eq('id', contactToEdit.conjuge_id).maybeSingle(); 
                    if(conjugeData) setSelectedConjugeName(conjugeData.nome || conjugeData.razao_social);
                }

                setFormData({
                    ...getInitialState(),
                    ...contactToEdit, 
                    renda_familiar: formatCurrencyInitial(contactToEdit.renda_familiar), // Formata ao carregar
                    organizacao_id: currentOrgId, 
                    telefones: phonesData.length > 0 ? phonesData : [{ telefone: '', country_code: '+55' }],
                    emails: emailsData.length > 0 ? emailsData : [{ email: '' }],
                });
            } else {
                setFormData(prev => ({ ...prev, organizacao_id: currentOrgId }));
                setSelectedConjugeName('');
            }
        };
        initializeData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, contactToEdit?.id, currentOrgId]); 

    // Lista de empresas
    const { data: companies } = useQuery({
        queryKey: ['companiesList', currentOrgId],
        queryFn: async () => {
            if (!currentOrgId) return [];
            const { data } = await supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', currentOrgId).order('razao_social');
            return data || [];
        },
        enabled: !!currentOrgId
    });
    
    // --- FUNÇÃO DE SALVAR MODO DIRETO (CLIENT-SIDE) ---
    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!currentOrgId || !user) {
            toast.error("Erro: Sessão inválida. Recarregue a página.");
            return;
        }

        setIsSaving(true);
        const toastId = toast.loading(isEditing ? "Atualizando..." : "Salvando...");

        try {
            // 1. Prepara dados do CONTATO
            const dataToSave = {};
            Object.keys(formData).forEach(key => {
                if (ALLOWED_COLUMNS.includes(key)) {
                    let value = formData[key];
                    
                    // Tratamento de datas vazias
                    if ((key === 'birth_date' || key === 'data_fundacao') && (value === '' || value === undefined)) {
                        value = null;
                    } 
                    
                    // CORREÇÃO AQUI: Tratamento da RENDA FAMILIAR
                    if (key === 'renda_familiar') {
                        if (value && typeof value === 'string') {
                            // 1. Remove tudo que NÃO for número ou vírgula (tira R$, pontos de milhar, espaços)
                            const cleanString = value.replace(/[^\d,]/g, '');
                            // 2. Troca a vírgula por ponto para o formato americano (DB)
                            const numberString = cleanString.replace(',', '.');
                            // 3. Converte para float
                            value = parseFloat(numberString);
                            
                            // Segurança extra: se der NaN, manda null
                            if (isNaN(value)) value = null;

                        } else if (value === '') {
                            value = null;
                        }
                    }

                    if (value === '' || value === undefined) value = null;
                    dataToSave[key] = value;
                }
            });
            
            dataToSave.organizacao_id = currentOrgId;
            if (!isEditing) {
                dataToSave.criado_por_usuario_id = user.id;
                if (!dataToSave.origem) dataToSave.origem = 'Manual';
            }

            let contatoId = isEditing ? formData.id : null;

            // 2. Salva o CONTATO
            if (isEditing) {
                const { error: updateError } = await supabase
                    .from('contatos')
                    .update(dataToSave)
                    .eq('id', contatoId);
                if (updateError) throw updateError;
            } else {
                const { data: insertData, error: insertError } = await supabase
                    .from('contatos')
                    .insert(dataToSave)
                    .select('id')
                    .single();
                if (insertError) throw insertError;
                contatoId = insertData.id;
            }

            // 3. Prepara e Salva TELEFONES
            const cleanPhones = (formData.telefones || [])
                .filter(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length > 0)
                .map(tel => {
                    let cleanNumber = tel.telefone.replace(/\D/g, '');
                    const ddi = (tel.country_code || '+55').replace('+', '');
                    if (!cleanNumber.startsWith(ddi)) cleanNumber = ddi + cleanNumber;
                    return {
                        contato_id: contatoId,
                        telefone: cleanNumber,
                        country_code: tel.country_code || '+55',
                        tipo: tel.tipo || 'Celular',
                        organizacao_id: currentOrgId
                    };
                });

            if (isEditing) {
                await supabase.from('telefones').delete().eq('contato_id', contatoId);
            }
            if (cleanPhones.length > 0) {
                const { error: phoneError } = await supabase.from('telefones').insert(cleanPhones);
                if (phoneError) console.error("Erro ao salvar telefones:", phoneError);
            }

            // 4. Prepara e Salva EMAILS
            const cleanEmails = (formData.emails || [])
                .filter(mail => mail.email && mail.email.trim() !== '')
                .map(mail => ({
                    contato_id: contatoId,
                    email: mail.email.trim(),
                    tipo: mail.tipo || 'Pessoal',
                    organizacao_id: currentOrgId
                }));

            if (isEditing) {
                await supabase.from('emails').delete().eq('contato_id', contatoId);
            }
            if (cleanEmails.length > 0) {
                const { error: emailError } = await supabase.from('emails').insert(cleanEmails);
                if (emailError) console.error("Erro ao salvar emails:", emailError);
            }

            toast.dismiss(toastId);
            toast.success(`Contato ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`);
            
            queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] });
            if (isEditing) queryClient.invalidateQueries({ queryKey: ['contactDetails', formData.id] });

            if (onSaveSuccess) onSaveSuccess(contatoId);
            if (onClose) onClose();
            else router.push('/contatos');

        } catch (error) {
            console.error("Erro fatal ao salvar:", error);
            toast.dismiss(toastId);
            let msg = error.message;
            if (msg.includes('policy')) msg = "Erro de permissão no banco de dados. Verifique o SQL.";
            toast.error(`Erro ao salvar: ${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    // Funções de Cônjuge, CEP e CNPJ
    const handleSearchConjuge = useCallback(async (term) => {
        setConjugeSearchTerm(term);
        if (term.length < 2 || !currentOrgId) {
            setConjugeSearchResults([]); return;
        }
        const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term, p_organizacao_id: currentOrgId });
        setConjugeSearchResults(data || []);
    }, [supabase, currentOrgId]);

    const handleSelectConjuge = (conjuge) => {
        setFormData(prev => ({ ...prev, conjuge_id: conjuge.id }));
        setSelectedConjugeName(conjuge.nome || conjuge.razao_social);
        setConjugeSearchTerm(''); setConjugeSearchResults([]);
    };

    const handleClearConjuge = () => {
        setFormData(prev => ({ ...prev, conjuge_id: null }));
        setSelectedConjugeName('');
    };

    const handleDynamicInputChange = (listName, index, field, value) => {
        setFormData(prev => ({ ...prev, [listName]: prev[listName].map((item, i) => i === index ? { ...item, [field]: value } : item) }));
    };

    const handleAddDynamicInput = (listName, defaultValue) => {
        setFormData(prev => ({ ...prev, [listName]: [...prev[listName], defaultValue] }));
    };

    const handleRemoveDynamicInput = (listName, index) => {
        if (formData[listName].length === 1) {
            const clearedItem = listName === 'telefones' ? { telefone: '', country_code: '+55' } : { email: '' };
            setFormData(prev => ({ ...prev, [listName]: [clearedItem] }));
        } else {
            setFormData(prev => ({ ...prev, [listName]: prev[listName].filter((_, i) => i !== index) }));
        }
    };

    const fetchAddressFromCep = useCallback(async (cep) => {
        const cleanCep = cep?.replace(/\D/g, '');
        if (cleanCep && cleanCep.length === 8) {
            setIsApiLoading(true);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await response.json();
                if (data.erro) toast.warning("Endereço não encontrado para o CEP informado.");
                else setFormData(prev => ({ ...prev, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf, }));
            } catch (error) { toast.error("Erro ao buscar CEP."); } finally { setIsApiLoading(false); }
        }
    }, []);
    
    const handleCepChange = (cep) => {
        setFormData(prev => ({ ...prev, cep }));
        fetchAddressFromCep(cep);
    };

    const handleCnpjLookup = useCallback(async (unmaskedCnpj) => {
        setIsApiLoading(true);
        const promise = buscarDadosCnpj(unmaskedCnpj);
        toast.promise(promise, {
            loading: 'Buscando dados do CNPJ...',
            success: (result) => {
                if (result.error) throw new Error(result.error);
                const { api_telefone, api_email, ...formDataToUpdate } = result.data;
                setFormData(prev => {
                    const newTelefones = [...prev.telefones];
                    if (api_telefone && (!newTelefones[0] || !newTelefones[0].telefone)) newTelefones[0] = { telefone: api_telefone, country_code: '+55' };
                    const newEmails = [...prev.emails];
                    if (api_email && (!newEmails[0] || !newEmails[0].email)) newEmails[0] = { email: api_email };
                    return { ...prev, ...formDataToUpdate, telefones: newTelefones, emails: newEmails };
                });
                if (result.data.cep) fetchAddressFromCep(result.data.cep);
                return 'Dados do CNPJ preenchidos com sucesso!';
            },
            error: (err) => err.message,
            finally: () => setIsApiLoading(false),
        });
    }, [fetchAddressFromCep]);
    
    return (
        <form onSubmit={handleSave} className="space-y-6 p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Editar Contato' : 'Cadastrar Novo Contato'}</h2>
                    {isEditing && contactToEdit?.id && (
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded-full flex items-center gap-1" title="ID do Banco de Dados">
                            <FontAwesomeIcon icon={faFingerprint} />
                            #{contactToEdit.id}
                        </span>
                    )}
                </div>
            </div>
            
             {isEditing && formData.origem && (
                <div className="p-3 bg-gray-100 rounded-md">
                    <label className="block text-sm font-medium text-gray-500">Origem do Contato</label>
                    <p className="text-md font-semibold text-gray-800">{formData.origem}</p>
                </div>
            )}

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Tipo de Contato</legend>
                <div className="mt-2 flex gap-4">
                    <label className="inline-flex items-center">
                        <input type="radio" name="personalidade_juridica" value="Pessoa Física" checked={formData.personalidade_juridica === 'Pessoa Física'} onChange={handleChange} className="form-radio" />
                        <span className="ml-2">Pessoa Física</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input type="radio" name="personalidade_juridica" value="Pessoa Jurídica" checked={formData.personalidade_juridica === 'Pessoa Jurídica'} onChange={handleChange} className="form-radio" />
                        <span className="ml-2">Pessoa Jurídica</span>
                    </label>
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">{formData.personalidade_juridica === 'Pessoa Física' ? 'Dados Pessoais' : 'Dados da Empresa'}</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {formData.personalidade_juridica === 'Pessoa Física' ? (
                        <>
                            <div><label className="block text-sm font-medium">Nome Completo</label><input name="nome" value={formData.nome || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">CPF</label><IMaskInput mask="000.000.000-00" name="cpf" value={formData.cpf || ''} onAccept={(value) => setFormData(prev => ({ ...prev, cpf: value }))} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">RG</label><input name="rg" value={formData.rg || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            
                            {/* ESTADO CIVIL */}
                            <div>
                                <label className="block text-sm font-medium">Estado Civil</label>
                                <select name="estado_civil" value={formData.estado_civil || ''} onChange={handleChange} className="w-full p-2 border rounded-md">
                                    <option value="">Selecione...</option>
                                    <option>Solteiro(a)</option>
                                    <option>Casado(a)</option>
                                    <option>Divorciado(a)</option>
                                    <option>Viúvo(a)</option>
                                    <option>União Estável</option>
                                </select>
                            </div>

                            <div><label className="block text-sm font-medium">Data de Nascimento</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Nacionalidade</label><input name="nacionalidade" value={formData.nacionalidade || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Cargo</label><input name="cargo" value={formData.cargo || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        </>
                    ) : (
                        <>
                            <div><label className="block text-sm font-medium">Razão Social</label><input name="razao_social" value={formData.razao_social || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Nome Fantasia</label><input name="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div>
                                <label className="block text-sm font-medium">CNPJ</label>
                                <IMaskInput 
                                    mask="00.000.000/0000-00" 
                                    name="cnpj" 
                                    value={formData.cnpj || ''} 
                                    onAccept={(value) => setFormData(prev => ({ ...prev, cnpj: value }))}
                                    onComplete={(value, mask) => handleCnpjLookup(mask.unmaskedValue)} 
                                    className="w-full p-2 border rounded-md" 
                                />
                            </div>
                            <div><label className="block text-sm font-medium">Inscrição Estadual</label><input name="inscricao_estadual" value={formData.inscricao_estadual || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Inscrição Municipal</label><input name="inscricao_municipal" value={formData.inscricao_municipal || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Responsável Legal</label><input name="responsavel_legal" value={formData.responsavel_legal || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Data de Fundação</label><input type="date" name="data_fundacao" value={formData.data_fundacao || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Tipo de Serviço/Produto</label><input name="tipo_servico_produto" value={formData.tipo_servico_produto || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Pessoa de Contato</label><input name="pessoa_contato" value={formData.pessoa_contato || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        </>
                    )}
                </div>
            </fieldset>
            
            {formData.personalidade_juridica === 'Pessoa Física' && (
                <fieldset className="border p-4 rounded-md">
                    <legend className="text-lg font-semibold text-gray-700">Qualificação</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        
                        {/* CAMPO RENDA FAMILIAR */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FontAwesomeIcon icon={faMoneyBillWave} className="text-green-600" />
                                Renda Familiar
                            </label>
                            <IMaskInput
                                mask="R$ num"
                                blocks={{
                                    num: {
                                        mask: Number,
                                        thousandsSeparator: '.',
                                        radix: ',',
                                        scale: 2,
                                        padFractionalZeros: true,
                                        normalizeZeros: true,
                                        mapToRadix: ['.']
                                    }
                                }}
                                value={formData.renda_familiar || ''}
                                unmask={false} 
                                onAccept={(value) => setFormData(prev => ({ ...prev, renda_familiar: value }))}
                                placeholder="R$ 0,00"
                                className="w-full p-2 border rounded-md"
                            />
                        </div>

                        {/* CAMPO: FGTS */}
                        <div>
                             <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FontAwesomeIcon icon={faPiggyBank} className="text-blue-600" />
                                Possui FGTS?
                            </label>
                            <select 
                                name="fgts" 
                                value={formData.fgts === null || formData.fgts === undefined ? "" : String(formData.fgts)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, fgts: val === "" ? null : val === "true" }));
                                }} 
                                className="w-full p-2 border rounded-md"
                            >
                                <option value="">Selecione...</option>
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                            </select>
                        </div>

                         {/* CAMPO: +3 ANOS DE CLT */}
                         <div>
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FontAwesomeIcon icon={faBriefcase} className="text-gray-600" />
                                +3 Anos de CLT?
                            </label>
                            <select 
                                name="mais_de_3_anos_clt" 
                                value={formData.mais_de_3_anos_clt === null || formData.mais_de_3_anos_clt === undefined ? "" : String(formData.mais_de_3_anos_clt)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, mais_de_3_anos_clt: val === "" ? null : val === "true" }));
                                }} 
                                className="w-full p-2 border rounded-md"
                            >
                                <option value="">Selecione...</option>
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                            </select>
                        </div>

                         {/* CAMPO: OBJETIVO */}
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Objetivo</label>
                            <textarea 
                                name="objetivo" 
                                value={formData.objetivo || ''} 
                                onChange={handleChange} 
                                rows="2" 
                                placeholder="Descreva o objetivo principal deste contato..."
                                className="w-full p-2 border rounded-md"
                            ></textarea>
                        </div>

                        {['Casado(a)', 'União Estável'].includes(formData.estado_civil) && (
                           <div>
                                <label className="block text-sm font-medium">Regime de Bens</label>
                                <input name="regime_bens" value={formData.regime_bens || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                        )}
                    </div>
                    {['Casado(a)', 'União Estável'].includes(formData.estado_civil) && (
                        <div className="mt-4 border-t pt-4">
                            <SearchableField label="Cônjuge / Companheiro(a)" selectedName={selectedConjugeName} onClear={handleClearConjuge}>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={conjugeSearchTerm}
                                        onChange={(e) => handleSearchConjuge(e.target.value)}
                                        placeholder="Buscar contato do cônjuge..."
                                        className="w-full p-2 border rounded-md"
                                    />
                                    {conjugeSearchResults.length > 0 && (
                                        <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                                            {conjugeSearchResults.map(c => (
                                                <li key={c.id} onClick={() => handleSelectConjuge(c)} className="p-2 hover:bg-gray-100 cursor-pointer">
                                                    <HighlightedText text={c.nome || c.razao_social} highlight={conjugeSearchTerm} />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SearchableField>
                        </div>
                    )}
                </fieldset>
            )}

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Classificação e Contato</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium">Tipo de Contato</label>
                        <select name="tipo_contato" value={formData.tipo_contato || 'Lead'} onChange={handleChange} className="w-full p-2 border rounded-md">
                            {tipoContatoOptions.map(tipo => (
                                <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="space-y-3 mt-4">
                    <h4 className="text-md font-medium">Telefones</h4>
                    {formData.telefones.map((tel, index) => (<DynamicInputRow key={index} item={tel} index={index} onUpdate={(i, field, value) => handleDynamicInputChange('telefones', i, field, value)} onRemove={() => handleRemoveDynamicInput('telefones', index)} isPhone={true} countries={countries}/>))}
                    <button type="button" onClick={() => handleAddDynamicInput('telefones', { telefone: '', country_code: '+55' })} className="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm"><FontAwesomeIcon icon={faPlusCircle} /> Adicionar Telefone</button>
                    <h4 className="text-md font-medium mt-6">E-mails</h4>
                    {formData.emails.map((mail, index) => (<DynamicInputRow key={index} item={mail} index={index} onUpdate={(i, field, value) => handleDynamicInputChange('emails', i, field, value)} onRemove={() => handleRemoveDynamicInput('emails', index)} isPhone={false} countries={countries} />))}
                    <button type="button" onClick={() => handleAddDynamicInput('emails', { email: '' })} className="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm"><FontAwesomeIcon icon={faPlusCircle} /> Adicionar E-mail</button>
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Endereço</legend>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
                    <div className="md:col-span-2"><label className="block text-sm font-medium">CEP</label><IMaskInput mask="00000-000" name="cep" value={formData.cep || ''} onAccept={(value, mask) => handleCepChange(mask.unmaskedValue)} className="w-full p-2 border rounded-md"/>{isApiLoading && <p className="text-xs text-gray-500">Buscando...</p>}</div>
                    <div className="md:col-span-4"><label className="block text-sm font-medium">Logradouro</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-3"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                </div>
            </fieldset>

             <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Informações Adicionais</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div><label className="block text-sm font-medium">Empresa Associada</label><select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="w-full p-2 border rounded-md"><option value="">Nenhuma</option>{(companies || []).map(company => (<option key={company.id} value={company.id}>{company.razao_social}</option>))}</select></div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Observações</label>
                        <textarea name="observations" value={formData.observations || ''} onChange={handleChange} rows="3" className="w-full p-2 border rounded-md"></textarea>
                    </div>
                </div>
            </fieldset>

            <div className="mt-8 flex justify-end gap-4">
                <button type="button" onClick={() => onClose ? onClose() : router.push('/contatos')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"> Cancelar </button>
                <button type="submit" disabled={isSaving || isApiLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 font-semibold">
                    {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                    {isEditing ? 'Atualizar Contato' : 'Salvar Contato'}
                </button>
            </div>
        </form>
    );
}