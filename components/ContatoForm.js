"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrashAlt, faPlusCircle } from '@fortawesome/free-solid-svg-icons';

const DynamicInputRow = ({ item, index, onUpdate, onRemove, isPhone, countries }) => {
    const handleUpdate = (field, newValue) => onUpdate(index, field, newValue);
    if (isPhone) {
        return (
            <div className="flex items-center gap-2">
                <select value={item.country_code || '+55'} onChange={(e) => handleUpdate('country_code', e.target.value)} className="p-2 border rounded-md bg-gray-50 text-sm max-w-[150px]">
                    {countries.map(c => (<option key={c.code} value={c.dial_code}>{c.name} ({c.dial_code})</option>))}
                </select>
                <IMaskInput mask={[{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }]} placeholder="(DDD) Telefone" value={item.telefone || ''} onAccept={(value) => handleUpdate('telefone', value)} className="flex-grow p-2 border rounded-md" />
                <input type="text" placeholder="Tipo (Ex: Celular)" value={item.tipo || ''} onChange={(e) => handleUpdate('tipo', e.target.value)} className="w-1/3 p-2 border rounded-md" />
                <button type="button" onClick={() => onRemove(index)}><FontAwesomeIcon icon={faTrashAlt} className="text-red-500 hover:text-red-700" /></button>
            </div>
        )
    }
    return (
        <div className="flex items-center gap-2">
            <input type="email" placeholder="endereco@email.com" value={item.email || ''} onChange={(e) => handleUpdate('email', e.target.value)} className="flex-grow p-2 border rounded-md" />
            <input type="text" placeholder="Tipo (Ex: Pessoal)" value={item.tipo || ''} onChange={(e) => handleUpdate('tipo', e.target.value)} className="w-1/3 p-2 border rounded-md" />
            <button type="button" onClick={() => onRemove(index)}><FontAwesomeIcon icon={faTrashAlt} className="text-red-500 hover:text-red-700" /></button>
        </div>
    );
};

const countryList = [ { name: 'Brazil', dial_code: '+55', code: 'BR' }, { name: 'United States', dial_code: '+1', code: 'US' } ];

export default function ContatoForm({ initialData }) {
  const supabase = createClient();
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);
  
  const getInitialState = useCallback((type = 'Pessoa Física') => ({
    personalidade_juridica: type,
    nome: '', tipo_contato: null, status: 'Ativo', razao_social: '', nome_fantasia: '', cnpj: '', responsavel_legal: '', 
    // ***** INÍCIO DA ALTERAÇÃO *****
    pessoa_contato: '', // Adicionado ao estado inicial
    // ***** FIM DA ALTERAÇÃO *****
    cpf: '', rg: '', birth_date: null, data_fundacao: null, tipo_servico_produto: '', cep: '', address_street: '', address_number: '', address_complement: '', neighborhood: '', city: '', state: '', observations: '',
    telefones: [{ tempId: 'phone_0', country_code: '+55', telefone: '', tipo: 'Celular' }],
    emails: [{ tempId: 'email_0', email: '', tipo: 'Pessoal' }],
  }), []);

  const [formData, setFormData] = useState(getInitialState());
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [uniqueKeyCounter, setUniqueKeyCounter] = useState(1);

  useEffect(() => {
    const loadInitialData = async () => {
      if (initialData?.id) {
        setIsLoading(true);
        const { data: telefones } = await supabase.from('telefones').select('*').eq('contato_id', initialData.id);
        const { data: emails } = await supabase.from('emails').select('*').eq('contato_id', initialData.id);
        const fullData = { ...getInitialState(initialData.personalidade_juridica), ...initialData, telefones: telefones?.length ? telefones : getInitialState().telefones, emails: emails?.length ? emails : getInitialState().emails };
        setFormData(fullData);
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [initialData, supabase, getInitialState]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'personalidade_juridica') {
        const currentState = formData;
        const newState = getInitialState(value);
        newState.telefones = currentState.telefones;
        newState.emails = currentState.emails;
        newState.tipo_contato = currentState.tipo_contato;
        newState.cep = currentState.cep;
        newState.address_street = currentState.address_street;
        newState.address_number = currentState.address_number;
        newState.address_complement = currentState.address_complement;
        newState.neighborhood = currentState.neighborhood;
        newState.city = currentState.city;
        newState.state = currentState.state;
        newState.observations = currentState.observations;
        newState.tipo_servico_produto = currentState.tipo_servico_produto;
        setFormData(newState);
    } else {
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
    }
  };

  const handleMaskedChange = (name, value) => setFormData(prevState => ({ ...prevState, [name]: value }));
  const handleDynamicListUpdate = (listName, index, field, value) => setFormData(prev => ({ ...prev, [listName]: formData[listName].map((item, i) => i === index ? { ...item, [field]: value } : item) }));
  const addDynamicListItem = (listName) => {
    const newKey = uniqueKeyCounter; setUniqueKeyCounter(prev => prev + 1);
    const newItem = listName === 'telefones' ? { tempId: `phone_${newKey}`, country_code: '+55', telefone: '', tipo: '' } : { tempId: `email_${newKey}`, email: '', tipo: '' };
    setFormData(prev => ({ ...prev, [listName]: [...prev[listName], newItem] }));
  };
  const removeDynamicListItem = (listName, index) => {
    if (formData[listName].length > 1) { setFormData(prev => ({ ...prev, [listName]: prev[listName].filter((_, i) => i !== index) })); } 
    else { setFormData(prev => ({ ...prev, [listName]: formData[listName].map((item, i) => i === index ? { ...item, telefone: '', email: '', tipo: '' } : item) })); }
  };
  
  const handleCepBlur = async (cep) => {
    const cepLimpo = cep?.replace(/\D/g, ''); if (cepLimpo?.length !== 8) return;
    setIsApiLoading(true); setMessage('Buscando CEP...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`); if (!response.ok) throw new Error('CEP não encontrado');
      const data = await response.json(); if (data.erro) throw new Error('CEP inválido.');
      setFormData(prev => ({ ...prev, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf, cep: cepLimpo }));
      setMessage('Endereço preenchido!');
    } catch (error) { setMessage(error.message); } finally { setIsApiLoading(false); setTimeout(() => setMessage(''), 3000); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); setMessage(isEditing ? 'Atualizando...' : 'Criando...');
    const { id, telefones, emails, ...contatoData } = formData;
    let savedContact;
    if (isEditing) {
      const { data, error } = await supabase.from('contatos').update(contatoData).eq('id', initialData.id).select().single();
      if (error) { setMessage(`Erro: ${error.message}`); setIsLoading(false); return; }
      savedContact = data;
    } else {
      const { data, error } = await supabase.from('contatos').insert(contatoData).select().single();
      if (error) { setMessage(`Erro: ${error.message}`); setIsLoading(false); return; }
      savedContact = data;
    }
    const saveRelatedData = async (list, tableName, field) => {
        const itemsToSave = list.filter(item => item[field] && item[field].trim() !== '').map(({ id, tempId, ...dbItem }) => ({ ...dbItem, contato_id: savedContact.id }));
        if (isEditing) { await supabase.from(tableName).delete().eq('contato_id', savedContact.id); }
        if (itemsToSave.length > 0) { const { error } = await supabase.from(tableName).insert(itemsToSave); if (error) throw new Error(`Erro em ${tableName}: ${error.message}`); }
    };
    try {
      await saveRelatedData(formData.telefones, 'telefones', 'telefone');
      await saveRelatedData(formData.emails, 'emails', 'email');
      setMessage(`Contato ${isEditing ? 'atualizado' : 'criado'}!`);
      setTimeout(() => { router.push('/contatos'); router.refresh(); }, 1500);
    } catch (error) { setMessage(error.message); setIsLoading(false); } 
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {(message || isApiLoading) && ( <div className={`p-3 rounded-md text-center sticky top-2 z-10 ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}> {isApiLoading && <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />} {message} </div> )}
      
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Identificação</legend>
        <div className="mt-6">
            <label className="block text-sm font-medium">Personalidade Jurídica *</label>
            <select name="personalidade_juridica" value={formData.personalidade_juridica} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                <option>Pessoa Física</option>
                <option>Pessoa Jurídica</option>
            </select>
        </div>

        {formData.personalidade_juridica === 'Pessoa Física' ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2"> <label className="block text-sm font-medium">Nome Completo</label> <input name="nome" value={formData.nome || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /> </div>
            <div> <label className="block text-sm font-medium">Tipo de Contato *</label> <select name="tipo_contato" value={formData.tipo_contato || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"> <option value="">Selecione...</option> <option>Contato</option> <option>Cliente</option> <option>Fornecedor</option> <option>Lead</option> </select> </div>
            <div><label className="block text-sm font-medium">CPF</label><IMaskInput mask="000.000.000-00" name="cpf" onAccept={(v) => handleMaskedChange('cpf', v)} value={formData.cpf || ''} className="w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">RG</label><input name="rg" value={formData.rg || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium">Data de Nascimento</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-3"><label className="block text-sm font-medium">Tipo de Serviço/Produto</label><input name="tipo_servico_produto" value={formData.tipo_servico_produto || ''} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="Ex: Material de Construção, Elétrica, Hidráulica..." /></div>
          </div>
        ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div> <label className="block text-sm font-medium">Razão Social</label> <input name="razao_social" value={formData.razao_social || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /> </div>
                <div> <label className="block text-sm font-medium">Nome Fantasia</label> <input name="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /> </div>
                <div> <label className="block text-sm font-medium">CNPJ</label> <IMaskInput mask="00.000.000/0000-00" name="cnpj" onAccept={(v) => handleMaskedChange('cnpj', v)} value={formData.cnpj || ''} className="w-full p-2 border rounded-md"/> </div>
                <div> <label className="block text-sm font-medium">Tipo de Contato *</label> <select name="tipo_contato" value={formData.tipo_contato || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"> <option value="">Selecione...</option> <option>Contato</option> <option>Cliente</option> <option>Fornecedor</option> <option>Lead</option> </select> </div>
                <div><label className="block text-sm font-medium">Data de Fundação</label><input type="date" name="data_fundacao" value={formData.data_fundacao || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                {/* ***** INÍCIO DA ALTERAÇÃO ***** */}
                <div><label className="block text-sm font-medium">Pessoa de Contato</label><input name="pessoa_contato" value={formData.pessoa_contato || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium">Tipo de Serviço/Produto</label><input name="tipo_servico_produto" value={formData.tipo_servico_produto || ''} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="Ex: Material de Construção, Elétrica, Hidráulica..." /></div>
                {/* ***** FIM DA ALTERAÇÃO ***** */}
            </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Informações de Contato</legend>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-10">
           <div><label className="block text-sm font-medium mb-2">Telefones</label><div className="space-y-3">{formData.telefones.map((item, index) => <DynamicInputRow key={item.id || item.tempId} item={item} index={index} onUpdate={(...args) => handleDynamicListUpdate('telefones', ...args)} onRemove={(idx) => removeDynamicListItem('telefones', idx)} isPhone={true} countries={countryList}/>)}<button type="button" onClick={() => addDynamicListItem('telefones')} className="text-blue-500 hover:text-blue-700 flex items-center gap-2 text-sm"> <FontAwesomeIcon icon={faPlusCircle} /> Adicionar </button></div></div>
           <div><label className="block text-sm font-medium mb-2">Emails</label><div className="space-y-3">{formData.emails.map((item, index) => <DynamicInputRow key={item.id || item.tempId} item={item} index={index} onUpdate={(...args) => handleDynamicListUpdate('emails', ...args)} onRemove={(idx) => removeDynamicListItem('emails', idx)} isPhone={false} countries={countryList}/>)}<button type="button" onClick={() => addDynamicListItem('emails')} className="text-blue-500 hover:text-blue-700 flex items-center gap-2 text-sm"> <FontAwesomeIcon icon={faPlusCircle} /> Adicionar </button></div></div>
        </div>
      </fieldset>
      
      <fieldset>
          <legend className="text-xl font-semibold text-gray-800 border-b pb-2">Endereço</legend>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-6">
            <div className="md:col-span-2"> <label className="block text-sm font-medium">CEP</label> <IMaskInput mask="00000-000" name="cep" onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} value={formData.cep || ''} className="w-full p-2 border rounded-md"/> </div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Rua</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-3"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
          </div>
      </fieldset>

      <div className="mt-8 flex justify-end gap-4">
        <button type="button" onClick={() => router.push('/contatos')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"> Cancelar </button>
        <button type="submit" disabled={isLoading || isApiLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"> {(isLoading || isApiLoading) && <FontAwesomeIcon icon={faSpinner} spin />} {isEditing ? 'Salvar Alterações' : 'Salvar Contato'} </button>
      </div>
    </form>
  );
}