// app/(corretor)/simuladores/SimuladorTabs.js
'use client'

import { useState } from 'react'
import SimuladorFinanceiroPublico from '@/components/SimuladorFinanceiroPublico'
import SimuladorBraunas from '@/components/simuladores/SimuladorBraunas'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalculator, faTree } from '@fortawesome/free-solid-svg-icons'

export default function SimuladorTabs({ empreendimentos }) {
 const [activeTab, setActiveTab] = useState('padrao')

 return (
 <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
 {/* Sistema de Abas */}
 <div className="flex border-b border-gray-200">
 <button
 onClick={() => setActiveTab('padrao')}
 className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors border-b-2 outline-none flex items-center justify-center gap-2 ${
 activeTab === 'padrao'
 ? 'border-blue-600 text-blue-700 bg-blue-50/50'
 : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
 }`}
 >
 <FontAwesomeIcon icon={faCalculator} /> Simulador Geral (Multiempreendimento)
 </button>
 <button
 onClick={() => setActiveTab('braunas')}
 className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors border-b-2 outline-none flex items-center justify-center gap-2 ${
 activeTab === 'braunas'
 ? 'border-green-600 text-green-700 bg-green-50/50'
 : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
 }`}
 >
 <FontAwesomeIcon icon={faTree} /> Refúgio Braúnas (Específico)
 </button>
 </div>

 {/* Conteúdo das Abas */}
 <div className="p-6 md:p-8 bg-gray-50/30">
 {activeTab === 'padrao' && (
 <div className="animate-in fade-in duration-300">
 <SimuladorFinanceiroPublico empreendimentos={empreendimentos} />
 </div>
 )}
 {activeTab === 'braunas' && (
 <div className="animate-in fade-in duration-300">
 <SimuladorBraunas />
 </div>
 )}
 </div>
 </div>
 )
}
