"use client";

import { useState } from 'react';
// A CORREÇÃO ESTÁ AQUI: O caminho agora é '../utils/supabase/client'
import { createClient } from '../utils/supabase/client';

// O componente agora recebe a lista de empresas como uma "propriedade"
export default function EmpreendimentoForm({ companies }) {
  const supabase = createClient();
  
  const [formData, setFormData] = useState({
    nome: '',
    empresa_proprietaria_id: '', // Campo para o ID da empresa selecionada
    data_inicio: '',
    data_fim_prevista: '',
    valor_total: '',
    status: 'Em Andamento', // Valor padrão
    // Campos de endereço
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('Enviando...');
    
    // Verifica se uma empresa foi selecionada
    if (!formData.empresa_proprietaria_id) {
      setMessage('Erro: Por favor, selecione uma empresa proprietária.');
      return;
    }

    const { error } = await supabase.from('empreendimentos').insert([formData]);

    if (error) {
      setMessage(`Erro ao cadastrar empreendimento: ${error.message}`);
      console.error(error);
    } else {
      setMessage('Empreendimento cadastrado com sucesso!');
      // Limpa o formulário (opcional)
      setFormData({
        nome: '', empresa_proprietaria_id: '', data_inicio: '', data_fim_prevista: '',
        valor_total: '', status: 'Em Andamento', cep: '', address_street: '',
        address_number: '', address_complement: '', neighborhood: '', city: '', state: ''
      });
    }
  };

  return (
    // O design é muito similar ao formulário de empresa
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Cadastro de Novo Empreendimento</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-xl font-semibold text-gray-800">Dados do Empreendimento</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            {/* Campo de Seleção da Empresa */}
            <div className="md:col-span-2">
              <label htmlFor="empresa_proprietaria_id" className="block text-sm font-medium text-gray-700">Empresa Proprietária</label>
              <select
                name="empresa_proprietaria_id"
                id="empresa_proprietaria_id"
                value={formData.empresa_proprietaria_id}
                onChange={handleChange}
                required
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Selecione uma empresa...</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.razao_social}
                  </option>
                ))}
              </select>
            </div>

            {/* Nome do Empreendimento */}
            <div className="md:col-span-2">
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome do Empreendimento</label>
              <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>

            {/* Outros campos... */}
            <div><label htmlFor="data_inicio" className="block text-sm font-medium text-gray-700">Data de Início</label><input type="date" name="data_inicio" id="data_inicio" value={formData.data_inicio} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label htmlFor="data_fim_prevista" className="block text-sm font-medium text-gray-700">Data de Fim Prevista</label><input type="date" name="data_fim_prevista" id="data_fim_prevista" value={formData.data_fim_prevista} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label htmlFor="valor_total" className="block text-sm font-medium text-gray-700">Valor Total</label><input type="text" name="valor_total" id="valor_total" value={formData.valor_total} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label><input type="text" name="status" id="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
          </div>
        </div>
        
        {/* Botões de Ação */}
        <div className="mt-6 flex items-center justify-end gap-x-6">
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Salvar Empreendimento
          </button>
        </div>
        
        {message && <p className="text-center font-medium mt-4">{message}</p>}
      </form>
    </div>
  );
}