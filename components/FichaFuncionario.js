"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext'; // Importa o hook

// Componente corrigido para exibir um campo de informação
const InfoField = ({ label, value }) => (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

export default function FichaFuncionario({ initialEmployee, companies, empreendimentos }) {
  const supabase = createClient();
  const router = useRouter();
  // Pega a nova permissão do nosso contexto central
  const { canViewSalaries } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [employee, setEmployee] = useState(initialEmployee);
  const [formData, setFormData] = useState(initialEmployee || {});
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSaveChanges = async () => {
    setMessage('Salvando...');
    const { data, error } = await supabase
      .from('funcionarios')
      .update(formData)
      .eq('id', employee.id)
      .select()
      .single();
    
    if (error) {
      setMessage(`Erro ao salvar: ${error.message}`);
    } else {
      setMessage('Funcionário atualizado com sucesso!');
      setEmployee(data); // Atualiza os dados na tela
      setIsEditing(false); // Sai do modo de edição
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Ficha do Funcionário</h2>
        <button
            onClick={() => isEditing ? handleSaveChanges() : setIsEditing(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
            {isEditing ? 'Salvar Alterações' : 'Editar Ficha'}
        </button>
        {isEditing && (
            <button onClick={() => setIsEditing(false)} className="text-sm text-gray-600 hover:text-gray-900 ml-4">
                Cancelar
            </button>
        )}
      </div>
      
      {isEditing ? (
        // --- MODO DE EDIÇÃO ---
        <div className="space-y-8">
            {/* Seus campos de formulário de edição aqui, usando formData e handleChange */}
            <p className="text-center text-blue-500">Modo de Edição Ativado</p>
        </div>
      ) : (
      // --- MODO DE VISUALIZAÇÃO ---
        <div className="space-y-8">
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-8">
                <InfoField label="Nome Completo" value={employee.full_name} />
                <InfoField label="CPF" value={employee.cpf} />
                <InfoField label="Cargo" value={employee.contract_role} />
                
                {/* Lógica de permissão para ver salários */}
                {canViewSalaries && (
                    <>
                      <InfoField label="Salário Base" value={employee.base_salary} />
                      <InfoField label="Salário Total" value={employee.total_salary} />
                      <InfoField label="Valor Diária" value={employee.daily_value} />
                    </>
                )}
            </dl>
        </div>
      )}
      
      {message && <p className="text-center font-medium mt-4">{message}</p>}
    </div>
  );
}