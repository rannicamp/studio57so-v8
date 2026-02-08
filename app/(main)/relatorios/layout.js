'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartPie, 
  faUsers, 
  faHardHat, 
  faMoneyBillWave, 
  faBoxOpen,
  faChartLine
} from '@fortawesome/free-solid-svg-icons';

export default function RelatoriosLayout({ children }) {
  const pathname = usePathname();

  // Função para verificar se o link está ativo
  const isActive = (path) => pathname.includes(path);

  const navItems = [
    // --- NOVO: Radar Studio no topo ---
    { label: 'Radar Studio', path: '/relatorios/radar', icon: faChartPie },
    { label: 'RH & Pessoas', path: '/relatorios/rh', icon: faUsers },
    { label: 'Comercial', path: '/relatorios/comercial', icon: faChartLine },
    { label: 'Financeiro', path: '/relatorios/financeiro', icon: faMoneyBillWave },
    { label: 'Obras', path: '/relatorios/obras', icon: faHardHat },
    { label: 'Almoxarifado', path: '/relatorios/estoque', icon: faBoxOpen },
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FontAwesomeIcon icon={faChartPie} className="text-blue-600 text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Relatórios Consolidados</h1>
              <p className="text-sm text-gray-500">Inteligência estratégica para tomada de decisão</p>
            </div>
          </div>

          {/* Navegação entre Relatórios */}
          <nav className="flex bg-gray-50 p-1.5 rounded-lg overflow-x-auto max-w-full">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  isActive(item.path)
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>

        </div>
      </div>

      {/* Conteúdo da Página Específica */}
      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  );
}