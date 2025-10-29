// components/painel/widgets/QuickActionsWidget.js
// CÓDIGO COMPLETO

"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTasks, faReceipt, faShoppingCart } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '@/components/Tooltip';

// O PORQUÊ: Este widget usa o hook useAuth() para acessar a função hasPermission.
// Cada botão de atalho (Ação Rápida) só é renderizado (desenhado na tela) se o
// usuário logado tiver a permissão de "pode_criar" para aquele módulo específico.

const ActionButton = ({ href, icon, label, canView, position }) => {
  if (!canView) return null;
  return (
    <Tooltip label={label} position={position || 'top'}>
      <Link href={href}>
        <span className="flex flex-col items-center justify-center h-20 w-20 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition-all duration-200 hover:shadow-md">
          <FontAwesomeIcon icon={icon} className="text-2xl" />
          <span className="text-xs font-medium mt-2">{label}</span>
        </span>
      </Link>
    </Tooltip>
  );
};

export default function QuickActionsWidget() {
  const { hasPermission } = useAuth();

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Ações Rápidas</h3>
      <div className="grid grid-cols-3 gap-4">
        <ActionButton
          href="/atividades"
          icon={faTasks}
          label="Nova Atividade"
          canView={hasPermission('atividades', 'pode_criar')}
        />
        <ActionButton
          href="/financeiro"
          icon={faReceipt}
          label="Novo Lançamento"
          canView={hasPermission('financeiro', 'pode_criar')}
        />
        <ActionButton
          href="/pedidos"
          icon={faShoppingCart}
          label="Novo Pedido"
          canView={hasPermission('pedidos', 'pode_criar')}
        />
      </div>
    </div>
  );
}