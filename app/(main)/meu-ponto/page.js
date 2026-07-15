"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCalendarCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import FolhaPonto from '@/components/rh/FolhaPonto';

export default function MeuPontoPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedMonthForPonto, setSelectedMonthForPonto] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
      </div>
    );
  }

  const funcionarioId = user?.funcionario_id;

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-[1920px] mx-auto animate-fadeIn pb-12">
      {/* CABEÇALHO UNIFICADO "PADRÃO OURO" */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 no-print">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">Minha Folha de Ponto</h2>
          </div>
          <p className="text-gray-500 font-medium">Consulte, realize batidas diárias e faça a assinatura eletrônica do seu ponto.</p>
        </div>
        
        {funcionarioId && (
          <div className="flex items-center gap-3 shrink-0">
            <label className="text-sm font-semibold text-gray-600">Período:</label>
            <input 
              type="month" 
              value={selectedMonthForPonto} 
              onChange={(e) => setSelectedMonthForPonto(e.target.value)} 
              className="border border-gray-300 p-2 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-blue-700 cursor-pointer shadow-inner" 
            />
          </div>
        )}
      </div>

      {funcionarioId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-hidden">
          <FolhaPonto employeeId={funcionarioId} month={selectedMonthForPonto} canEdit={true} showKpis={true} />
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 w-full shadow-sm max-w-2xl mx-auto mt-8 no-print">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex mx-auto items-center justify-center mb-4 text-amber-500 border border-amber-100">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Funcionário Não Vinculado</h3>
          <p className="text-xs font-medium text-gray-500 max-w-sm mx-auto mb-4">
            Seu usuário do sistema ainda não possui um cadastro de funcionário associado no Departamento Pessoal. 
            Por favor, entre em contato com o seu gestor de RH para regularizar a sua vinculação.
          </p>
        </div>
      )}
    </div>
  );
}
