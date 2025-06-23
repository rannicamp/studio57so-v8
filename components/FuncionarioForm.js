"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';

export default function FuncionarioForm({ companies, empreendimentos }) {
  const supabase = createClient();
  
  // Estado inicial com TODOS os campos da tabela 'funcionarios'
  const [formData, setFormData] = useState({
    empresa_id: '',
    empreendimento_atual_id: null,
    full_name: '',
    cpf: '',
    rg: '',
    birth_date: '',
    phone: '',
    email: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    cep: '',
    city: '',
    state: '',
    neighborhood: '',
    contract_role: '',
    admission_date: '',
    base_salary: '',
    total_salary: '',
    daily_value: '',
    payment_method: '',
    pix_key: '',
    bank_details: '',
    observations: ''
    // Os campos de documento (aso_doc, etc.) seriam tratados separadamente em um upload
  });
  
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Garante que campos opcionais vazios sejam enviados como null para o banco
    const finalValue = value === '' ? null : value;
    setFormData(prevState => ({ ...prevState, [name]: finalValue }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('Enviando...');
    
    if (!formData.empresa_id) {
      setMessage('Erro: Por favor, selecione uma empresa.');
      return;
    }

    const { error } = await supabase.from('funcionarios').insert([formData]);

    if (error) {
      setMessage(`Erro ao cadastrar funcionário: ${error.message}`);
      console.error(error);
    } else {
      setMessage('Funcionário cadastrado com sucesso!');
      // Limpa o formulário
      setFormData({
        empresa_id: '', empreendimento_atual_id: null, full_name: '', cpf: '', rg: '',
        birth_date: '', phone: '', email: '', address_street: '', address_number: '',
        address_complement: '', cep: '', city: '', state: '', neighborhood: '',
        contract_role: '', admission_date: '', base_salary: '', total_salary: '',
        daily_value: '', payment_method: '', pix_key: '', bank_details: '', observations: ''
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Cadastro de Novo Funcionário</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Seção de Vínculos */}
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Vínculos Profissionais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div>
              <label htmlFor="empresa_id" className="block text-sm font-medium text-gray-700">Empresa Contratante</label>
              <select name="empresa_id" id="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Selecione uma empresa...</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>{company.razao_social}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="empreendimento_atual_id" className="block text-sm font-medium text-gray-700">Empreendimento Atual (Opcional)</label>
              <select name="empreendimento_atual_id" id="empreendimento_atual_id" value={formData.empreendimento_atual_id || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Nenhum</option>
                {empreendimentos?.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Seção de Dados Pessoais */}
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Dados Pessoais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <div className="md:col-span-3"><label htmlFor="full_name" className="block text-sm font-medium text-gray-700">Nome Completo</label><input id="full_name" type="text" name="full_name" value={formData.full_name} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="cpf" className="block text-sm font-medium text-gray-700">CPF</label><input id="cpf" type="text" name="cpf" value={formData.cpf} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="rg" className="block text-sm font-medium text-gray-700">RG</label><input id="rg" type="text" name="rg" value={formData.rg} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">Data de Nascimento</label><input id="birth_date" type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefone</label><input id="phone" type="text" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div className="md:col-span-2"><label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label><input id="email" type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
          </div>
        </div>
        
        {/* Seção de Dados Contratuais */}
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Dados Contratuais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <div className="md:col-span-2"><label htmlFor="contract_role" className="block text-sm font-medium text-gray-700">Cargo</label><input id="contract_role" type="text" name="contract_role" value={formData.contract_role} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="admission_date" className="block text-sm font-medium text-gray-700">Data de Admissão</label><input id="admission_date" type="date" name="admission_date" value={formData.admission_date} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="base_salary" className="block text-sm font-medium text-gray-700">Salário Base</label><input id="base_salary" type="text" name="base_salary" value={formData.base_salary} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="total_salary" className="block text-sm font-medium text-gray-700">Salário Total</label><input id="total_salary" type="text" name="total_salary" value={formData.total_salary} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="daily_value" className="block text-sm font-medium text-gray-700">Valor Diária</label><input id="daily_value" type="text" name="daily_value" value={formData.daily_value} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
          </div>
        </div>
        
        {/* Seção de Pagamento */}
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Dados de Pagamento</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div><label htmlFor="payment_method" className="block text-sm font-medium text-gray-700">Método de Pagamento</label><input id="payment_method" type="text" name="payment_method" value={formData.payment_method} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div><label htmlFor="pix_key" className="block text-sm font-medium text-gray-700">Chave PIX</label><input id="pix_key" type="text" name="pix_key" value={formData.pix_key} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
            <div className="md:col-span-2"><label htmlFor="bank_details" className="block text-sm font-medium text-gray-700">Dados Bancários</label><textarea id="bank_details" name="bank_details" value={formData.bank_details} onChange={handleChange} rows="3" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea></div>
          </div>
        </div>

        {/* Observações */}
        <div>
            <label htmlFor="observations" className="block text-sm font-medium text-gray-700">Observações</label>
            <textarea id="observations" name="observations" value={formData.observations} onChange={handleChange} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
        </div>
        
        {/* Botões de Ação */}
        <div className="mt-6 flex items-center justify-end gap-x-6">
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Salvar Funcionário
          </button>
        </div>
        
        {message && <p className="text-center font-medium mt-4">{message}</p>}
      </form>
    </div>
  );
}