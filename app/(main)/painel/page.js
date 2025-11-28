// app/(main)/painel/page.js
// CÓDIGO ATUALIZADO - Notificações no Topo da Lateral
"use client";

import React, { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// --- IMPORTAÇÃO DOS WIDGETS ---
const WelcomeCard = React.lazy(() => import('@/components/painel/widgets/WelcomeCard'));
const QuickActionsWidget = React.lazy(() => import('@/components/painel/widgets/QuickActionsWidget'));
const MinhasAtividadesWidget = React.lazy(() => import('@/components/painel/widgets/MinhasAtividadesWidget'));
const MeuRhWidget = React.lazy(() => import('@/components/painel/widgets/MeuRhWidget'));
const NotificacoesWidget = React.lazy(() => import('@/components/painel/widgets/NotificacoesWidget'));

const WidgetSkeleton = () => (
  <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-48 flex justify-center items-center">
    <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
  </div>
);

export default function Painel() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">

      {/* Cartão de Boas Vindas */}
      <Suspense fallback={<WidgetSkeleton />}>
        {user && <WelcomeCard user={user} />}
      </Suspense>

      {/* GRID PRINCIPAL DO PAINEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- COLUNA ESQUERDA (PRINCIPAL / 2 COLUNAS) --- */}
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<WidgetSkeleton />}>
            {/* Renderiza "Minhas Atividades" apenas se o usuário for um funcionário */}
            {user?.funcionario_id && (
              <MinhasAtividadesWidget funcionario_id={user.funcionario_id} />
            )}
          </Suspense>
        </div>

        {/* --- COLUNA DIREITA (LATERAL / 1 COLUNA) --- */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          
          {/* 1. TOPO: Widget de Notificações (Avisos Importantes primeiro) */}
          <Suspense fallback={<WidgetSkeleton />}>
             {user?.id && <NotificacoesWidget userId={user.id} />}
          </Suspense>
          
          {/* 2. MEIO: Ações Rápidas */}
          <Suspense fallback={<WidgetSkeleton />}>
            <QuickActionsWidget />
          </Suspense>

          {/* 3. BASE: Widget RH */}
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