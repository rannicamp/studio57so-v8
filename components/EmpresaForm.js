"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../utils/supabase/client';
import { IMaskInput } from 'react-imask';
import { useRouter } from 'next/navigation';

export default function EmpresaForm({ initialData }) {
  const supabase = createClient();
  const router = useRouter();
  
  // Define um estado inicial limpo
  const initialState = {
    cnpj: '', razao_social: '', nome_fantasia: '', inscricao_estadual: '',
    inscricao_municipal: '', address_street: '', address_number: '', address_complement: '',
    cep: '', city: '', state: '', neighborhood: '', telefone: '', email: '', responsavel_legal: ''
  };

  const [formData, setFormData] = useState(initialData || initialState);
  const [message, setMessage] = useState('');
  const isEditing = Boolean(initialData);

  // Efeito para carregar os dados quando o modo de edição é ativado
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

  const handleCnpjBlur = async (e) => {
    if (isEditing) return; // Não busca CNPJ no modo de edição para não sobrescrever dados
    const cnpj = e.target.value.replace(/\D/g, '');
    if (cnpj.length !== 14) return;
    setMessage('Buscando dados do CNPJ...');
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error('CNPJ não encontrado ou inválido.');
      const data = await response.json();
      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        address_street: data.logradouro || '',
        address_number: data.numero || '',
        address_complement: data.complemento || '',
        neighborhood: data.bairro || '',
        cep: data.cep || '',
        city: data.municipio || '',
        state: data.uf || '',
        telefone: data.ddd_telefone_1 || '',
        email: data.email || ''
      }));
      setMessage('Dados preenchidos!');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('Salvando...');
    
    // CORREÇÃO: Separa os dados que não devem ser enviados no update
    const { id, created_at, ...updateData } = formData;
    
    let error;

    if (isEditing) {
      const { error: updateError } = await supabase
        .from('cadastro_empresa')
        .update(updateData) // Envia apenas os dados corretos
        .eq('id', id); // Usa o 'id' que foi separado
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('cadastro_empresa')
        .insert([formData]);
      error = insertError;
    }

    if (error) {
      setMessage(`Erro ao salvar: ${error.message}`);
      console.error(error);
    } else {
      setMessage(`Empresa ${isEditing ? 'atualizada' : 'cadastrada'} com sucesso!`);
      setTimeout(() => router.push('/empresas'), 1000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Dados Principais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <div className="md:col-span-1">
              <label htmlFor="cnpj" className="block text-sm font-medium">CNPJ</label>
              <IMaskInput
                mask="00.000.000/0000-00" id="cnpj" name="cnpj"
                value={formData.cnpj || ''} onAccept={(v) => handleMaskedChange('cnpj', v)} onBlur={handleCnpjBlur} required
                className="mt-1 block w-full p-2 border rounded-md shadow-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="razao_social" className="block text-sm font-medium">Razão Social</label>
              <input id="razao_social" name="razao_social" value={formData.razao_social || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border rounded-md shadow-sm" />
            </div>
            <div><label htmlFor="nome_fantasia" className="block text-sm font-medium">Nome Fantasia</label><input id="nome_fantasia" name="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div><label htmlFor="inscricao_estadual" className="block text-sm font-medium">Inscrição Estadual</label><input id="inscricao_estadual" name="inscricao_estadual" value={formData.inscricao_estadual || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div><label htmlFor="inscricao_municipal" className="block text-sm font-medium">Inscrição Municipal</label><input id="inscricao_municipal" name="inscricao_municipal" value={formData.inscricao_municipal || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
          </div>
        </div>
        
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Endereço</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6">
            <div className="md:col-span-2"><label htmlFor="cep" className="block text-sm font-medium">CEP</label><input id="cep" name="cep" value={formData.cep || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div className="md:col-span-4"><label htmlFor="address_street" className="block text-sm font-medium">Logradouro</label><input id="address_street" name="address_street" value={formData.address_street || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div className="md:col-span-1"><label htmlFor="address_number" className="block text-sm font-medium">Número</label><input id="address_number" name="address_number" value={formData.address_number || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div className="md:col-span-2"><label htmlFor="address_complement" className="block text-sm font-medium">Complemento</label><input id="address_complement" name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div className="md:col-span-3"><label htmlFor="neighborhood" className="block text-sm font-medium">Bairro</label><input id="neighborhood" name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div className="md:col-span-4"><label htmlFor="city" className="block text-sm font-medium">Cidade</label><input id="city" name="city" value={formData.city || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
            <div className="md:col-span-2"><label htmlFor="state" className="block text-sm font-medium">Estado (UF)</label><input id="state" name="state" value={formData.state || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
          </div>
        </div>
        
        <div className="pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Contato e Responsável</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
              <div><label htmlFor="telefone" className="block text-sm font-medium">Telefone</label><input id="telefone" name="telefone" value={formData.telefone || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
              <div><label htmlFor="email" className="block text-sm font-medium">Email</label><input id="email" type="email" name="email" value={formData.email || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
              <div><label htmlFor="responsavel_legal" className="block text-sm font-medium">Responsável Legal</label><input id="responsavel_legal" name="responsavel_legal" value={formData.responsavel_legal || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md shadow-sm" /></div>
          </div>
        </div>
        
        <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="button" onClick={() => router.push('/empresas')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 font-semibold">{isEditing ? 'Salvar Alterações' : 'Salvar Empresa'}</button>
        </div>
        {message && <p className="text-center font-medium mt-4">{message}</p>}
    </form>
  );
}