"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext';

export default function FuncionarioForm({ companies, empreendimentos }) {
  const supabase = createClient();
  const router = useRouter();
  const { canViewSalaries } = useAuth();

  // Estado inicial completo para o novo funcionário
  const getInitialState = () => ({
    empresa_id: '',
    empreendimento_atual_id: '',
    full_name: '',
    cpf: '',
    rg: '',
    birth_date: '',
    phone: '',
    email: '',
    estado_civil: '',
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    contract_role: '',
    admission_date: '',
    base_salary: '',
    total_salary: '',
    daily_value: '',
    payment_method: '',
    pix_key: '',
    bank_details: '',
    observations: ''
  });

  const [formData, setFormData] = useState(getInitialState());
  const [message, setMessage] = useState('');

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
        state: data.uf
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
    setMessage('Cadastrando...');

    const { error } = await supabase.from('funcionarios').insert([formData]);

    if (error) {
      setMessage(`Erro ao cadastrar funcionário: ${error.message}`);
      console.error(error);
    } else {
      setMessage('Funcionário cadastrado com sucesso!');
      setFormData(getInitialState()); // Limpa o formulário usando a função
      setTimeout(() => {
        router.push('/funcionarios'); // Redireciona para a lista
      }, 1500);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Cadastro de Novo Funcionário</h1>
      
      {message && <p className={`text-center font-medium mb-4 p-2 rounded-md ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Seção de Dados da Empresa */}
        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Dados da Empresa</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="empresa_id" className="block text-sm font-medium">Empresa Contratante *</label>
                    <select name="empresa_id" id="empresa_id" value={formData.empresa_id} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                        <option value="">Selecione...</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="empreendimento_atual_id" className="block text-sm font-medium">Empreendimento Atual</label>
                    <select name="empreendimento_atual_id" id="empreendimento_atual_id" value={formData.empreendimento_atual_id} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                        <option value="">Nenhum</option>
                        {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                </div>
            </div>
        </fieldset>

        {/* Seção de Dados Pessoais */}
        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Dados Pessoais</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium">Nome Completo *</label>
                    <input name="full_name" required onChange={handleChange} value={formData.full_name} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">CPF *</label>
                    <IMaskInput mask="000.000.000-00" name="cpf" required onAccept={(v) => handleMaskedChange('cpf', v)} value={formData.cpf} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">RG</label>
                    <input name="rg" onChange={handleChange} value={formData.rg} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Data de Nascimento</label>
                    <input type="date" name="birth_date" onChange={handleChange} value={formData.birth_date} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Telefone</label>
                    <IMaskInput mask="(00) 00000-0000" name="phone" onAccept={(v) => handleMaskedChange('phone', v)} value={formData.phone} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium">Email</label>
                    <input type="email" name="email" onChange={handleChange} value={formData.email} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Estado Civil</label>
                    <input name="estado_civil" onChange={handleChange} value={formData.estado_civil} className="mt-1 w-full p-2 border rounded-md" />
                </div>
            </div>
        </fieldset>

         {/* Seção de Endereço */}
        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Endereço</h2>
             <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium">CEP</label>
                    <IMaskInput mask="00000-000" name="cep" value={formData.cep} onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                <div className="md:col-span-4">
                    <label className="block text-sm font-medium">Logradouro</label>
                    <input name="address_street" value={formData.address_street} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium">Número</label>
                    <input name="address_number" value={formData.address_number} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Complemento</label>
                    <input name="address_complement" value={formData.address_complement} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div className="md:col-span-3">
                    <label className="block text-sm font-medium">Bairro</label>
                    <input name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div className="md:col-span-4">
                    <label className="block text-sm font-medium">Cidade</label>
                    <input name="city" value={formData.city} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Estado (UF)</label>
                    <input name="state" value={formData.state} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                </div>
            </div>
        </fieldset>
        
        {/* Seção de Dados Contratuais */}
        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados Contratuais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium">Cargo *</label>
                <input name="contract_role" required onChange={handleChange} value={formData.contract_role} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium">Data de Admissão *</label>
                <input type="date" name="admission_date" required onChange={handleChange} value={formData.admission_date} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            
            {canViewSalaries && (
              <>
                <div>
                    <label className="block text-sm font-medium">Salário Base</label>
                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="base_salary" onAccept={(v) => handleMaskedChange('base_salary', v)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium">Salário Total</label>
                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="total_salary" onAccept={(v) => handleMaskedChange('total_salary', v)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium">Valor Diária</label>
                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="daily_value" onAccept={(v) => handleMaskedChange('daily_value', v)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
              </>
            )}
          </div>
        </fieldset>

        {/* Seção de Dados de Pagamento */}
        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Dados de Pagamento</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium">Método de Pagamento</label>
                    <input name="payment_method" onChange={handleChange} value={formData.payment_method} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Chave PIX</label>
                    <input name="pix_key" onChange={handleChange} value={formData.pix_key} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Dados Bancários</label>
                    <input name="bank_details" onChange={handleChange} value={formData.bank_details} className="mt-1 w-full p-2 border rounded-md" />
                </div>
            </div>
        </fieldset>

        {/* Outras Informações */}
        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Outras Informações</h2>
            <div className="mt-6">
                <label htmlFor="observations" className="block text-sm font-medium text-gray-700">Observações</label>
                <textarea name="observations" id="observations" value={formData.observations} onChange={handleChange} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
            </div>
        </fieldset>
        
        <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-600 font-semibold">
                Cadastrar Funcionário
            </button>
        </div>
      </form>
    </div>
  );
}