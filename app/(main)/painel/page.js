// app/(main)/painel/page.js
// CÓDIGO CORRIGIDO - MeuRhWidget ATIVADO
// Widgets Financeiro, Comercial e KPIs Personalizados Ocultos

"use client";

import React, { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Importação dinâmica dos Widgets restantes
const WelcomeCard = React.lazy(() => import('@/components/painel/widgets/WelcomeCard'));
const QuickActionsWidget = React.lazy(() => import('@/components/painel/widgets/QuickActionsWidget'));
const MinhasAtividadesWidget = React.lazy(() => import('@/components/painel/widgets/MinhasAtividadesWidget'));
// =========================================================================
// WIDGETS ATIVADO
const MeuRhWidget = React.lazy(() => import('@/components/painel/widgets/MeuRhWidget'));
// =========================================================================
// WIDGETS REMOVIDOS TEMPORARIAMENTE
// const FinanceiroWidget = React.lazy(() => import('@/components/painel/widgets/FinanceiroWidget'));
// const ComercialWidget = React.lazy(() => import('@/components/painel/widgets/ComercialWidget'));
// =========================================================================

// Importação do widget de KPI personalizado que já existe
import CustomKpiSection from '@/components/painel/CustomKpiSection';

const WidgetSkeleton = () => (
  <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-48 flex justify-center items-center">
    <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
  </div>
);

export default function Painel() {
  const { user, hasPermission, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">

      <Suspense fallback={<WidgetSkeleton />}>
        {user && <WelcomeCard user={user} />}
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna 1: Itens de alta prioridade */}
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<WidgetSkeleton />}>
            {/* Renderiza "Minhas Atividades" apenas se o usuário for um funcionário */}
            {user?.funcionario_id && (
              <MinhasAtividadesWidget funcionario_id={user.funcionario_id} />
            )}
          </Suspense>
        </div>

        {/* Coluna 2: Itens secundários */}
        <div className="lg:col-span-1 space-y-6">
          <Suspense fallback={<WidgetSkeleton />}>
            <QuickActionsWidget />
          </Suspense>

          {/* Widget RH - ATIVADO */}
          <Suspense fallback={<WidgetSkeleton />}>
            {user?.funcionario_id && (
              <MeuRhWidget funcionario_id={user.funcionario_id} />
            )}
          </Suspense>
        </div>
      </div>

      {/* Seção de KPIs Personalizados (Comentada) */}
      {/*
      <Suspense fallback={null}>
        <CustomKpiSection />
      </Suspense>
      */}

      {/* Seção de Widgets por Permissão (Comentada) */}
      {/* =========================================================================
      // INÍCIO DA REMOÇÃO TEMPORÁRIA
      // O PORQUÊ: Comentamos a renderização dos widgets Financeiro e Comercial.
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Suspense fallback={<WidgetSkeleton />}>
          {hasPermission('financeiro', 'pode_ver') && (
            // <FinanceiroWidget />
          )}
        </Suspense>

        <Suspense fallback={<WidgetSkeleton />}>
          {hasPermission('crm', 'pode_ver') && (
            // <ComercialWidget />
          )}
        </Suspense>
      </div>
      // FIM DA REMOÇÃO TEMPORÁRIA
      // ========================================================================= */}

    </div>
  );
}