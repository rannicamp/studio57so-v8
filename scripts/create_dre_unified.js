const fs = require('fs');

const content = `// components/relatorios/financeiro/FinanceiroDRE.js
import React, { useState, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronDown, faInfoCircle, faSpinner, faPrint, faFileCsv, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

// Utilitário para formatar BRL
const formatBR = (value) =>
 new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Linha Mestre Expandível (Adaptada para Matriz Horizontal)
const LinhaMestre = ({ titulo, valorTotal, filhas, colunasMeses, corTexto = 'text-gray-900', defaultOpen = false, mestre }) => {
 const [isOpen, setIsOpen] = useState(defaultOpen);
 const temFilhas = filhas && filhas.length > 0;
 
 // Como agora tudo é soma algébrica no backend central
 // O frontend DRE não deve tentar ficar flipando negativo na tela atoa, 
 // mas em alguns grupos como Custo queremos ver como número positivo visualmente
 const isRed = mestre.subtrair;
 const formatador = (v) => formatBR(isRed ? Math.abs(v) : v);

 return (
 <>
 <tr
 className={\`hover:bg-gray-50/80 transition-colors \${temFilhas ? 'cursor-pointer' : ''} border-b border-gray-100 group\`}
 onClick={() => temFilhas && setIsOpen(!isOpen)}
 >
 <td className="py-4 px-6 min-w-[320px] sticky left-0 bg-white z-10 border-r border-gray-200">
 <div className="flex items-center">
 <div className="w-6 flex justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
 {temFilhas && (
 <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} className="text-sm" />
 )}
 </div>
 <span className={\`font-semibold ml-2 \${isRed ? 'text-red-700' : corTexto}\`}>{titulo}</span>
 </div>
 </td>
 <td className={\`py-4 px-6 text-right font-bold w-40 sticky left-[320px] bg-white z-10 border-r-2 border-gray-300 \${isRed ? 'text-red-800' : 'text-gray-900'}\`}>
 {formatador(valorTotal)}
 </td>
 {colunasMeses.map((mesCol, idx) => (
 <td key={\`mestre-\${idx}-\${mesCol}\`} className={\`py-4 px-6 text-right font-medium \${isRed ? 'text-red-600' : 'text-gray-700'} border-r border-gray-100\`}>
 {formatador(mestre.mensal[mesCol] || 0)}
 </td>
 ))}
 </tr>
 {isOpen && temFilhas && filhas.map((filha, idx) => (
 <tr key={idx} className="bg-gray-50/50 border-b border-gray-100 last:border-0 hover:bg-gray-100/50 transition-colors">
 <td className="py-2.5 px-6 pl-14 text-sm text-gray-600 flex items-center min-w-[320px] sticky left-0 bg-gray-50/95 z-10 border-r border-gray-200">
 <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-3"></div>
 {filha.nome}
 </td>
 <td className={\`py-2.5 px-6 text-right text-sm font-semibold tracking-tight w-40 sticky left-[320px] bg-gray-50/95 z-10 border-r-2 border-gray-300 \${isRed ? 'text-red-700' : 'text-gray-700'}\`}>
 {formatador(filha.total)}
 </td>
 {colunasMeses.map((mesCol, i) => (
     <td key={\`filha-\${idx}-\${mesCol}\`} className="py-2.5 px-6 text-right text-sm text-gray-500 border-r border-gray-100">
         {formatador(filha.mensal[mesCol] || 0)}
     </td>
 ))}
 </tr>
 ))}
 </>
 );
};

// Linha de Totalização
const LinhaTotal = ({ titulo, valorTotal, valoresMensais, colunasMeses, principal = false, info = '' }) => {
 const negativo = valorTotal < 0;
 let textColor = 'text-gray-900';
 let bgColor = 'bg-gray-50';

 if (principal) {
 if (negativo) {
 textColor = 'text-red-700';
 bgColor = 'bg-red-50/90 border-y border-red-100';
 } else {
 textColor = 'text-emerald-700';
 bgColor = 'bg-emerald-50/90 border-y border-emerald-100';
 }
 }

 return (
 <tr className={\`\${bgColor}\`}>
 <td className="py-4 px-6 flex items-center min-w-[320px] sticky left-0 z-10 border-r border-gray-200" style={{backgroundColor: principal && !negativo ? '#ecfdf5' : principal && negativo ? '#fef2f2' : '#f9fafb'}}>
 <span className={\`font-bold \${principal ? 'text-lg' : 'text-md'} \${textColor}\`}>{titulo}</span>
 {info && (
 <div className="ml-2 group relative flex items-center cursor-help">
 <FontAwesomeIcon icon={faInfoCircle} className="text-gray-400 hover:text-gray-600" />
 <div className="absolute left-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none">
 {info}
 </div>
 </div>
 )}
 </td>
 <td className={\`py-4 px-6 text-right font-bold \${principal ? 'text-lg' : 'text-md'} \${textColor} tracking-tight w-40 sticky left-[320px] z-10 border-r-2 border-gray-300\`} style={{backgroundColor: principal && !negativo ? '#ecfdf5' : principal && negativo ? '#fef2f2' : '#f9fafb'}}>
 {formatBR(valorTotal)}
 </td>
 {colunasMeses.map((mesCol, idx) => (
 <td key={\`total-\${idx}-\${mesCol}\`} className={\`py-4 px-6 text-right font-bold \${textColor} \${principal ? 'text-md' : 'text-sm'} border-r border-gray-200\`}>
 {formatBR(valoresMensais[mesCol] || 0)}
 </td>
 ))}
 </tr>
 );
};

export default function FinanceiroDRE({ dadosDRE, isLoading }) {
 const tableRef = useRef(null);

 if (isLoading) {
 return (
 <div className="flex flex-col items-center justify-center p-20 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200 mt-6 min-h-[400px]">
 <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
 <p className="font-medium">Calculando e consolidando o DRE Global...</p>
 <p className="text-sm text-gray-400 mt-2 text-center max-w-md">Gerando matriz horizontal completa de todos os mêses em tempo real.</p>
 </div>
 );
 }

 if (!dadosDRE || !dadosDRE.grupos) {
 return (
 <div className="p-10 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200 mt-6 min-h-[400px] flex items-center justify-center">
 Não foi possível carregar os dados do DRE. Verifique sua conexão e os filtros.
 </div>
 );
 }

 const { grupos, totais, colunasMeses } = dadosDRE;

 const handleExportCSV = () => {
 // Simples para DRE Global Horizontal
 alert("A exportação CSV da Matriz está em desenvolvimento.");
 };

 // Para facilitar leitura, pegamos a data atual para destacar a coluna
 const dataAtualStr = new Date().toISOString().substring(0, 7);

 return (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 overflow-hidden flex flex-col print:shadow-none print:border-none print:m-0 print:p-0 s57-print-area">
 <div className="px-6 py-5 border-b border-gray-100 bg-blue-600 from-slate-50 to-white print:from-white print:to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Demonstração do Resultado do Exercício (Matriz)</h3>
 <p className="text-sm text-slate-500 font-medium">Layout Horizontal Analítico</p>
 </div>
 <div className="flex gap-4">
 <div className="bg-slate-100 rounded-lg px-4 py-2 border border-slate-200 print:hidden flex items-center justify-between gap-4">
 <div>
 <span className="text-xs text-slate-500 block font-semibold mb-0.5 uppercase tracking-wide">Margem Global</span>
 <span className={\`font-bold \${totais.margemLiquidaGlobal > 0 ? "text-emerald-700" : "text-red-600"}\`}>{totais.margemLiquidaGlobal.toFixed(2)}%</span>
 </div>
 <div className="border-l border-slate-300 pl-4 flex gap-2">
 <button
 onClick={() => window.print()}
 className="w-8 h-8 flex items-center justify-center rounded bg-white border border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
 title="Imprimir Relatório (PDF)"
 >
 <FontAwesomeIcon icon={faPrint} />
 </button>
 <button
 onClick={handleExportCSV}
 className="w-8 h-8 flex items-center justify-center rounded bg-white border border-slate-300 text-slate-600 hover:text-green-600 hover:border-green-300 transition-colors"
 title="Exportar para Excel/CSV"
 >
 <FontAwesomeIcon icon={faFileCsv} />
 </button>
 </div>
 </div>
 </div>
 </div>

 <div 
 ref={tableRef}
 className="w-full overflow-x-auto relative" 
 style={{ maxHeight: '75vh' }}
 >
 <table className="w-full text-left border-collapse min-w-max">
 <thead className="sticky top-0 z-20">
 <tr className="bg-gray-100 border-b-2 border-gray-300 text-xs uppercase tracking-wider text-gray-600 font-bold">
 <th className="py-4 px-6 min-w-[320px] sticky left-0 bg-gray-100 z-30 border-r border-gray-300">
 Descrição da Conta DRE
 </th>
 <th className="py-4 px-6 w-40 text-right sticky left-[320px] bg-gray-100 z-30 border-r-2 border-gray-300 hover:bg-gray-200 cursor-pointer transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
 Total Acumulado (R$)
 </th>
 {colunasMeses.map(mesCol => {
 const [ano, mes] = mesCol.split('-');
 const isAtual = mesCol === dataAtualStr;
 return (
 <th key={mesCol} className={\`py-4 px-6 w-36 text-center border-r border-gray-200 \${isAtual ? 'bg-blue-100 text-blue-800' : ''}\`}>
 <div>{mes}/{ano}</div>
 </th>
 );
 })}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 bg-white">
 {/* 1. Receita Bruta */}
 <LinhaMestre
 titulo={grupos.receitaBruta.mestre?.nome}
 mestre={grupos.receitaBruta}
 valorTotal={grupos.receitaBruta.total}
 filhas={grupos.receitaBruta.filhasArray}
 colunasMeses={colunasMeses}
 corTexto="text-slate-800"
 defaultOpen={true}
 />
 {/* 2. Deduções */}
 <LinhaMestre
 titulo={grupos.deducoes.mestre?.nome}
 mestre={grupos.deducoes}
 valorTotal={grupos.deducoes.total}
 filhas={grupos.deducoes.filhasArray}
 colunasMeses={colunasMeses}
 />

 {/* LÍQUIDA */}
 <LinhaTotal
 titulo="(=) Receita Operacional Líquida"
 valorTotal={totais.receitaLiquida.total}
 valoresMensais={totais.receitaLiquida.mensal}
 colunasMeses={colunasMeses}
 info="Receita Bruta - Deduções. É o faturamento real que entrou."
 />

 {/* 3. Custos Operacionais */}
 <LinhaMestre
 titulo={grupos.custos.mestre?.nome}
 mestre={grupos.custos}
 valorTotal={grupos.custos.total}
 filhas={grupos.custos.filhasArray}
 colunasMeses={colunasMeses}
 />

 {/* LUCRO BRUTO */}
 <LinhaTotal
 titulo="(=) Lucro Bruto Operacional"
 valorTotal={totais.lucroBruto.total}
 valoresMensais={totais.lucroBruto.mensal}
 colunasMeses={colunasMeses}
 />

 {/* 4. Despesas Operacionais */}
 <LinhaMestre
 titulo={grupos.despesasOperacionais.mestre?.nome}
 mestre={grupos.despesasOperacionais}
 valorTotal={grupos.despesasOperacionais.total}
 filhas={grupos.despesasOperacionais.filhasArray}
 colunasMeses={colunasMeses}
 />

 {/* RESULTADO OPERACIONAL */}
 <LinhaTotal
 titulo="(=) Resultado Operacional"
 valorTotal={totais.resultadoOperacional.total}
 valoresMensais={totais.resultadoOperacional.mensal}
 colunasMeses={colunasMeses}
 info="Lucro Bruto - Despesas Administrativas/Comerciais."
 />

 {/* 5.1 e 5.2. Resultado Financeiro */}
 <LinhaMestre
 titulo={grupos.receitasFinanceiras.mestre?.nome}
 mestre={grupos.receitasFinanceiras}
 valorTotal={grupos.receitasFinanceiras.total}
 filhas={grupos.receitasFinanceiras.filhasArray}
 colunasMeses={colunasMeses}
 />
 <LinhaMestre
 titulo={grupos.despesasFinanceiras.mestre?.nome}
 mestre={grupos.despesasFinanceiras}
 valorTotal={grupos.despesasFinanceiras.total}
 filhas={grupos.despesasFinanceiras.filhasArray}
 colunasMeses={colunasMeses}
 />

 {/* RESULTADO ANTES DOS IMPOSTOS */}
 <LinhaTotal
 titulo="(=) Resultado Antes do IRPJ/CSLL"
 valorTotal={totais.resultadoAntesImpostos.total}
 valoresMensais={totais.resultadoAntesImpostos.mensal}
 colunasMeses={colunasMeses}
 />

 {/* 6. Impostos sobre o Lucro */}
 <LinhaMestre
 titulo={grupos.impostosLucro.mestre?.nome}
 mestre={grupos.impostosLucro}
 valorTotal={grupos.impostosLucro.total}
 filhas={grupos.impostosLucro.filhasArray}
 colunasMeses={colunasMeses}
 />

 {/* RESULTADO LÍQUIDO FINAL */}
 <LinhaTotal
 titulo="(=) Resultado Líquido do Exercício"
 valorTotal={totais.lucroLiquido.total}
 valoresMensais={totais.lucroLiquido.mensal}
 colunasMeses={colunasMeses}
 principal={true}
 info="Valor final gerado pela empresa de fato."
 />

 {/* Não Classificados / Perdidos */}
 {grupos.naoClassificado.total !== 0 && (
 <LinhaMestre
 titulo="⚠️ Custos Não Classificados / Sem Categoria Pai"
 mestre={grupos.naoClassificado}
 valorTotal={grupos.naoClassificado.total}
 filhas={grupos.naoClassificado.filhasArray}
 colunasMeses={colunasMeses}
 corTexto="text-blue-600"
 />
 )}
 </tbody>
 </table>
 </div>
 </div>
 );
}
`;
fs.writeFileSync('c:\\projetos\\studio57so-v8-main\\components\\relatorios\\financeiro\\FinanceiroDRE.js', content);
