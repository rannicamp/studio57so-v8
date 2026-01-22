// Caminho: app/(main)/relatorios/page.js
'use client';

import Link from 'next/link';
import NotificationTimeline from '@/components/dashboard/NotificationTimeline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faMoneyBillWave, 
  faUsers, 
  faChartPie 
} from '@fortawesome/free-solid-svg-icons';

export default function DashboardGeralPage() {
  
  // Lista de Relatórios Disponíveis (Adaptado para FontAwesome)
  const relatorios = [
    // --- NOVO: Radar Studio (Destaque no topo) ---
    {
      titulo: "Radar Studio",
      descricao: "Monitoramento de visitas, dispositivos e origem do tráfego em tempo real.",
      href: "/relatorios/radar",
      icon: faChartPie, // Ícone de Pizza/Analítico
      cor: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100"
    },
    {
      titulo: "Comercial & Marketing",
      descricao: "Funil de vendas, conversão de Ads e performance de contratos.",
      href: "/relatorios/comercial",
      icon: faChartLine, // Ícone de Gráfico de Linha
      cor: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100"
    },
    {
      titulo: "Financeiro",
      descricao: "Fluxo de caixa, DRE, conciliação e auditoria.",
      href: "/relatorios/financeiro",
      icon: faMoneyBillWave, // Ícone de Dinheiro
      cor: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100"
    },
    {
      titulo: "Recursos Humanos",
      descricao: "Folha de ponto, custos de equipe e turnover.",
      href: "/relatorios/rh",
      icon: faUsers, // Ícone de Usuários/Equipe
      cor: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100"
    }
  ];

  return (
    <div className="h-full space-y-6">
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FontAwesomeIcon icon={faChartPie} className="w-8 h-8 text-slate-600" />
          Central de Relatórios
        </h1>
      </div>

      {/* GRID PRINCIPAL: 1 Coluna (Mobile) -> 4 Colunas (PC) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        
        {/* === COLUNA ESQUERDA (1/4): TIMELINE DE EVENTOS === */}
        <div className="xl:col-span-1 w-full order-2 xl:order-1">
            <div className="sticky top-4">
              <NotificationTimeline />
            </div>
        </div>

        {/* === COLUNA DIREITA (3/4): MENU DE RELATÓRIOS === */}
        <div className="xl:col-span-3 w-full order-1 xl:order-2 space-y-6">
            
            {/* Grid de Cartões de Acesso */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatorios.map((relatorio, index) => (
                <Link 
                  key={index} 
                  href={relatorio.href}
                  className={`
                    block p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg bg-white
                    ${relatorio.border}
                  `}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${relatorio.bg}`}>
                    <FontAwesomeIcon icon={relatorio.icon} className={`w-6 h-6 ${relatorio.cor}`} />
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-800 mb-2">
                    {relatorio.titulo}
                  </h3>
                  
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {relatorio.descricao}
                  </p>
                </Link>
              ))}
            </div>

            {/* Área de Dashboard Unificado (Placeholder para o futuro) */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 border-dashed text-center">
              <h3 className="text-slate-400 font-medium mb-1">Dashboard Executivo Unificado</h3>
              <p className="text-xs text-slate-400">
                Selecione um módulo acima para ver os detalhes específicos.
              </p>
            </div>

        </div>

      </div>
    </div>
  );
}