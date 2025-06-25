"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext'; // Importa o hook

export default function FuncionarioForm({ companies, empreendimentos }) {
  const supabase = createClient();
  const { canViewSalaries } = useAuth(); // Pega a permissão do nosso contexto central
  
  const [formData, setFormData] = useState({
      empresa_id: '',
      empreendimento_atual_id: '',
      full_name: '',
      cpf: '',
      contract_role: '',
      admission_date: '',
      // Adicione outros campos conforme necessário
  });
  const [message, setMessage] = useState('');
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
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
        // Limpa o formulário
        setFormData({
            empresa_id: '',
            empreendimento_atual_id: '',
            full_name: '',
            cpf: '',
            contract_role: '',
            admission_date: '',
        });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Cadastro de Novo Funcionário</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Seção de Dados Pessoais */}
        <div className="border-b border-gray-900/10 pb-8">
            <h2 className="text-xl font-semibold text-gray-800">Dados Pessoais</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium">Nome Completo</label>
                    <input name="full_name" required onChange={handleChange} value={formData.full_name} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">CPF</label>
                    <IMaskInput mask="000.000.000-00" name="cpf" required onAccept={(value) => handleMaskedChange('cpf', value)} value={formData.cpf} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
            </div>
        </div>
        
        {/* Seção de Dados Contratuais */}
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados Contratuais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium">Cargo</label>
                <input name="contract_role" required onChange={handleChange} value={formData.contract_role} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium">Data de Admissão</label>
                <input type="date" name="admission_date" required onChange={handleChange} value={formData.admission_date} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            
            {/* Os campos de salário só aparecem se o usuário tiver permissão */}
            {canViewSalaries && (
              <>
                <div>
                    <label className="block text-sm font-medium">Salário Base</label>
                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="base_salary" onAccept={(value) => handleMaskedChange('base_salary', value)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium">Salário Total</label>
                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="total_salary" onAccept={(value) => handleMaskedChange('total_salary', value)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium">Valor Diária</label>
                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="daily_value" onAccept={(value) => handleMaskedChange('daily_value', value)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
                Cadastrar Funcionário
            </button>
        </div>
        
        {message && <p className="text-center font-medium mt-4">{message}</p>}
      </form>
    </div>
  );
}