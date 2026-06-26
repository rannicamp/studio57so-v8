// Caminho: app/(landingpages)/elo57/components/TechSection.js
'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt, faBuilding, faProjectDiagram, faUsers, faTasks,
  faClipboardList, faAddressBook, faDollarSign, faShoppingCart,
  faInbox, faBullseye, faFileSignature, faCalculator,
  faBoxOpen, faFileInvoiceDollar, faTags, faChartLine,
  faPercent, faCubes
} from '@fortawesome/free-solid-svg-icons';

export default function TechSection() {
  const modulos = [
    {
      title: 'Administrativo',
      items: [
        { label: 'Painel', icon: faTachometerAlt },
        { label: 'Financeiro', icon: faDollarSign },
        { label: 'Recursos Humanos', icon: faUsers },
        { label: 'Empresas', icon: faBuilding },
        { label: 'Empreendimentos', icon: faProjectDiagram },
        { label: 'Contratos', icon: faFileSignature },
        { label: 'Relatórios', icon: faChartLine },
        { label: 'Índices Financeiros', icon: faPercent },
      ]
    },
    {
      title: 'Comercial',
      items: [
        { label: 'Caixa de Entrada', icon: faInbox },
        { label: 'Funil de Vendas', icon: faBullseye },
        { label: 'Tabela de Vendas', icon: faTags },
        { label: 'Contatos', icon: faAddressBook },
        { label: 'Simulador', icon: faCalculator },
      ]
    },
    {
      title: 'Obra',
      items: [
        { label: 'Orçamentação', icon: faFileInvoiceDollar },
        { label: 'Pedidos de Compra', icon: faShoppingCart },
        { label: 'Almoxarifado', icon: faBoxOpen },
        { label: 'Diário de Obra', icon: faClipboardList },
        { label: 'Atividades', icon: faTasks },
      ]
    },
    {
      title: 'Coordenação BIM',
      items: [
        { label: 'BIM Manager 3D', icon: faCubes },
      ]
    }
  ];

  return (
    <section 
      id="modulos" 
      className="snap-start min-h-screen md:h-screen flex flex-col justify-center py-16 md:py-0 bg-white px-6 overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto w-full">
        
        {/* Cabeçalho da Seção */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-4xl md:text-5xl font-light mb-6 text-slate-900 tracking-tight leading-tight">
            Um ecossistema <span className="font-bold">completo.</span>
          </h2>
          <p className="text-base md:text-lg text-slate-500 max-w-3xl mx-auto font-light leading-relaxed">
            Não é apenas um software. É a integração de todos os departamentos de sua incorporadora.
            <br className="hidden md:block" />
            <strong className="text-slate-700 font-medium">Arquitetura multi-empresas:</strong> preparado para gerenciar holdings com múltiplos CNPJs (SPEs) e obras simultâneas em segurança.
          </p>
        </div>

        {/* Grid de Módulos */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {modulos.map((modulo, index) => (
            <div 
              key={index} 
              className="rounded-2xl p-6 border border-slate-100 hover:border-slate-800 bg-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col h-full group"
            >
              {/* Título do Módulo */}
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4 shrink-0">
                <div className={`w-3 h-3 rounded-full bg-slate-900 group-hover:bg-slate-950 transition-colors`}></div>
                <h3 className="text-lg font-bold tracking-wide text-slate-900 group-hover:text-slate-950 transition-colors">{modulo.title}</h3>
              </div>

              {/* Lista de Itens (Mesmo formato de visualização do Sidebar) */}
              <ul className="space-y-1.5 flex-grow">
                {modulo.items.map((item, idx) => (
                  <li key={idx}>
                    <div className="flex items-center py-2.5 px-4 text-gray-650 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 border-l-4 border-transparent hover:border-blue-600 rounded-r-md cursor-pointer group/item">
                      <FontAwesomeIcon icon={item.icon} className="text-base w-5 text-gray-400 group-hover/item:text-blue-700 transition-colors" />
                      <span className="ml-4 text-sm font-medium transition-colors">
                        {item.label}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Footer do Card (Destaque BIM) */}
              {index === 3 && (
                <div className="mt-6 pt-4 border-t border-slate-100 shrink-0">
                  <span className="text-slate-900 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-slate-900 rounded-full animate-pulse"></span>
                    Disponível Agora
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}