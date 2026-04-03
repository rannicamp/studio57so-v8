// components/relatorios/financeiro/FinanceiroDRE.js
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronDown, faInfoCircle, faSpinner, faPrint, faFileCsv } from '@fortawesome/free-solid-svg-icons';

// Utilitário para formatar BRL
const formatBR = (value) =>
 new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Linha Mestre Expandível
const LinhaMestre = ({ titulo, valor, filhas, subtrair = false, corTexto = 'text-gray-900', defaultOpen = false }) => {
 const [isOpen, setIsOpen] = useState(defaultOpen);
 const temFilhas = filhas && filhas.length > 0;

 // Para valores que reduzem (Despesas/Deduções) ficam negativos na UI ou apenas em vermelho
 const valorDisplay = formatBR(Math.abs(valor));
 const prefixoValor = subtrair && valor > 0 ? '-' : '';
 const textColor = subtrair && valor > 0 ? 'text-red-600' : corTexto;

 return (
 <>
 <tr
 className={`hover:bg-gray-50/80 transition-colors ${temFilhas ? 'cursor-pointer' : ''} border-b border-gray-100 group`}
 onClick={() => temFilhas && setIsOpen(!isOpen)}
 >
 <td className="py-4 px-6">
 <div className="flex items-center">
 <div className="w-6 flex justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
 {temFilhas && (
 <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} className="text-sm" />
 )}
 </div>
 <span className={`font-semibold ml-2 ${textColor}`}>{titulo}</span>
 </div>
 </td>
 <td className={`py-4 px-6 text-right font-medium ${textColor}`}>
 {prefixoValor}{valorDisplay}
 </td>
 </tr>
 {isOpen && temFilhas && filhas.map((filha, idx) => (
 <tr key={idx} className="bg-gray-50/50 border-b border-gray-100 last:border-0 hover:bg-gray-100/50 transition-colors">
 <td className="py-2.5 px-6 pl-14 text-sm text-gray-600 flex items-center">
 <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-3"></div>
 {filha.nome}
 </td>
 <td className="py-2.5 px-6 text-right text-sm text-gray-600 font-medium tracking-tight">
 {formatBR(Math.abs(filha.total))}
 </td>
 </tr>
 ))}
 </>
 );
};

// Linha de Totalização (Lucro/Receita Líquida)
const LinhaTotal = ({ titulo, valor, principal = false, info = '' }) => {
 const negativo = valor < 0;
 let textColor = 'text-gray-900';
 let bgColor = 'bg-gray-50';

 if (principal) {
 if (negativo) {
 textColor = 'text-red-700';
 bgColor = 'bg-red-50/70 border-y border-red-100';
 } else {
 textColor = 'text-emerald-700';
 bgColor = 'bg-emerald-50/70 border-y border-emerald-100';
 }
 }

 return (
 <tr className={`${bgColor}`}>
 <td className="py-4 px-6 flex items-center">
 <span className={`font-bold ${principal ? 'text-lg' : 'text-md'} ${textColor}`}>{titulo}</span>
 {info && (
 <div className="ml-2 group relative flex items-center cursor-help">
 <FontAwesomeIcon icon={faInfoCircle} className="text-gray-400 hover:text-gray-600" />
 <div className="absolute left-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
 {info}
 </div>
 </div>
 )}
 </td>
 <td className={`py-4 px-6 text-right font-bold ${principal ? 'text-lg' : 'text-md'} ${textColor} tracking-tight`}>
 {formatBR(valor)}
 </td>
 </tr>
 );
};

export default function FinanceiroDRE({ dadosDRE, isLoading }) {
 if (isLoading) {
 return (
 <div className="flex flex-col items-center justify-center p-20 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200 mt-6 min-h-[400px]">
 <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
 <p className="font-medium">Calculando e consolidando o DRE...</p>
 <p className="text-sm text-gray-400 mt-2 text-center max-w-md">Isso pode levar alguns segundos dependendo da quantidade de lançamentos do período.</p>
 </div>
 );
 }

 if (!dadosDRE) {
 return (
 <div className="p-10 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200 mt-6 min-h-[400px] flex items-center justify-center">
 Não foi possível carregar os dados do DRE. Verifique sua conexão e os filtros.
 </div>
 );
 }

 const { grupos, totais } = dadosDRE;

 const handleExportCSV = () => {
 let csvContent = "Grupo;Categoria;Valor\n";

 const appendRow = (grupo, cat, valor) => {
 // Remove quebras de linha e trata números BRL
 const limpaTexto = (text) => `"${(text || '').replace(/"/g, '""')}"`;
 const valorString = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 csvContent += `${limpaTexto(grupo)};${limpaTexto(cat)};"${valorString}"\n`;
 };

 // Receita
 appendRow("1. RECEITA BRUTA", grupos.receitaBruta.mestre?.nome || '1. Receita Bruta', grupos.receitaBruta.total);
 grupos.receitaBruta.filhasArray.forEach(f => appendRow("", f.nome, f.total));

 // Deduções
 appendRow("2. DEDUÇÕES", grupos.deducoes.mestre?.nome || '2. Deduções', grupos.deducoes.total);
 grupos.deducoes.filhasArray.forEach(f => appendRow("", f.nome, f.total));

 appendRow("= RECEITA OPERACIONAL LÍQUIDA", "", totais.receitaLiquida);

 // Custos
 appendRow("3. CUSTOS OPERACIONAIS (CMV/CSV)", grupos.custos.mestre?.nome || '3. Custos Operacionais', grupos.custos.total);
 grupos.custos.filhasArray.forEach(f => appendRow("", f.nome, f.total));

 appendRow("= LUCRO BRUTO OPERACIONAL", "", totais.lucroBruto);

 // Despesas Operacionais
 appendRow("4. DESPESAS OPERACIONAIS", grupos.despesasOperacionais.mestre?.nome || '4. Despesas Operacionais', grupos.despesasOperacionais.total);
 grupos.despesasOperacionais.filhasArray.forEach(f => appendRow("", f.nome, f.total));

 appendRow("= RESULTADO OPERACIONAL", "", totais.resultadoOperacional);

 // Financeiras
 appendRow("5.1 RECEITAS FINANCEIRAS", grupos.receitasFinanceiras.mestre?.nome || '5.1 Receitas Financeiras', grupos.receitasFinanceiras.total);
 grupos.receitasFinanceiras.filhasArray.forEach(f => appendRow("", f.nome, f.total));

 appendRow("5.2 DESPESAS FINANCEIRAS", grupos.despesasFinanceiras.mestre?.nome || '5.2 Despesas Financeiras', grupos.despesasFinanceiras.total);
 grupos.despesasFinanceiras.filhasArray.forEach(f => appendRow("", f.nome, f.total));

 appendRow("= RESULTADO ANTES DO IRPJ/CSLL", "", totais.resultadoAntesImpostos);

 // Impostos
 appendRow("6. IRPJ E CSLL (Lucro)", grupos.impostosLucro.mestre?.nome || '6. IRPJ E CSLL', grupos.impostosLucro.total);
 grupos.impostosLucro.filhasArray.forEach(f => appendRow("", f.nome, f.total));

 appendRow("= RESULTADO LÍQUIDO DO EXERCÍCIO", "", totais.lucroLiquido);

 // Nao Classificados
 if (grupos.naoClassificado.total > 0) {
 appendRow("NÃO CLASSIFICADO", "Sem Categoria Pai", grupos.naoClassificado.total);
 grupos.naoClassificado.filhasArray.forEach(f => appendRow("", f.nome, f.total));
 }

 // Força download
 const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement("a");
 link.setAttribute("href", url);
 link.setAttribute("download", `DRE_Studio57.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 return (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 overflow-hidden flex flex-col print:shadow-none print:border-none print:m-0 print:p-0 s57-print-area">
 <div className="px-6 py-5 border-b border-gray-100 bg-blue-600 from-slate-50 to-white print:from-white print:to-white flex items-center justify-between">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Demonstração do Resultado do Exercício (DRE)</h3>
 <p className="text-sm text-slate-500 font-medium">Regime de Caixa • Consolidado por Categorias Mestres</p>
 </div>
 <div className="flex gap-4">
 <div className="bg-slate-100 rounded-lg px-4 py-2 border border-slate-200 print:hidden flex items-center justify-between gap-4">
 <div>
 <span className="text-xs text-slate-500 block font-semibold mb-0.5 uppercase tracking-wide">Margem Líquida</span>
 <span className="font-bold text-slate-800">{totais.margemLiquida.toFixed(1)}%</span>
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

 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-gray-50/80 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
 <th className="py-3 px-6 h-10 w-3/4">Descrição da Conta</th>
 <th className="py-3 px-6 h-10 w-1/4 text-right">Valor R$</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {/* 1. Receita Bruta */}
 <LinhaMestre
 titulo={grupos.receitaBruta.mestre?.nome || '1. Receita Bruta'}
 valor={grupos.receitaBruta.total}
 filhas={grupos.receitaBruta.filhasArray}
 corTexto="text-slate-800"
 defaultOpen={true}
 />
 {/* 2. Deduções */}
 <LinhaMestre
 titulo={grupos.deducoes.mestre?.nome || '2. Deduções'}
 valor={grupos.deducoes.total}
 filhas={grupos.deducoes.filhasArray}
 subtrair={true}
 />

 {/* LÍQUIDA */}
 <LinhaTotal
 titulo="(=) Receita Operacional Líquida"
 valor={totais.receitaLiquida}
 info="Receita Bruta - Deduções. É o faturamento real que entrou."
 />

 {/* 3. Custos Operacionais */}
 <LinhaMestre
 titulo={grupos.custos.mestre?.nome || '3. Custos Operacionais (CMV/CSV)'}
 valor={grupos.custos.total}
 filhas={grupos.custos.filhasArray}
 subtrair={true}
 />

 {/* LUCRO BRUTO */}
 <LinhaTotal
 titulo="(=) Lucro Bruto Operacional"
 valor={totais.lucroBruto}
 info="Receita Líquida - Custos da Obra/Projetos. Indica o ganho gerado diretamente pelo core business."
 />

 {/* 4. Despesas Operacionais */}
 <LinhaMestre
 titulo={grupos.despesasOperacionais.mestre?.nome || '4. Despesas Operacionais'}
 valor={grupos.despesasOperacionais.total}
 filhas={grupos.despesasOperacionais.filhasArray}
 subtrair={true}
 />

 {/* RESULTADO OPERACIONAL */}
 <LinhaTotal
 titulo="(=) Resultado Operacional"
 valor={totais.resultadoOperacional}
 info="Lucro Bruto - Despesas Administrativas/Comerciais. Indica a eficiência da operação como um todo antes dos juros."
 />

 {/* 5.1 e 5.2. Resultado Financeiro */}
 <LinhaMestre
 titulo={grupos.receitasFinanceiras.mestre?.nome || '5.1 Receitas Financeiras'}
 valor={grupos.receitasFinanceiras.total}
 filhas={grupos.receitasFinanceiras.filhasArray}
 corTexto="text-slate-700"
 />
 <LinhaMestre
 titulo={grupos.despesasFinanceiras.mestre?.nome || '5.2 Despesas Financeiras'}
 valor={grupos.despesasFinanceiras.total}
 filhas={grupos.despesasFinanceiras.filhasArray}
 subtrair={true}
 />

 {/* RESULTADO ANTES DOS IMPOSTOS */}
 <LinhaTotal
 titulo="(=) Resultado Antes do IRPJ/CSLL"
 valor={totais.resultadoAntesImpostos}
 />

 {/* 6. Impostos sobre o Lucro */}
 <LinhaMestre
 titulo={grupos.impostosLucro.mestre?.nome || '6. IRPJ e CSLL (Lucro)'}
 valor={grupos.impostosLucro.total}
 filhas={grupos.impostosLucro.filhasArray}
 subtrair={true}
 />

 {/* RESULTADO LÍQUIDO FINAL */}
 <LinhaTotal
 titulo="(=) Resultado Líquido do Exercício"
 valor={totais.lucroLiquido}
 principal={true}
 info="Valor final gerado pela empresa de fato (Lucro ou Prejuízo) e que sobra livre na última linha."
 />

 {/* Não Classificados / Perdidos */}
 {grupos.naoClassificado.total > 0 && (
 <LinhaMestre
 titulo="⚠️ Lançamentos Não Classificados / Sem Categoria Pai"
 valor={grupos.naoClassificado.total}
 filhas={grupos.naoClassificado.filhasArray}
 subtrair={true}
 corTexto="text-blue-600"
 />
 )}
 </tbody>
 </table>
 </div>
 </div>
 );
}
