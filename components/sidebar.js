"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt, faBuilding, faProjectDiagram, faUsers, faTasks,
  faClipboardList, faCog, faChevronLeft, faChevronRight, faClock,
  faAddressBook, faDollarSign, faShoppingCart, faUserCog,
  faSitemap, faBug, faInbox, faBullseye, faFileSignature, faCalculator,
  faChevronDown,
  faBoxOpen
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '../utils/supabase/client';

export default function Sidebar({ isCollapsed, toggleSidebar }) {
  const { hasPermission } = useAuth();
  const supabase = createClient();

  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [isObrasOpen, setIsObrasOpen] = useState(true);

  useEffect(() => {
    const fetchEmpreendimentos = async () => {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .order('nome');
      if (error) {
        console.error("Erro ao buscar empreendimentos para o menu:", error);
      } else {
        setEmpreendimentos(data || []);
      }
    };
    fetchEmpreendimentos();
  }, [supabase]);

  const navSections = [
    {
      title: 'Administrativo',
      items: [
        { href: '/', label: 'Painel', icon: faTachometerAlt, recurso: 'painel' },
        { href: '/financeiro', label: 'Financeiro', icon: faDollarSign, recurso: 'financeiro' },
        { href: '/funcionarios', label: 'Funcionários', icon: faUsers, recurso: 'funcionarios' },
        { href: '/ponto', label: 'Controle de Ponto', icon: faClock, recurso: 'ponto' },
        { href: '/perfil', label: 'Meu Perfil', icon: faUserCog, recurso: 'perfil' },
        { href: '/atividades', label: 'Atividades', icon: faTasks, recurso: 'atividades' },
        { href: '/empresas', label: 'Empresas', icon: faBuilding, recurso: 'empresas' },
        { href: '/contratos', label: 'Contratos', icon: faFileSignature, recurso: 'contratos' },
      ]
    },
    {
      title: 'Obras',
      render: (isCollapsed, isMenuOpen, setMenuOpen) => {
        const canViewEmpreendimentos = hasPermission('empreendimentos', 'pode_ver');
        if (!canViewEmpreendimentos) return null;

        return (
          <>
            <button 
              onClick={() => !isCollapsed && setMenuOpen(!isMenuOpen)} 
              className={`flex items-center justify-between w-full py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}
            >
              <div className="flex items-center">
                <FontAwesomeIcon icon={faProjectDiagram} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {!isCollapsed && <span className="ml-4 text-sm font-medium">Empreendimentos</span>}
              </div>
              {!isCollapsed && <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />}
            </button>
            {(!isCollapsed && isMenuOpen) && (
              <ul className="bg-gray-50 border-l-4 border-gray-200 ml-6 pl-2">
                <li>
                  <Link href="/empreendimentos" className="flex items-center py-2 px-4 text-gray-600 hover:bg-gray-200 text-sm">
                    <span className="w-6 text-center">-</span> Ver Todos
                  </Link>
                </li>
                {empreendimentos.map(emp => (
                  <li key={emp.id}>
                    <Link href={`/empreendimentos/${emp.id}/produtos`} className="flex items-center py-2 px-4 text-gray-600 hover:bg-gray-200 text-sm group">
                      <FontAwesomeIcon icon={faBoxOpen} className="w-6 text-center text-gray-400 group-hover:text-blue-500" /> {emp.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {[
              { href: '/orcamento', label: 'Orçamentária', icon: faDollarSign, recurso: 'orcamento' },
              { href: '/pedidos', label: 'Pedidos de Compra', icon: faShoppingCart, recurso: 'pedidos' },
              { href: '/rdo/gerenciador', label: 'Diário de Obra', icon: faClipboardList, recurso: 'rdo' },
            ].map(item => {
                if (!hasPermission(item.recurso, 'pode_ver')) return null;
                return (
                    <Link key={item.href} href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                        <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                        {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
                    </Link>
                );
            })}
          </>
        );
      }
    },
    {
      title: 'Comercial',
      items: [
        { href: '/crm', label: 'CRM', icon: faBullseye, recurso: 'crm' },
        { href: '/contatos', label: 'Contatos', icon: faAddressBook, recurso: 'contatos' },
        { href: '/comercial/simulador', label: 'Simulador', icon: faCalculator, recurso: 'simulador' },
      ]
    }
  ];

  const bottomNavAlwaysVisible = [
      { href: '/configuracoes/feedback/enviar', label: 'Enviar Feedback', icon: faInbox, recurso: 'feedback' },
  ];

  const bottomNavItems = [
    { href: '/configuracoes', label: 'Configurações', icon: faCog, recurso: 'configuracoes' },
  ];

  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";
  const logoIconUrl = "/favicon.ico";

  return (
    <aside className={`bg-white shadow-lg h-full fixed left-0 top-0 z-40 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      <div className="flex items-center justify-center h-[65px] border-b border-gray-200 flex-shrink-0">
        <Link href="/">
          <img
            src={isCollapsed ? logoIconUrl : logoUrl}
            alt="Logo Studio 57"
            className={`transition-all duration-300 ${isCollapsed ? 'h-8' : 'h-10'} w-auto`}
          />
        </Link>
      </div>
      <nav className="mt-4 flex-grow overflow-y-auto">
        <ul>
          {navSections.map((section) => (
            <li key={section.title} className="mb-2">
              {!isCollapsed && section.title !== 'Obras' && (
                <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider my-2">
                  {section.title}
                </h3>
              )}
              {isCollapsed && section.title !== 'Obras' && (
                  <div className="flex justify-center my-4">
                     <div className="w-8 border-t border-gray-200"></div>
                  </div>
              )}
              
              {section.items ? (
                <ul>
                  {section.items.map((item) => {
                    const canViewItem = hasPermission(item.recurso, 'pode_ver');
                    if (!canViewItem) return null;
                    return (
                      <li key={item.label}>
                        <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                          <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                          {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                section.render(isCollapsed, isObrasOpen, setIsObrasOpen)
              )}
            </li>
          ))}
        </ul>
      </nav>
      <nav className="mt-auto mb-2 flex-shrink-0">
        <ul>
          {bottomNavAlwaysVisible.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
              </Link>
            </li>
          ))}
          
          {bottomNavItems.map((item) => {
              const canViewItem = hasPermission(item.recurso, 'pode_ver');
              if (!canViewItem) return null;
              return (
                <li key={item.label}>
                  <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                    <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                    {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
                  </Link>
                </li>
              );
          })}
        </ul>
      </nav>
      <div className="border-t border-gray-200 p-2">
        <button onClick={toggleSidebar} className="w-full h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
          <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronLeft} size="lg" />
        </button>
      </div>
    </aside>
  );
};