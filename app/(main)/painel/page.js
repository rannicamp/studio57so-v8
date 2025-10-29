// app/(main)/painel/page.js
// CÓDIGO ATUALIZADO E COMPLETO

"use client";

import React, { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// O PORQUÊ: Esta é a página principal do Painel, agora transformada em um Dashboard.
// 1. Usamos o useAuth para pegar os dados do 'user' e a função 'hasPermission'.
// 2. Importamos todos os widgets que acabamos de criar.
// 3. Importamos o CustomKpiSection (que JÁ EXISTIA) para carregar os KPIs personalizados.
// 4. Usamos um layout de Grid (Tailwind) para organizar os cards.
// 5. Renderizamos condicionalmente os widgets:
//    - Minhas Atividades e Meu RH só aparecem se o usuário for um funcionário.
//    - Financeiro e Comercial só aparecem se o usuário tiver permissão para vê-los.

// Importação dinâmica dos Widgets
// Usamos React.lazy para que a página carregue mais rápido
const WelcomeCard = React.lazy(() => import('@/components/painel/widgets/WelcomeCard'));
const QuickActionsWidget = React.lazy(() => import('@/components/painel/widgets/QuickActionsWidget'));
const MinhasAtividadesWidget = React.lazy(() => import('@/components/painel/widgets/MinhasAtividadesWidget'));
const MeuRhWidget = React.lazy(() => import('@/components/painel/widgets/MeuRhWidget'));
const FinanceiroWidget = React.lazy(() => import('@/components/painel/widgets/FinanceiroWidget'));
const ComercialWidget = React.lazy(() => import('@/components/painel/widgets/ComercialWidget'));

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
      
      {/* Suspense é um componente do React que mostra um 'fallback' (o esqueleto)
          enquanto os componentes dinâmicos (widgets) estão sendo carregados. */}
      <Suspense fallback={<WidgetSkeleton />}>
        {user && <WelcomeCard user={user} />}
      </Suspense>

      {/* Layout principal do Dashboard em grid */}
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
          
          <Suspense fallback={<WidgetSkeleton />}>
            {/* Renderiza "Meu RH" apenas se o usuário for um funcionário */}
            {user?.funcionario_id && (
              <MeuRhWidget funcionario_id={user.funcionario_id} />
            )}
          </Suspense>
        </div>
      </div>

      {/* Seção de KPIs Personalizados (do Construtor de KPIs) */}
      {/* Este componente já existe e busca seus próprios dados */}
      <Suspense fallback={null}>
        <CustomKpiSection />
      </Suspense>

      {/* Seção de Widgets por Permissão */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Suspense fallback={<WidgetSkeleton />}>
          {/* Renderiza "Financeiro" apenas se tiver permissão */}
          {hasPermission('financeiro', 'pode_ver') && (
            <FinanceiroWidget />
          )}
        </Suspense>

        <Suspense fallback={<WidgetSkeleton />}>
          {/* Renderiza "Comercial" apenas se tiver permissão */}
          {hasPermission('crm', 'pode_ver') && (
            <ComercialWidget />
          )}
        </Suspense>
      </div>

    </div>
  );
}