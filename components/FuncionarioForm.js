"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext'; // Importa o hook

export default function FuncionarioForm({ companies, empreendimentos }) {
  const supabase = createClient();
  // Pega a nova permissão da nossa central
  const { canViewSalaries } = useAuth();
  
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState('');
  
  const handleSubmit = async (event) => { /* ... */ };
  const handleChange = (e) => { /* ... */ };
  const handleMaskedChange = (name, value) => { /* ... */ };
  const handleFileChange = (e) => { /* ... */ };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Cadastro de Novo Funcionário</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ... (outras seções do formulário) ... */}

        {/* Dados Contratuais */}
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados Contratuais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2"><label className="block text-sm font-medium">Cargo</label><input name="contract_role" required className="mt-1 w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium">Data de Admissão</label><input type="date" name="admission_date" required className="mt-1 w-full p-2 border rounded-md" /></div>
            
            {/* CONDIÇÃO ATUALIZADA AQUI */}
            {canViewSalaries && (
              <>
                <div><label className="block text-sm font-medium">Salário Base</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="base_salary" className="mt-1 w-full p-2 border rounded-md"/></div>
                <div><label className="block text-sm font-medium">Salário Total</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="total_salary" className="mt-1 w-full p-2 border rounded-md"/></div>
                <div><label className="block text-sm font-medium">Valor Diária</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="daily_value" className="mt-1 w-full p-2 border rounded-md"/></div>
              </>
            )}
          </div>
        </div>
        
        {/* ... (o resto do formulário) ... */}
      </form>
    </div>
  );
}