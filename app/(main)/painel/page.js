// app/(main)/painel/page.js
"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartLine, faArrowRight } from '@fortawesome/free-solid-svg-icons';

// --- IMPORTAÇÃO DOS WIDGETS ---
const WelcomeCard = React.lazy(() => import('@/components/painel/widgets/WelcomeCard'));
const QuickActionsWidget = React.lazy(() => import('@/components/painel/widgets/QuickActionsWidget'));
const MinhasAtividadesWidget = React.lazy(() => import('@/components/painel/widgets/MinhasAtividadesWidget'));
const ChatMuralWidget = React.lazy(() => import('@/components/painel/widgets/ChatMuralWidget'));
const MeuRhWidget = React.lazy(() => import('@/components/painel/widgets/MeuRhWidget'));
const NotificacoesWidget = React.lazy(() => import('@/components/painel/widgets/NotificacoesWidget'));


const WidgetSkeleton = () => (
  <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-48 flex justify-center items-center">
    <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
  </div>
);

export default function Painel() {
  const { user, isLoading: authLoading } = useAuth();

  const isProprietario = 
    user?.funcao_id === 1 ||             
    user?.funcao_id === 9 ||             
    user?.funcao === 'Proprietário' ||   
    user?.nome_funcao === 'Proprietário' || 
    user?.role === 'Proprietário';       



  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 space-y-6">


      {/* Cartão de Boas Vindas */}
      <Suspense fallback={<WidgetSkeleton />}>
        {user && <WelcomeCard user={user} />}
      </Suspense>



      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- COLUNA ESQUERDA (PRINCIPAL) --- */}
        <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="w-full">
            <Suspense fallback={<WidgetSkeleton />}>
              {user?.funcionario_id && (
                <MinhasAtividadesWidget funcionario_id={user.funcionario_id} />
              )}
            </Suspense>
          </div>

          <div className="w-full h-full">
            <Suspense fallback={<WidgetSkeleton />}>
               <ChatMuralWidget />
            </Suspense>
          </div>
        </div>

        {/* --- COLUNA DIREITA (LATERAL) --- */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          



          {/* Notificações */}
          <Suspense fallback={<WidgetSkeleton />}>
             {user?.id && <NotificacoesWidget userId={user.id} />}
          </Suspense>
          
          {/* Ações Rápidas */}
          <Suspense fallback={<WidgetSkeleton />}>
            <QuickActionsWidget />
          </Suspense>

          {/* Widget RH */}
          <Suspense fallback={<WidgetSkeleton />}>
            {user?.funcionario_id && (
              <MeuRhWidget funcionario_id={user.funcionario_id} />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}