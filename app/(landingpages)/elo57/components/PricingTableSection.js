// Caminho: app/(landingpages)/elo57/components/PricingTableSection.js
'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faProjectDiagram, faUsers, faTasks,
  faClipboardList, faAddressBook, faDollarSign, faShoppingCart,
  faInbox, faBullseye, faFileSignature, faCalculator,
  faBoxOpen, faFileInvoiceDollar, faTags, faChartLine,
  faPercent, faCubes
} from '@fortawesome/free-solid-svg-icons';

const CATEGORIES = [
  {
    name: 'Administrativo',
    modules: [
      { id: 'financeiro', label: 'Financeiro', icon: faDollarSign },
      { id: 'recursos-humanos', label: 'Recursos Humanos', icon: faUsers },
      { id: 'empresas', label: 'Empresas', icon: faBuilding },
      { id: 'empreendimentos', label: 'Empreendimentos', icon: faProjectDiagram },
      { id: 'contratos', label: 'Contratos', icon: faFileSignature },
      { id: 'relatorios', label: 'Relatórios', icon: faChartLine },
      { id: 'indices-financeiros', label: 'Índices Financeiros', icon: faPercent },
    ]
  },
  {
    name: 'Comercial',
    modules: [
      { id: 'caixa-entrada', label: 'Caixa de Entrada', icon: faInbox },
      { id: 'funil-vendas', label: 'Funil de Vendas', icon: faBullseye },
      { id: 'tabela-vendas', label: 'Tabela de Vendas', icon: faTags },
      { id: 'contatos', label: 'Contatos', icon: faAddressBook },
      { id: 'simulador', label: 'Simulador', icon: faCalculator },
    ]
  },
  {
    name: 'Obra',
    modules: [
      { id: 'orcamentacao', label: 'Orçamentação', icon: faFileInvoiceDollar },
      { id: 'pedidos-compra', label: 'Pedidos de Compra', icon: faShoppingCart },
      { id: 'almoxarifado', label: 'Almoxarifado', icon: faBoxOpen },
      { id: 'diario-obra', label: 'Diário de Obra', icon: faClipboardList },
      { id: 'atividades', label: 'Atividades', icon: faTasks },
    ]
  },
  {
    name: 'Coordenação BIM',
    modules: [
      { id: 'bim-manager', label: 'BIM Manager 3D', icon: faCubes }
    ]
  }
];

const PLAN_DATA = {
  // Administrativo
  'financeiro': { essencial: true, pro: true, ultra: true },
  'recursos-humanos': { essencial: false, pro: true, ultra: true },
  'empresas': { essencial: true, pro: true, ultra: true },
  'empreendimentos': { essencial: true, pro: true, ultra: true },
  'contratos': { essencial: false, pro: true, ultra: true },
  'relatorios': { essencial: false, pro: true, ultra: true },
  'indices-financeiros': { essencial: false, pro: false, ultra: true },

  // Comercial
  'caixa-entrada': { essencial: false, pro: true, ultra: true },
  'funil-vendas': { essencial: false, pro: true, ultra: true },
  'tabela-vendas': { essencial: false, pro: true, ultra: true },
  'contatos': { essencial: true, pro: true, ultra: true },
  'simulador': { essencial: true, pro: true, ultra: true },

  // Obra
  'orcamentacao': { essencial: false, pro: false, ultra: true },
  'pedidos-compra': { essencial: false, pro: true, ultra: true },
  'almoxarifado': { essencial: false, pro: true, ultra: true },
  'diario-obra': { essencial: false, pro: true, ultra: true },
  'atividades': { essencial: true, pro: true, ultra: true },

  // Coordenação BIM
  'bim-manager': { essencial: false, pro: true, ultra: true },
};

export default function PricingTableSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <section 
      id="pricing-details" 
      className="relative min-h-screen flex flex-col justify-start bg-white px-6 py-16 md:py-24"
    >
      <div className="max-w-4xl mx-auto w-full py-6">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-slate-100">
          <div>
            <span className="text-slate-400 font-bold tracking-widest uppercase text-xs mb-2 block">
              Comparativo de Módulos
            </span>
            <h2 className="text-2xl md:text-3xl font-light text-slate-900 tracking-tight">
              Comparativo completo dos <span className="font-bold text-slate-950">Planos.</span>
            </h2>
            <p className="text-slate-500 text-xs font-light mt-1 max-w-xl">
              Compare os recursos e a cobertura de módulos inclusos em cada um dos nossos planos.
            </p>
          </div>
        </div>

        {/* Tabela Estática */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200">
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-1/2">
                  Estrutura do Sistema (Sidebar)
                </th>
                <th className="py-4 px-4 text-center text-xs font-bold text-slate-900 w-1/6">
                  Elo Essencial
                </th>
                <th className="py-4 px-4 text-center text-xs font-bold text-slate-950 w-1/6">
                  Elo Pro
                </th>
                <th className="py-4 px-4 text-center text-xs font-bold text-slate-950 w-1/6">
                  Elo Ultra
                </th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category, catIdx) => (
                <tr key={catIdx} className="contents">
                  {/* Cabeçalho da Categoria */}
                  <tr>
                    <td colSpan="4" className="bg-slate-50/50 py-3 px-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-y border-slate-200/80">
                      {category.name}
                    </td>
                  </tr>
                  
                  {/* Linhas dos Módulos */}
                  {category.modules.map((module) => {
                    const status = PLAN_DATA[module.id] || { essencial: false, pro: false, ultra: false };
                    
                    return (
                      <tr 
                        key={module.id} 
                        className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors"
                      >
                        {/* Nome do Módulo e Ícone */}
                        <td className="py-3 px-6 flex items-center gap-3.5">
                          <FontAwesomeIcon 
                            icon={module.icon} 
                            className="text-slate-400 w-4 h-4 text-center shrink-0" 
                          />
                          <span className="text-xs font-medium text-slate-700">
                            {module.label}
                          </span>
                        </td>
                        
                        {/* Coluna Essencial */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center">
                            <StatusIndicator included={status.essencial} />
                          </div>
                        </td>

                        {/* Coluna Pro */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center">
                            <StatusIndicator included={status.pro} />
                          </div>
                        </td>

                        {/* Coluna Ultra */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center">
                            <StatusIndicator included={status.ultra} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </section>
  );
}

// Indicador Estático de Disponibilidade do Módulo
function StatusIndicator({ included }) {
  if (included) {
    return (
      <span className="text-slate-900 font-bold text-sm bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center">
        ✓
      </span>
    );
  }
  return (
    <span className="text-slate-300 text-xs">—</span>
  );
}
