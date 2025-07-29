"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrashAlt, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner'; // Importar toast

// Países para o seletor de código de telefone
const countries = [
    { name: "Brasil", code: "BR", dial_code: "+55", mask: "(00) 00000-0000" },
    { name: "Estados Unidos", code: "US", dial_code: "+1", mask: "(000) 000-0000" },
    { name: "Portugal", code: "PT", dial_code: "+351", mask: "000 000 000" },
    // Adicione mais países conforme necessário
];

const DynamicInputRow = ({ item, index, onUpdate, onRemove, isPhone, countries }) => {
    const handleUpdate = (field, newValue) => onUpdate(index, field, newValue);
    if (isPhone) {
        // Encontrar a máscara correta para o país selecionado
        const selectedCountry = countries.find(c => c.dial_code === item.country_code) || countries[0];
        const mask = selectedCountry.mask;

        return (
            <div className="flex items-center gap-2">
                <select value={item.country_code || '+55'} onChange={(e) => handleUpdate('country_code', e.target.value)} className="p-2 border rounded-md bg-gray-50 text-sm max-w-[150px]">
                    {countries.map(c => (<option key={c.code} value={c.dial_code}>{c.name} ({c.dial_code})</option>))}
                </select>
                <IMaskInput 
                    mask={mask} // Usar a máscara dinâmica
                    placeholder="(DDD) Telefone" 
                    value={item.telefone || ''} 
                    onAccept={(value) => handleUpdate('telefone', value)} 
                    className="flex-grow p-2 border rounded-md" 
                />
                <button type="button" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full">
                    <FontAwesomeIcon icon={faTrashAlt} />
                </button>
            </div>
        );
    }
    // Bloco para emails - REATIVADO
    return (
        <div className="flex items-center gap-2">
            <input
                type="email"
                placeholder="email@exemplo.com"
                value={item.email || ''}
                onChange={(e) => handleUpdate('email', e.target.value)}
                className="flex-grow p-2 border rounded-md"
            />
            <button type="button" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full">
                <FontAwesomeIcon icon={faTrashAlt} />
            </button>
        </div>
    );
};


export default function ContatoForm({ contactToEdit, onClose, onSaveSuccess }) {
    const supabase = createClient();
    const router = useRouter();
    const isEditing = Boolean(contactToEdit);

    const getInitialState = useCallback(() => ({
        nome: '',
        razao_social: '',
        nome_fantasia: '',
        cnpj: '',
        cpf: '',
        rg: '',
        birth_date: '',
        estado_civil: '',
        nacionalidade: '',
        personalidade_juridica: 'Pessoa Física', // Default
        data_fundacao: '',
        tipo_servico_produto: '',
        pessoa_contato: '',
        cargo: '',
        empresa_id: null, // Certificar que é null se não selecionado
        tipo_contato: 'Outro', // NOVO CAMPO: Valor padrão 'Outro'
        address_street: '',
        address_number: '',
        address_complement: '',
        cep: '',
        city: '',
        state: '',
        neighborhood: '',
        observacoes: '',
        telefones: [{ telefone: '', country_code: '+55' }],
        emails: [{ email: '' }], // REATIVADO: Inicialização de emails
    }), []);

    const [formData, setFormData] = useState(getInitialState());
    const [isLoading, setIsLoading] = useState(false);
    const [isApiLoading, setIsApiLoading] = useState(false);
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        const fetchCompanies = async () => {
            const { data, error } = await supabase.from('cadastro_empresa').select('id, razao_social').order('razao_social');
            if (error) {
                console.error("Erro ao buscar empresas:", error.message);
                toast.error("Erro ao carregar empresas.");
            } else {
                setCompanies(data || []);
            }
        };
        fetchCompanies();
    }, [supabase]);

    useEffect(() => {
        if (isEditing && contactToEdit) {
            // Buscando telefones e emails separadamente para contatos existentes
            const fetchContactDetails = async () => {
                const { data: phonesData, error: phonesError } = await supabase
                    .from('telefones')
                    .select('*')
                    .eq('contato_id', contactToEdit.id);
                
                const { data: emailsData, error: emailsError } = await supabase
                    .from('emails')
                    .select('*')
                    .eq('contato_id', contactToEdit.id);

                if (phonesError) console.error("Erro ao buscar telefones do contato:", phonesError);
                if (emailsError) console.error("Erro ao buscar emails do contato:", emailsError);

                setFormData({
                    ...contactToEdit,
                    empresa_id: contactToEdit.empresa_id || null,
                    tipo_contato: contactToEdit.tipo_contato || 'Outro',
                    // REATIVADO E AJUSTADO: População de telefones e emails do banco de dados
                    telefones: phonesData?.length > 0 ? phonesData : [{ telefone: '', country_code: '+55' }],
                    emails: emailsData?.length > 0 ? emailsData : [{ email: '' }],
                    birth_date: contactToEdit.birth_date ? new Date(contactToEdit.birth_date).toISOString().split('T')[0] : '',
                    data_fundacao: contactToEdit.data_fundacao ? new Date(contactToEdit.data_fundacao).toISOString().split('T')[0] : '',
                });
            };
            fetchContactDetails();
        } else {
            setFormData(getInitialState());
        }
    }, [isEditing, contactToEdit, getInitialState, supabase]); // Adicionado supabase como dependência

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleDynamicInputChange = (listName, index, field, value) => {
        setFormData(prev => ({
            ...prev,
            [listName]: prev[listName].map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    const handleAddDynamicInput = (listName, defaultValue) => {
        setFormData(prev => ({
            ...prev,
            [listName]: [...prev[listName], defaultValue]
        }));
    };

    const handleRemoveDynamicInput = (listName, index) => {
        setFormData(prev => ({
            ...prev,
            [listName]: prev[listName].filter((_, i) => i !== index)
        }));
    };

    const handleCepChange = async (e) => {
        const cep = e.target.value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, cep: cep }));
        if (cep.length === 8) {
            setIsApiLoading(true);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();
                if (data.erro) {
                    toast.error("CEP não encontrado.");
                } else {
                    setFormData(prev => ({
                        ...prev,
                        address_street: data.logradouro,
                        neighborhood: data.bairro,
                        city: data.localidade,
                        state: data.uf,
                    }));
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
                toast.error("Erro ao buscar CEP.");
            } finally {
                setIsApiLoading(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // --- VALIDAÇÃO APRIMORADA ---
        let errors = [];

        if (!formData.nome.trim()) {
            errors.push("O nome é obrigatório.");
        }

        if (formData.personalidade_juridica === 'Pessoa Física') {
            if (!formData.cpf.trim()) {
                errors.push("O CPF é obrigatório para Pessoa Física.");
            }
        } else { // Pessoa Jurídica
            if (!formData.razao_social.trim()) {
                errors.push("A Razão Social é obrigatória para Pessoa Jurídica.");
            }
            if (!formData.cnpj.trim()) {
                errors.push("O CNPJ é obrigatório para Pessoa Jurídica.");
            }
        }

        const hasValidPhone = formData.telefones.some(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length >= 10);
        const hasValidEmail = formData.emails.some(mail => mail.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.email)); // REATIVADO: Validação de emails

        if (!hasValidPhone && !hasValidEmail) { // REATIVADO: Condição de validação de emails
            errors.push("É necessário informar ao menos um telefone ou um e-mail válido.");
        }

        if (errors.length > 0) {
            errors.forEach(err => toast.error(err));
            setIsLoading(false);
            return;
        }
        // --- FIM DA VALIDAÇÃO APRIMORADA ---

        const dataToSave = {
            ...formData,
            // Garantir que empresa_id seja null se vazio
            empresa_id: formData.empresa_id ? parseInt(formData.empresa_id, 10) : null,
            // Incluir tipo_contato
            tipo_contato: formData.tipo_contato,
            // Limpar dados irrelevantes para o tipo de personalidade
            cpf: formData.personalidade_juridica === 'Pessoa Física' ? formData.cpf.replace(/\D/g, '') : null,
            rg: formData.personalidade_juridica === 'Pessoa Física' ? formData.rg : null,
            razao_social: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.razao_social : null,
            nome_fantasia: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.nome_fantasia : null,
            cnpj: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.cnpj.replace(/\D/g, '') : null,
            inscricao_estadual: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.inscricao_estadual : null,
            inscricao_municipal: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.inscricao_municipal : null,
            responsavel_legal: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.responsavel_legal : null,
            data_fundacao: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.data_fundacao : null,
            tipo_servico_produto: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.tipo_servico_produto : null,
            pessoa_contato: formData.personalidade_juridica === 'Pessoa Jurídica' ? formData.pessoa_contato : null,
            cargo: formData.personalidade_juridica === 'Pessoa Física' ? formData.cargo : null,
            birth_date: formData.personalidade_juridica === 'Pessoa Física' ? formData.birth_date : null,
            estado_civil: formData.personalidade_juridica === 'Pessoa Física' ? formData.estado_civil : null,
            nacionalidade: formData.personalidade_juridica === 'Pessoa Física' ? formData.nacionalidade : null,
        };

        const cleanedPhones = formData.telefones.filter(tel => tel.telefone.replace(/\D/g, '').length > 0).map(tel => ({
            telefone: tel.telefone.replace(/\D/g, ''),
            country_code: tel.country_code
        }));
        const cleanedEmails = formData.emails.filter(mail => mail.email.trim() !== '').map(mail => ({ // REATIVADO: Limpeza de emails
            email: mail.email.trim()
        }));
        
        let contatoId = null; // Renomeado para contatoId para consistência
        let error = null;

        if (isEditing) {
            const { data, error: updateError } = await supabase
                .from('contatos')
                .update(dataToSave)
                .eq('id', contactToEdit.id)
                .select('id') // Seleciona apenas o ID para evitar cache de colunas não existentes
                .single();
            if (updateError) error = updateError;
            contatoId = data?.id;
        } else {
            const { data, error: insertError } = await supabase
                .from('contatos')
                .insert(dataToSave)
                .select('id') // Seleciona apenas o ID
                .single();
            if (insertError) error = insertError;
            contatoId = data?.id;
        }

        if (error) {
            console.error("Erro ao salvar contato (principal):", error);
            toast.error(`Erro ao salvar contato: ${error.message}`);
            setIsLoading(false);
            return;
        }

        // --- SALVAR TELEFONES E EMAILS ---
        if (contatoId) {
            // Remover telefones e emails antigos
            await supabase.from('telefones').delete().eq('contato_id', contatoId);
            await supabase.from('emails').delete().eq('contato_id', contatoId); // REATIVADO: Deleção de emails

            // Inserir novos telefones
            if (cleanedPhones.length > 0) {
                const phonesWithContactId = cleanedPhones.map(tel => ({ ...tel, contato_id: contatoId, tipo: 'Celular' })); // Adicionar tipo padrão
                const { error: phoneError } = await supabase.from('telefones').insert(phonesWithContactId);
                if (phoneError) console.error("Erro ao salvar telefones:", phoneError);
            }

            // Inserir novos emails - REATIVADO
            if (cleanedEmails.length > 0) {
                const emailsWithContactId = cleanedEmails.map(mail => ({ ...mail, contato_id: contatoId, tipo: 'Pessoal' })); // Adicionar tipo padrão
                const { error: emailError } = await supabase.from('emails').insert(emailsWithContactId);
                if (emailError) console.error("Erro ao salvar emails:", emailError);
            }
        }
        // --- FIM SALVAR TELEFONES E EMAILS ---

        toast.success(`Contato ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`);
        setIsLoading(false);
        if (onSaveSuccess) onSaveSuccess(contatoId);
        if (onClose) onClose();
        else router.push('/contatos'); // Redirecionar para a lista de contatos
    };


    return (
        <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{isEditing ? 'Editar Contato' : 'Cadastrar Novo Contato'}</h2>

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Tipo de Contato</legend>
                <div className="mt-2 flex gap-4">
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="personalidade_juridica"
                            value="Pessoa Física"
                            checked={formData.personalidade_juridica === 'Pessoa Física'}
                            onChange={handleChange}
                            className="form-radio"
                        />
                        <span className="ml-2">Pessoa Física</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="personalidade_juridica"
                            value="Pessoa Jurídica"
                            checked={formData.personalidade_juridica === 'Pessoa Jurídica'}
                            onChange={handleChange}
                            className="form-radio"
                        />
                        <span className="ml-2">Pessoa Jurídica</span>
                    </label>
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">{formData.personalidade_juridica === 'Pessoa Física' ? 'Dados Pessoais' : 'Dados da Empresa'}</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {formData.personalidade_juridica === 'Pessoa Física' ? (
                        <>
                            <div><label className="block text-sm font-medium">Nome Completo *</label><input name="nome" value={formData.nome || ''} onChange={handleChange} className="w-full p-2 border rounded-md" required /></div>
                            <div><label className="block text-sm font-medium">CPF *</label><IMaskInput mask="000.000.000-00" name="cpf" value={formData.cpf || ''} onAccept={(value) => setFormData(prev => ({ ...prev, cpf: value }))} className="w-full p-2 border rounded-md" required /></div>
                            <div><label className="block text-sm font-medium">RG</label><input name="rg" value={formData.rg || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Data de Nascimento</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Estado Civil</label><input name="estado_civil" value={formData.estado_civil || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Nacionalidade</label><input name="nacionalidade" value={formData.nacionalidade || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">Cargo</label><input name="cargo" value={formData.cargo || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                        </>
                    ) : (
                        <>
                            <div><label className="block text-sm font-medium">Razão Social *</label><input name="razao_social" value={formData.razao_social || ''} onChange={handleChange} className="w-full p-2 border rounded-md" required /></div>
                            <div><label className="block text-sm font-medium">Nome Fantasia</label><input name="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium">CNPJ *</label><IMaskInput mask="00.000.000/0000-00" name="cnpj" value={formData.cnpj || ''} onAccept={(value) => setFormData(prev => ({ ...prev, cnpj: value }))} className="w-full p-2 border rounded-md" required /></div>
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

            {/* NOVO CAMPO: Tipo de Contato */}
            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Classificação do Contato</legend>
                <div className="mt-4">
                    <label className="block text-sm font-medium">Tipo de Contato</label>
                    <select
                        name="tipo_contato"
                        value={formData.tipo_contato || 'Outro'} // Garante um valor padrão
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                    >
                        <option value="Lead">Lead</option>
                        <option value="Cliente">Cliente</option>
                        <option value="Fornecedor">Fornecedor</option>
                        <option value="Parceiro">Parceiro</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Contatos</legend>
                <div className="space-y-3 mt-4">
                    <h4 className="text-md font-medium">Telefones *</h4>
                    {formData.telefones.map((tel, index) => (
                        <DynamicInputRow
                            key={index}
                            item={tel}
                            index={index}
                            onUpdate={(i, field, value) => handleDynamicInputChange('telefones', i, field, value)}
                            onRemove={() => handleRemoveDynamicInput('telefones', index)}
                            isPhone={true}
                            countries={countries}
                        />
                    ))}
                    <button type="button" onClick={() => handleAddDynamicInput('telefones', { telefone: '', country_code: '+55' })} className="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm">
                        <FontAwesomeIcon icon={faPlusCircle} /> Adicionar Telefone
                    </button>

                    {/* Bloco de E-mails REATIVADO */}
                    <h4 className="text-md font-medium mt-6">E-mails *</h4>
                    {formData.emails.map((mail, index) => (
                        <DynamicInputRow
                            key={index}
                            item={mail}
                            index={index}
                            onUpdate={(i, field, value) => handleDynamicInputChange('emails', i, field, value)}
                            onRemove={() => handleRemoveDynamicInput('emails', index)}
                            isPhone={false}
                            countries={countries}
                        />
                    ))}
                    <button type="button" onClick={() => handleAddDynamicInput('emails', { email: '' })} className="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm">
                        <FontAwesomeIcon icon={faPlusCircle} /> Adicionar E-mail
                    </button>
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Informações Adicionais</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium">Empresa Associada</label>
                        <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="w-full p-2 border rounded-md">
                            <option value="">Nenhuma</option>
                            {companies.map(company => (
                                <option key={company.id} value={company.id}>{company.razao_social}</option>
                            ))}
                        </select>
                    </div>
                    <div><label className="block text-sm font-medium">Observações</label><textarea name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows="3" className="w-full p-2 border rounded-md"></textarea></div>
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-semibold text-gray-700">Endereço</legend>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">CEP</label>
                        <IMaskInput
                            mask="00000-000"
                            name="cep"
                            value={formData.cep || ''}
                            onAccept={(value) => setFormData(prev => ({ ...prev, cep: value }))}
                            onBlur={handleCepChange}
                            className="w-full p-2 border rounded-md"
                        />
                        {isApiLoading && <p className="text-xs text-gray-500">Buscando CEP...</p>}
                    </div>
                    <div className="md:col-span-4"><label className="block text-sm font-medium">Logradouro</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-3"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                </div>
            </fieldset>

            <div className="mt-8 flex justify-end gap-4">
                <button type="button" onClick={() => router.push('/contatos')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"> Cancelar </button>
                <button type="submit" disabled={isLoading || isApiLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
                    {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Contato'}
                </button>
            </div>
        </form>
    );
}
