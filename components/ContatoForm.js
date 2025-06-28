"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrashAlt, faPlusCircle, faBuilding, faUser } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '../utils/formatters';

// Lista fixa de países para garantir a consistência
const countryList = [
    { name: 'Brazil', dial_code: '+55', code: 'BR' },
    { name: 'United States', dial_code: '+1', code: 'US' },
    { name: 'Argentina', dial_code: '+54', code: 'AR' },
    { name: 'Australia', dial_code: '+61', code: 'AU' },
    { name: 'Canada', dial_code: '+1', code: 'CA' },
    { name: 'China', dial_code: '+86', code: 'CN' },
    { name: 'France', dial_code: '+33', code: 'FR' },
    { name: 'Germany', dial_code: '+49', code: 'DE' },
    { name: 'Italy', dial_code: '+39', code: 'IT' },
    { name: 'Japan', dial_code: '+81', code: 'JP' },
    { name: 'Mexico', dial_code: '+52', code: 'MX' },
    { name: 'Portugal', dial_code: '+351', code: 'PT' },
    { name: 'Spain', dial_code: '+34', code: 'ES' },
    { name: 'United Kingdom', dial_code: '+44', code: 'GB' },
    // Adicione mais países aqui se necessário
];


// Sub-componente para a linha de telefone/email
const DynamicInputRow = ({ item, index, onUpdate, onRemove, isPhone, countries }) => {

    const handleUpdate = (field, newValue) => {
        onUpdate(index, field, newValue);
    };

    if (isPhone) {
        return (
            <div className="flex items-center gap-2">
                <select 
                    value={item.country_code || '+55'} 
                    onChange={(e) => handleUpdate('country_code', e.target.value)}
                    className="p-2 border rounded-md bg-gray-50 text-sm max-w-[150px]"
                >
                    {countries.map(c => (
                        <option key={c.code} value={c.dial_code}>{c.name} ({c.dial_code})</option>
                    ))}
                </select>
                <IMaskInput
                    mask={[{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }]}
                    placeholder="(DDD) Telefone"
                    value={item.telefone || ''}
                    onAccept={(value) => handleUpdate('telefone', value)}
                    className="flex-grow p-2 border rounded-md"
                />
                <input
                    type="text"
                    placeholder="Tipo (Ex: Celular)"
                    value={item.tipo || ''}
                    onChange={(e) => handleUpdate('tipo', e.target.value)}
                    className="w-1/3 p-2 border rounded-md"
                />
                <button type="button" onClick={() => onRemove(index)}>
                    <FontAwesomeIcon icon={faTrashAlt} className="text-red-500 hover:text-red-700" />
                </button>
            </div>
        )
    }

    // Input para Email
    return (
        <div className="flex items-center gap-2">
            <input
                type="email"
                placeholder="endereco@email.com"
                value={item.email || ''}
                onChange={(e) => handleUpdate('email', e.target.value)}
                className="flex-grow p-2 border rounded-md"
            />
            <input
                type="text"
                placeholder="Tipo (Ex: Pessoal)"
                value={item.tipo || ''}
                onChange={(e) => handleUpdate('tipo', e.target.value)}
                className="w-1/3 p-2 border rounded-md"
            />
            <button type="button" onClick={() => onRemove(index)}>
                <FontAwesomeIcon icon={faTrashAlt} className="text-red-500 hover:text-red-700" />
            </button>
        </div>
    );
};


export default function ContatoForm({ initialData }) {
  const supabase = createClient();
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);
  const [formType, setFormType] = useState('pf');
  // O estado agora é inicializado diretamente com a nossa lista fixa.
  const [countries, setCountries] = useState(countryList);

  const getInitialState = useCallback(() => ({
    nome: '', tipo_contato: null, status: 'Ativo', razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '', inscricao_municipal: '', responsavel_legal: '', cpf: '', rg: '', nacionalidade: '', birth_date: null, estado_civil: '', cargo: '', contract_role: '', admission_date: null, demission_date: null, cep: '', address_street: '', address_number: '', address_complement: '', neighborhood: '', city: '', state: '', base_salary: '', total_salary: '', daily_value: '', payment_method: '', pix_key: '', bank_details: '', observations: '', numero_ponto: null, foto_url: null,
    telefones: [{ tempId: 'phone_0', country_code: '+55', telefone: '', tipo: 'Celular' }],
    emails: [{ tempId: 'email_0', email: '', tipo: 'Pessoal' }],
  }), []);

  const [formData, setFormData] = useState(getInitialState());
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [uniqueKeyCounter, setUniqueKeyCounter] = useState(1);
  
  // O useEffect que chamava a API foi REMOVIDO.

  useEffect(() => {
    const loadInitialData = async () => {
      if (initialData?.id) {
        setIsLoading(true);
        if (initialData.cnpj) setFormType('pj');
        
        const { data: telefones } = await supabase.from('telefones').select('*').eq('contato_id', initialData.id);
        const { data: emails } = await supabase.from('emails').select('*').eq('contato_id', initialData.id);
        
        const formattedTelefones = (telefones || []).map(t => {
            const fullNumber = (t.telefone || '').replace(/\D/g, '');
            let country_code = t.country_code || '+55';
            
            // Tenta remover o código do país do número para exibir apenas o número local
            const countryDigits = country_code.replace(/\D/g, '');
            let localNumber = fullNumber;
            if (fullNumber.startsWith(countryDigits)) {
                localNumber = fullNumber.substring(countryDigits.length);
            }

            return {...t, country_code, telefone: localNumber };
        });

        setFormData({ ...getInitialState(), ...initialData, telefones: formattedTelefones?.length > 0 ? formattedTelefones : getInitialState().telefones, emails: emails?.length > 0 ? emails : getInitialState().emails });
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [initialData, supabase, getInitialState]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleDynamicListUpdate = (listName, index, field, value) => {
    const updatedList = formData[listName].map((item, i) => i === index ? { ...item, [field]: value } : item);
    setFormData(prev => ({ ...prev, [listName]: updatedList }));
  };

  const addDynamicListItem = (listName) => {
    const newKey = uniqueKeyCounter;
    setUniqueKeyCounter(prev => prev + 1);
    const newItem = listName === 'telefones' ? { tempId: `phone_${newKey}`, country_code: '+55', telefone: '', tipo: '' } : { tempId: `email_${newKey}`, email: '', tipo: '' };
    setFormData(prev => ({ ...prev, [listName]: [...prev[listName], newItem] }));
  };

  const removeDynamicListItem = (listName, index) => {
    if (formData[listName].length > 1) {
      setFormData(prev => ({ ...prev, [listName]: prev[listName].filter((_, i) => i !== index) }));
    } else {
        const updatedList = formData[listName].map((item, i) => i === index ? { ...item, telefone: '', email: '', tipo: '' } : item);
        setFormData(prev => ({ ...prev, [listName]: updatedList }));
    }
  };
  
  const handleCepBlur = async (cep) => {
    const cepLimpo = cep?.replace(/\D/g, '');
    if (cepLimpo?.length !== 8) return;
    setIsApiLoading(true); setMessage('Buscando CEP...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (!response.ok) throw new Error('CEP não encontrado');
      const data = await response.json();
      if (data.erro) throw new Error('CEP inválido.');
      setFormData(prev => ({ ...prev, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf, cep: cepLimpo }));
      setMessage('Endereço preenchido!');
    } catch (error) { setMessage(error.message); } finally { setIsApiLoading(false); setTimeout(() => setMessage(''), 3000); }
  };

  const handleCnpjBlur = async (cnpj) => {
    const cnpjLimpo = cnpj?.replace(/\D/g, '');
    if (cnpjLimpo?.length !== 14) return;
    setIsApiLoading(true); setMessage('Buscando CNPJ...');
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!response.ok) throw new Error('CNPJ não encontrado ou inválido.');
      const data = await response.json();
      const telefoneApi = data.ddd_telefone_1 ? [{ tempId: 'phone_0', country_code: '+55', telefone: data.ddd_telefone_1, tipo: 'Comercial' }] : formData.telefones;
      setFormData(prev => ({ ...prev, razao_social: data.razao_social, nome_fantasia: data.nome_fantasia, cep: data.cep, address_street: data.logradouro, address_number: data.numero, address_complement: data.complemento, neighborhood: data.bairro, city: data.municipio, state: data.uf, telefones: prev.telefones[0]?.telefone ? prev.telefones : telefoneApi }));
      setMessage('Dados da empresa preenchidos!');
    } catch (error) { setMessage(error.message); } finally { setIsApiLoading(false); setTimeout(() => setMessage(''), 3000); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); setMessage(isEditing ? 'Atualizando contato...' : 'Criando contato...');
    
    const telefonesParaSalvar = formData.telefones
        .map(tel => ({
            ...tel,
            telefone: (tel.country_code || '').replace(/\D/g, '') + (tel.telefone || '').replace(/\D/g, ''),
            country_code: tel.country_code || '+55'
        }))
        .filter(tel => tel.telefone);

    const emailsParaSalvar = formData.emails.filter(em => em.email && em.email.trim() !== '');
        
    const { id, telefones, emails, ...contatoData } = formData;
    
    let savedContact;
    if (isEditing) {
      const { data, error } = await supabase.from('contatos').update(contatoData).eq('id', initialData.id).select().single();
      if (error) { setMessage(`Erro ao atualizar contato: ${error.message}`); setIsLoading(false); return; }
      savedContact = data;
    } else {
      const { data, error } = await supabase.from('contatos').insert(contatoData).select().single();
      if (error) { setMessage(`Erro ao criar contato: ${error.message}`); setIsLoading(false); return; }
      savedContact = data;
    }
    
    const saveRelatedData = async (list, tableName) => {
        const itemsToSave = list.map(({ id, tempId, ...dbItem }) => ({ ...dbItem, contato_id: savedContact.id }));
        
        if (isEditing) { 
          await supabase.from(tableName).delete().eq('contato_id', savedContact.id);
        }

        if (itemsToSave.length > 0) {
            const { error } = await supabase.from(tableName).insert(itemsToSave);
            if (error) {
                throw new Error(`Erro ao salvar ${tableName}: ${error.message}`);
            }
        }
    };

    try {
      await saveRelatedData(telefonesParaSalvar, 'telefones');
      await saveRelatedData(emailsParaSalvar, 'emails');
      setMessage(`Contato ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
      setTimeout(() => {
        router.push('/contatos');
        router.refresh();
      }, 1500);
    } catch (error) { 
        setMessage(error.message);
        setIsLoading(false);
    } 
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {(message || isApiLoading) && ( <div className={`p-3 rounded-md text-center sticky top-2 z-10 ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}> {isApiLoading ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : null} {message} </div> )}
      
      <div className="flex justify-center p-1 bg-gray-200 rounded-lg">
        <button type="button" onClick={() => setFormType('pf')} className={`w-1/2 p-2 rounded-md font-semibold flex items-center justify-center gap-2 ${formType === 'pf' ? 'bg-white shadow' : 'text-gray-600'}`}> <FontAwesomeIcon icon={faUser} /> Pessoa Física </button>
        <button type="button" onClick={() => setFormType('pj')} className={`w-1/2 p-2 rounded-md font-semibold flex items-center justify-center gap-2 ${formType === 'pj' ? 'bg-white shadow' : 'text-gray-600'}`}> <FontAwesomeIcon icon={faBuilding} /> Pessoa Jurídica </button>
      </div>

      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Informações de Contato</legend>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-10">
           <div>
             <label className="block text-sm font-medium mb-2">Telefones</label>
             <div className="space-y-3">
               {formData.telefones.map((item, index) => <DynamicInputRow key={item.id || item.tempId} item={item} index={index} onUpdate={(...args) => handleDynamicListUpdate('telefones', ...args)} onRemove={(idx) => removeDynamicListItem('telefones', idx)} isPhone={true} countries={countries}/>)}
               <button type="button" onClick={() => addDynamicListItem('telefones')} className="text-blue-500 hover:text-blue-700 flex items-center gap-2 text-sm"> <FontAwesomeIcon icon={faPlusCircle} /> Adicionar </button>
             </div>
           </div>
           <div>
             <label className="block text-sm font-medium mb-2">Emails</label>
             <div className="space-y-3">
               {formData.emails.map((item, index) => <DynamicInputRow key={item.id || item.tempId} item={item} index={index} onUpdate={(...args) => handleDynamicListUpdate('emails', ...args)} onRemove={(idx) => removeDynamicListItem('emails', idx)} isPhone={false} countries={countries}/>)}
               <button type="button" onClick={() => addDynamicListItem('emails')} className="text-blue-500 hover:text-blue-700 flex items-center gap-2 text-sm"> <FontAwesomeIcon icon={faPlusCircle} /> Adicionar </button>
             </div>
           </div>
        </div>
      </fieldset>
      
      {/* O resto do JSX do formulário permanece igual... */}
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Informações Principais</legend>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2"> <label className="block text-sm font-medium">Nome Completo / Contato Principal *</label> <input name="nome" value={formData.nome || ''} onChange={handleChange} required className="w-full p-2 border rounded-md" /> </div>
          <div> <label className="block text-sm font-medium">Tipo de Contato *</label> <select name="tipo_contato" value={formData.tipo_contato || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"> <option value="">Selecione...</option> <option value="Contato">Contato</option> <option value="Cliente">Cliente</option> <option value="Fornecedor">Fornecedor</option> <option value="Lead">Lead</option> </select> </div>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Dados Pessoais</legend>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><label className="block text-sm font-medium">CPF</label><IMaskInput mask="000.000.000-00" name="cpf" onAccept={(v) => handleMaskedChange('cpf', v)} value={formData.cpf || ''} className="w-full p-2 border rounded-md"/></div>
          <div><label className="block text-sm font-medium">RG</label><input name="rg" value={formData.rg || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium">Data de Nascimento</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium">Estado Civil</label><input name="estado_civil" value={formData.estado_civil || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium">Nacionalidade</label><input name="nacionalidade" value={formData.nacionalidade || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium">Profissão/Cargo</label><input name="cargo" value={formData.cargo || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
        </div>
      </fieldset>
      {formType === 'pj' && (
          <fieldset>
            <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Dados da Empresa</legend>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div> <label className="block text-sm font-medium">CNPJ (digite para preencher)</label> <IMaskInput mask="00.000.000/0000-00" name="cnpj" onAccept={(v) => handleMaskedChange('cnpj', v)} onBlur={(e) => handleCnpjBlur(e.target.value)} value={formData.cnpj || ''} className="w-full p-2 border rounded-md"/> </div>
                <div> <label className="block text-sm font-medium">Razão Social</label> <input name="razao_social" value={formData.razao_social || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /> </div>
                <div> <label className="block text-sm font-medium">Nome Fantasia</label> <input name="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /> </div>
                <div> <label className="block text-sm font-medium">Responsável Legal</label> <input name="responsavel_legal" value={formData.responsavel_legal || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /> </div>
            </div>
          </fieldset>
      )}
      <fieldset>
          <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Endereço</legend>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-6">
            <div className="md:col-span-2"> <label className="block text-sm font-medium">CEP (digite para preencher)</label> <IMaskInput mask="00000-000" name="cep" onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} value={formData.cep || ''} className="w-full p-2 border rounded-md"/> </div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Rua</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-3"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
          </div>
      </fieldset>
      <fieldset>
          <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Dados Bancários e PIX</legend>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="block text-sm font-medium">Método Preferencial</label><input name="payment_method" value={formData.payment_method || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
              <div><label className="block text-sm font-medium">Chave PIX</label><input name="pix_key" value={formData.pix_key || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
              <div className="md:col-span-3"><label className="block text-sm font-medium">Outros Dados Bancários</label><textarea name="bank_details" value={formData.bank_details || ''} onChange={handleChange} rows="2" className="w-full p-2 border rounded-md" /></div>
          </div>
      </fieldset>
      <fieldset>
          <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Observações</legend>
           <div className="mt-6">
              <label className="block text-sm font-medium">Descrição de produtos/serviços ou observações gerais</label>
              <textarea name="observations" value={formData.observations || ''} onChange={handleChange} rows="4" className="w-full p-2 border rounded-md" />
            </div>
      </fieldset>
      <div className="mt-8 flex justify-end gap-4">
        <button type="button" onClick={() => router.push('/contatos')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"> Cancelar </button>
        <button type="submit" disabled={isLoading || isApiLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"> {(isLoading || isApiLoading) && <FontAwesomeIcon icon={faSpinner} spin />} {isEditing ? 'Salvar Alterações' : 'Salvar Contato'} </button>
      </div>
    </form>
  );
}