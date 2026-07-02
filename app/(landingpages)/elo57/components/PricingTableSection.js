// Caminho: app/(landingpages)/elo57/components/PricingTableSection.js
'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faProjectDiagram, faUsers, faTasks,
  faClipboardList, faAddressBook, faDollarSign, faShoppingCart,
  faInbox, faBullseye, faFileSignature, faCalculator,
  faBoxOpen, faFileInvoiceDollar, faTags, faChartLine,
  faPercent, faCubes, faUndo
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

const INITIAL_STATE = {
  // Administrativo
  'financeiro': { essencial: true, pro: true, ia: true },
  'recursos-humanos': { essencial: false, pro: true, ia: true },
  'empresas': { essencial: true, pro: true, ia: true },
  'empreendimentos': { essencial: true, pro: true, ia: true },
  'contratos': { essencial: false, pro: true, ia: true },
  'relatorios': { essencial: false, pro: true, ia: true },
  'indices-financeiros': { essencial: false, pro: false, ia: true },

  // Comercial
  'caixa-entrada': { essencial: false, pro: true, ia: true },
  'funil-vendas': { essencial: false, pro: true, ia: true },
  'tabela-vendas': { essencial: false, pro: true, ia: true },
  'contatos': { essencial: true, pro: true, ia: true },
  'simulador': { essencial: true, pro: true, ia: true },

  // Obra
  'orcamentacao': { essencial: false, pro: false, ia: true },
  'pedidos-compra': { essencial: false, pro: true, ia: true },
  'almoxarifado': { essencial: false, pro: true, ia: true },
  'diario-obra': { essencial: false, pro: true, ia: true },
  'atividades': { essencial: true, pro: true, ia: true },

  // Coordenação BIM
  'bim-manager': { essencial: false, pro: true, ia: true },
};

export default function PricingTableSection() {
  const [planMatrix, setPlanMatrix] = useState({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Recupera dados salvos ou inicializa
    const saved = localStorage.getItem('elo57_planos_comparativo');
    if (saved) {
      try {
        setPlanMatrix(JSON.parse(saved));
      } catch (e) {
        setPlanMatrix(INITIAL_STATE);
      }
    } else {
      setPlanMatrix(INITIAL_STATE);
    }
  }, []);

  const handleToggle = (moduleId, planKey) => {
    const currentModule = planMatrix[moduleId] || { essencial: false, pro: false, ia: false };
    const newState = {
      ...planMatrix,
      [moduleId]: {
        ...currentModule,
        [planKey]: !currentModule[planKey]
      }
    };
    setPlanMatrix(newState);
    localStorage.setItem('elo57_planos_comparativo', JSON.stringify(newState));
  };

  const handleReset = () => {
    setPlanMatrix(INITIAL_STATE);
    localStorage.setItem('elo57_planos_comparativo', JSON.stringify(INITIAL_STATE));
  };

  if (!mounted) return null;

  return (
    <section 
      id="pricing-details" 
      className="snap-start min-h-screen flex flex-col justify-center bg-white px-6 py-16 md:py-8 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto w-full py-6">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-slate-100">
          <div>
            <span className="text-slate-400 font-bold tracking-widest uppercase text-xs mb-2 block">
              Comparativo de Módulos
            </span>
            <h2 className="text-2xl md:text-3xl font-light text-slate-900 tracking-tight">
              Personalize o escopo dos <span className="font-bold text-slate-950">Planos.</span>
            </h2>
            <p className="text-slate-500 text-xs font-light mt-1 max-w-xl">
              Clique nos checkboxes para simular a distribuição dos módulos. A configuração salva automaticamente no seu navegador.
            </p>
          </div>
          
          <button 
            onClick={handleReset}
            className="flex items-center justify-center gap-2 py-2 px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 hover:text-slate-950 transition-colors shadow-sm self-start md:self-end"
          >
            <FontAwesomeIcon icon={faUndo} className="w-3.5 h-3.5" />
            Resetar Módulos
          </button>
        </div>

        {/* Tabela Interativa */}
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
                  Elo IA
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
                    const status = planMatrix[module.id] || { essencial: false, pro: false, ia: false };
                    
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
                            <InteractiveCheckbox 
                              checked={status.essencial} 
                              onChange={() => handleToggle(module.id, 'essencial')} 
                            />
                          </div>
                        </td>

                        {/* Coluna Pro */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center">
                            <InteractiveCheckbox 
                              checked={status.pro} 
                              onChange={() => handleToggle(module.id, 'pro')} 
                            />
                          </div>
                        </td>

                        {/* Coluna IA */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center">
                            <InteractiveCheckbox 
                              checked={status.ia} 
                              onChange={() => handleToggle(module.id, 'ia')} 
                            />
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

// Checkbox Interativo Personalizado
function InteractiveCheckbox({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all duration-200 select-none text-[10px] ${
        checked 
          ? 'bg-slate-950 border-slate-950 text-white font-bold scale-[1.05] shadow-sm shadow-slate-950/10' 
          : 'border-slate-350 bg-white hover:bg-slate-100/50 hover:border-slate-500 text-transparent'
      }`}
      aria-label={checked ? "Remover recurso do plano" : "Adicionar recurso ao plano"}
    >
      ✓
    </button>
  );
}
