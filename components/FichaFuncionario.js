"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext'; // Importa o hook

const InfoField = ({ label, value }) => ( /* ... */ );

export default function FichaFuncionario({ initialEmployee, companies, empreendimentos }) {
  const supabase = createClient();
  const router = useRouter();
  // Pega a nova permissão da nossa central
  const { canViewSalaries } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [employee, setEmployee] = useState(initialEmployee);
  // ... (o resto do seu código de states e handlers)
  
  const handleSaveChanges = async () => { /* ... */ };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-8">
      {/* ... (cabeçalho da ficha) ... */}
      
      {isEditing ? (
        // --- MODO DE EDIÇÃO ---
        <div className="space-y-8">
          {/* ... (outras seções de edição) ... */}
          <div>
            <h3 className="text-lg font-semibold">Dados Contratuais</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ... */}
                {/* CONDIÇÃO ATUALIZADA AQUI */}
                {canViewSalaries && (
                  <>
                    <div><label className="block text-sm font-medium">Salário Base</label><IMaskInput mask="R$ num" name="base_salary" value={String(employee.base_salary || '')} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div><label className="block text-sm font-medium">Salário Total</label><IMaskInput mask="R$ num" name="total_salary" value={String(employee.total_salary || '')} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div><label className="block text-sm font-medium">Valor Diária</label><IMaskInput mask="R$ num" name="daily_value" value={String(employee.daily_value || '')} className="mt-1 w-full p-2 border rounded-md"/></div>
                  </>
                )}
            </div>
          </div>
          {/* ... */}
        </div>
      ) : (
      // --- MODO DE VISUALIZAÇÃO ---
        <div className="space-y-8">
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-8">
                {/* ... (outros campos de InfoField) ... */}
                
                {/* CONDIÇÃO ATUALIZADA AQUI */}
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
      {/* ... (seção de documentos) ... */}
    </div>
  );
}