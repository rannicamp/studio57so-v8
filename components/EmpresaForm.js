"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';

export default function EmpresaForm({ initialData }) {
  const supabase = createClient();
  const router = useRouter();
  const isEditing = Boolean(initialData);

  const getInitialState = () => ({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    telefone: '',
    email: '',
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    responsavel_legal: '',
  });

  const [formData, setFormData] = useState(initialData || getInitialState());
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleCepBlur = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setMessage('Buscando CEP...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (!response.ok) throw new Error('CEP não encontrado');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado');

      setFormData(prev => ({
        ...prev,
        address_street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
      }));
      setMessage('Endereço preenchido!');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(isEditing ? 'Atualizando...' : 'Cadastrando...');

    const { id, ...dbData } = formData;

    let error;
    if (isEditing) {
      const { error: updateError } = await supabase.from('cadastro_empresa').update(dbData).eq('id', id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('cadastro_empresa').insert([dbData]);
      error = insertError;
    }

    if (error) {
      setMessage(`Erro: ${error.message}`);
    } else {
      setMessage(`Empresa ${isEditing ? 'atualizada' : 'cadastrada'} com sucesso!`);
      setTimeout(() => {
        router.push('/empresas');
        router.refresh();
      }, 1500);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">
        {isEditing ? `Editando Empresa: ${initialData.razao_social}` : 'Cadastro de Nova Empresa'}
      </h1>

      {message && <p className={`text-center font-medium mb-4 p-2 rounded-md ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados da Empresa</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium">Razão Social *</label>
              <input name="razao_social" required onChange={handleChange} value={formData.razao_social || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium">Nome Fantasia</label>
              <input name="nome_fantasia" onChange={handleChange} value={formData.nome_fantasia || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium">CNPJ *</label>
              <IMaskInput mask="00.000.000/0000-00" name="cnpj" required onAccept={(v) => handleMaskedChange('cnpj', v)} value={formData.cnpj || ''} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div>
              <label className="block text-sm font-medium">Inscrição Estadual</label>
              <input name="inscricao_estadual" onChange={handleChange} value={formData.inscricao_estadual || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium">Inscrição Municipal</label>
              <input name="inscricao_municipal" onChange={handleChange} value={formData.inscricao_municipal || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Contato</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium">Telefone</label>
                <IMaskInput mask="(00) 00000-0000" name="telefone" onAccept={(v) => handleMaskedChange('telefone', v)} value={formData.telefone || ''} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div>
                <label className="block text-sm font-medium">Email</label>
                <input type="email" name="email" onChange={handleChange} value={formData.email || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium">Responsável Legal</label>
                <input name="responsavel_legal" onChange={handleChange} value={formData.responsavel_legal || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Endereço</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-6">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium">CEP</label>
                <IMaskInput mask="00000-000" name="cep" value={formData.cep || ''} onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Logradouro</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-3"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
          </div>
        </fieldset>

        <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="button" onClick={() => router.push('/empresas')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 font-semibold">{isEditing ? 'Salvar Alterações' : 'Salvar Empresa'}</button>
        </div>
      </form>
    </div>
  );
}