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
const MeuRhWidget = React.lazy(() => import('@/components/painel/widgets/MeuRhWidget'));
const NotificacoesWidget = React.lazy(() => import('@/components/painel/widgets/NotificacoesWidget'));

const WidgetSkeleton = () => (
  <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-48 flex justify-center items-center">
    <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
  </div>
);

export default function Painel() {
  const { user, isLoading: authLoading } = useAuth();

  // --- TRAVA DE SEGURANÇA ---
  const isProprietario = 
    user?.funcao_id === 1 ||             
    user?.funcao_id === 9 ||             
    user?.funcao === 'Proprietário' ||   
    user?.nome_funcao === 'Proprietário' || 
    user?.role === 'Proprietário';       

  // Componente do Botão (CORRIGIDO: Link aponta para /relatorios)
  const RelatoriosButton = () => (
    <Link href="/relatorios" className="block transform transition-all hover:-translate-y-1">
      <div className="bg-gradient-to-r from-slate-800 to-gray-900 rounded-xl p-5 text-white shadow-lg border border-slate-700 group cursor-pointer relative overflow-hidden">
        {/* Efeito de brilho no fundo */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-lg group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
              <FontAwesomeIcon icon={faChartLine} className="text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Relatórios</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Visão Gerencial & RH</p>
            </div>
          </div>
          <FontAwesomeIcon icon={faArrowRight} className="text-slate-500 group-hover:text-white transition-colors" />
        </div>
      </div>
    </Link>
  );

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">

      {/* --- [MOBILE/TABLET APENAS] BOTÃO NO TOPO ABSOLUTO --- */}
      {isProprietario && (
        <div className="block lg:hidden">
          <RelatoriosButton />
        </div>
      )}

      {/* Cartão de Boas Vindas (Perfil) */}
      <Suspense fallback={<WidgetSkeleton />}>
        {user && <WelcomeCard user={user} />}
      </Suspense>

      {/* GRID PRINCIPAL DO PAINEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- COLUNA ESQUERDA (PRINCIPAL / 2 COLUNAS) --- */}
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<WidgetSkeleton />}>
            {user?.funcionario_id && (
              <MinhasAtividadesWidget funcionario_id={user.funcionario_id} />
            )}
          </Suspense>
        </div>

        {/* --- COLUNA DIREITA (LATERAL / 1 COLUNA) --- */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          
          {/* --- [DESKTOP APENAS] BOTÃO NA LATERAL --- */}
          {isProprietario && (
            <div className="hidden lg:block">
              <RelatoriosButton />
            </div>
          )}

          {/* 1. Notificações */}
          <Suspense fallback={<WidgetSkeleton />}>
             {user?.id && <NotificacoesWidget userId={user.id} />}
          </Suspense>
          
          {/* 2. Ações Rápidas */}
          <Suspense fallback={<WidgetSkeleton />}>
            <QuickActionsWidget />
          </Suspense>

          {/* 3. Widget RH */}
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