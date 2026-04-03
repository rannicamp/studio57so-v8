// components/compliance/PoliticasPublicas.js
'use client'

import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
 faFileContract,
 faPrint,
 faShieldHalved,
 faHistory,
 faCircleCheck
} from '@fortawesome/free-solid-svg-icons'

export default function PoliticasPublicas({ politicas = [], historico = [], showHistory = false }) {
 const [activeTab, setActiveTab] = useState(politicas[0]?.id || null)

 const handlePrint = () => {
 window.print()
 }

 const politicaAtiva = politicas.find(p => p.id === activeTab)

 return (
 <div className="space-y-6">
 {/* Cabeçalho da Central (Escondido na impressão) */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
 <div>
 <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
 <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-600" />
 Políticas e Segurança de Dados
 </h1>
 <p className="text-slate-500 text-sm">Consulte as diretrizes vigentes{showHistory ? ' e o seu histórico de aceites.' : '.'}</p>
 </div>

 {politicaAtiva && (
 <button
 onClick={handlePrint}
 className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
 >
 <FontAwesomeIcon icon={faPrint} />
 Imprimir Documento
 </button>
 )}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

 {/* Lateral: Navegação e Histórico (Escondido na impressão) */}
 <div className="lg:col-span-1 space-y-6 print:hidden">

 {/* Abas de Tipos */}
 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
 <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
 <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Documentos Ativos</h3>
 </div>
 <div className="p-2 space-y-1">
 {politicas.map(p => (
 <button
 key={p.id}
 onClick={() => setActiveTab(p.id)}
 className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${activeTab === p.id
 ? 'bg-emerald-50 text-emerald-700 font-semibold'
 : 'text-slate-600 hover:bg-slate-50'
 }`}
 >
 <FontAwesomeIcon icon={faFileContract} className={activeTab === p.id ? 'text-emerald-600' : 'text-slate-400'} />
 <div className="overflow-hidden">
 <p className="truncate text-sm">{p.titulo}</p>
 <p className="text-[10px] opacity-70">Versão {p.versao}</p>
 </div>
 </button>
 ))}
 {politicas.length === 0 && (
 <p className="p-4 text-xs text-slate-400 italic">Nenhuma política publicada.</p>
 )}
 </div>
 </div>

 {/* Mini Histórico de Aceites (Apenas se showHistory for true) */}
 {showHistory && (
 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
 <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
 <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seus Aceites</h3>
 <FontAwesomeIcon icon={faHistory} className="text-slate-400 text-[10px]" />
 </div>
 <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
 {historico.map(h => (
 <div key={h.id} className="border-l-2 border-emerald-500 pl-3 py-1">
 <p className="text-xs font-bold text-slate-800 truncate">
 {h.politicas_plataforma?.titulo || h.tipo}
 </p>
 <div className="flex items-center gap-1.5 mt-1">
 <FontAwesomeIcon icon={faCircleCheck} className="text-[10px] text-emerald-500" />
 <p className="text-[10px] text-slate-500">
 v{h.versao} em {new Date(h.data_aceite).toLocaleDateString('pt-BR')}
 </p>
 </div>
 </div>
 ))}
 {historico.length === 0 && (
 <p className="text-[10px] text-slate-400 italic">Sem registros.</p>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Área Principal: Conteúdo do Documento */}
 <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none min-h-[600px] flex flex-col">
 {politicaAtiva ? (
 <div className="p-8 md:p-12 print:p-0">
 {/* Cabeçalho de Impressão (Só aparece no papel) */}
 <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-8">
 <h1 className="text-2xl font-bold uppercase tracking-tighter">Studio 57 - Documentação Legal</h1>
 <p className="text-sm">Protocolo de Segurança e Compliance Digital</p>
 </div>

 <article className="prose prose-slate max-w-none prose-emerald">
 <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
 <div>
 <h2 className="text-2xl font-bold text-slate-900 m-0">{politicaAtiva.titulo}</h2>
 <p className="text-slate-500 text-sm mt-1">Versão {politicaAtiva.versao} • Publicado em {new Date(politicaAtiva.data_publicacao).toLocaleDateString('pt-BR')}</p>
 </div>
 <div className="text-right hidden sm:block">
 <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Vigente</span>
 </div>
 </div>

 <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
 {politicaAtiva.conteudo}
 </div>
 </article>

 {/* Rodapé de Impressão */}
 <div className="mt-12 pt-8 border-t border-slate-100 text-center space-y-2">
 <p className="text-[10px] text-slate-400">
 Este documento foi gerado eletronicamente pela plataforma Studio 57.
 {showHistory && ' Para fins de validação, consulte o painel de histórico de aceites no sistema.'}
 </p>
 <p className="text-[10px] text-slate-300">
 Acesso em: {new Date().toLocaleString('pt-BR')}
 </p>
 </div>
 </div>
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center italic">
 <FontAwesomeIcon icon={faFileContract} className="text-4xl mb-4 opacity-20" />
 <p>Selecione um documento na lateral para visualizar o conteúdo.</p>
 </div>
 )}
 </div>
 </div>

 <style jsx global>{`
 @media print {
 @page { margin: 2cm; }
 body { background: white !important; }
 .print\\:hidden { display: none !important; }
 nav, aside, header, footer { display: none !important; }
 main { padding: 0 !important; margin: 0 !important; }
 }
 `}</style>
 </div>
 )
}
