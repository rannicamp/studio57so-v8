// components/relatorios/obras/FinanceiroObrasDRE.js
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronDown, faSpinner, faPrint, faFileCsv, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatBR(valor) {
    if (!valor && valor !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

// === LINHA OBRAS MATRIZ ===
const LinhaMestreMatriz = ({ titulo, valorTotal, mensal, colunasMeses, filhas, corTexto = 'text-slate-700', defaultOpen = false, mesAtualStr, custoTotalGlobal, offsets }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const temFilhas = filhas && filhas.length > 0;

    const percentualGlobal = custoTotalGlobal > 0 ? (valorTotal / custoTotalGlobal) * 100 : 0;
    const avFormatada = percentualGlobal.toFixed(2).replace('.', ',') + '%';

    return (
        <>
            <tr
                className={`hover:bg-gray-50/80 transition-colors ${temFilhas ? 'cursor-pointer' : ''} border-b border-gray-200 group bg-white`}
                onClick={() => temFilhas && setIsOpen(!isOpen)}
            >
                {/* COLUNA 1: DESCRIÇÃO CONGELADA */}
                <td className="py-4 px-6 sticky left-0 z-10 bg-white border-r border-gray-200 whitespace-nowrap group-hover:bg-gray-50 transition-colors">
                    <div className="flex items-center">
                        <div className="w-6 flex justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                            {temFilhas && (
                                <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} className="text-sm" />
                            )}
                        </div>
                        <span className={`font-bold ml-2 ${corTexto} whitespace-nowrap`} title={titulo}>{titulo}</span>
                    </div>
                </td>
                
                {/* COLUNA 2: ANÁLISE VERTICAL % CONGELADA */}
                <td 
                    className="py-4 px-4 sticky z-10 bg-slate-50 border-r border-gray-200 text-center font-bold text-slate-500 text-[11px] group-hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ left: `${offsets.col2}px` }}
                >
                    {avFormatada}
                </td>

                {/* COLUNA 3: TOTAL GERAL R$ CONGELADA */}
                <td 
                    className="py-4 px-6 text-right font-bold text-gray-800 bg-slate-50 border-r border-gray-200 sticky z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ left: `${offsets.col3}px` }}
                >
                    {formatBR(valorTotal)}
                </td>

                {/* COLUNAS: MESES MATRIZ */}
                {colunasMeses.map((mesCol) => {
                    const isAtual = mesCol === mesAtualStr;
                    return (
                        <td key={mesCol} className={`py-4 px-6 text-right font-medium whitespace-nowrap transition-colors ${
                            isAtual 
                            ? 'bg-blue-50 border-l-2 border-r-2 border-blue-400 text-blue-800 font-bold shadow-inner' 
                            : 'text-gray-600 border-r border-gray-100'
                        }`}>
                            {formatBR(mensal[mesCol] || 0)}
                        </td>
                    );
                })}
            </tr>

            {isOpen && temFilhas && filhas.map((filha, idx) => {
                const filhaAV = custoTotalGlobal > 0 ? (filha.total / custoTotalGlobal) * 100 : 0;
                const filhaAVStr = filhaAV.toFixed(2).replace('.', ',') + '%';
                
                return (
                <tr key={idx} className="bg-white border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-colors group">
                    <td className="py-2.5 px-6 pl-14 text-sm text-gray-600 flex items-center sticky left-0 z-10 bg-white border-r border-gray-200 whitespace-nowrap group-hover:bg-slate-50 transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-3"></div>
                        <span className="whitespace-nowrap block" title={filha.nome}>{filha.nome}</span>
                    </td>
                    
                    <td 
                        className="py-2.5 px-4 sticky z-10 bg-white border-r border-gray-200 text-center text-gray-400 text-[11px] group-hover:bg-slate-50 transition-colors whitespace-nowrap"
                        style={{ left: `${offsets.col2}px` }}
                    >
                        {filhaAVStr}
                    </td>

                    <td 
                        className="py-2.5 px-6 text-right text-sm text-gray-700 font-semibold bg-gray-50 border-r border-gray-200 sticky z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-gray-100 transition-colors whitespace-nowrap"
                        style={{ left: `${offsets.col3}px` }}
                    >
                        {formatBR(filha.total)}
                    </td>

                    {/* COLUNAS MENSAIS (FILHAS) */}
                    {colunasMeses.map((mesCol) => {
                        const isAtual = mesCol === mesAtualStr;
                        return (
                            <td key={`filha-${idx}-${mesCol}`} className={`py-2.5 px-6 text-right text-sm whitespace-nowrap ${
                                isAtual
                                ? 'bg-blue-50/50 border-l-2 border-r-2 border-blue-300 text-blue-700 font-semibold'
                                : 'text-gray-500 border-r border-gray-100'
                            }`}>
                                {formatBR(filha.mensal[mesCol] || 0)}
                            </td>
                        );
                    })}
                </tr>
            )})}
        </>
    );
};

export default function FinanceiroObrasDRE({ dadosDRE, isLoading }) {
    const tableRef = useRef(null);
    const [offsets, setOffsets] = useState({ col2: 320, col3: 410 });
    const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'asc' });

    const gruposListaSegura = dadosDRE?.gruposLista || [];
    
    const sortedGruposLista = useMemo(() => {
        if (!gruposListaSegura.length) return [];
        let sortable = [...gruposListaSegura];
        
        sortable.sort((a, b) => {
            if (sortConfig.key === 'nome') {
                return sortConfig.direction === 'asc' 
                    ? a.mestre.nome.localeCompare(b.mestre.nome)
                    : b.mestre.nome.localeCompare(a.mestre.nome);
            }
            if (sortConfig.key === 'total') {
                return sortConfig.direction === 'asc'
                    ? a.total - b.total
                    : b.total - a.total;
            }
            return 0;
        });

        sortable = sortable.map(grupo => {
            let sortedFilhas = [...grupo.filhasArray];
            sortedFilhas.sort((a, b) => {
                if (sortConfig.key === 'nome') {
                    return sortConfig.direction === 'asc' 
                        ? a.nome.localeCompare(b.nome)
                        : b.nome.localeCompare(a.nome);
                }
                if (sortConfig.key === 'total') {
                    return sortConfig.direction === 'asc'
                        ? a.total - b.total
                        : b.total - a.total;
                }
                return 0;
            });
            return { ...grupo, filhasArray: sortedFilhas };
        });

        return sortable;
    }, [gruposListaSegura, sortConfig]);

    useEffect(() => {
        if (!tableRef.current) return;

        const observer = new ResizeObserver((entries) => {
            requestAnimationFrame(() => {
                if (!tableRef.current) return;
                const th1 = tableRef.current.querySelector('.calc-col-1');
                const th2 = tableRef.current.querySelector('.calc-col-2');
                if (th1 && th2) {
                    setOffsets({
                        col2: th1.offsetWidth,
                        col3: th1.offsetWidth + th2.offsetWidth
                    });
                }
            });
        });

        const thead = tableRef.current.querySelector('thead');
        if (thead) {
            observer.observe(thead); // Monitorando thead ou células fará recalcular tudo
            // Force um calculo inicial tbm
            const th1 = tableRef.current.querySelector('.calc-col-1');
            const th2 = tableRef.current.querySelector('.calc-col-2');
            if (th1 && th2) {
                setOffsets({
                    col2: th1.offsetWidth,
                    col3: th1.offsetWidth + th2.offsetWidth
                });
            }
        }

        return () => observer.disconnect();
    }, [dadosDRE]);

    // Efeito para centralizar a barra de rolagem no mês atual automaticamente
    useEffect(() => {
        if (!isLoading && dadosDRE?.colunasMeses?.length > 0) {
            const timer = setTimeout(() => {
                const container = document.getElementById('scroll-container-dre');
                const targetCol = document.getElementById('mes-atual-col');
                
                if (container && targetCol) {
                    const containerWidth = container.clientWidth;
                    const colLeft = targetCol.offsetLeft;
                    const colWidth = targetCol.offsetWidth;
                    
                    // Considera as colunas congeladas (offsets.col3) para achar o meio da área realmente visível
                    const visibleAreaWidth = containerWidth - offsets.col3;
                    const scrollPos = colLeft - offsets.col3 - (visibleAreaWidth / 2) + (colWidth / 2);
                    
                    container.scrollTo({
                        left: Math.max(0, scrollPos),
                        behavior: 'smooth'
                    });
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isLoading, dadosDRE, offsets.col3]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200 mt-6 min-h-[400px]">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
                <p className="font-medium">Carregando Matriz Físico-Financeira...</p>
                <p className="text-sm text-gray-400 mt-2 text-center max-w-md">Processando laçamentos na linha do tempo horizontal das obras.</p>
            </div>
        );
    }

    if (!dadosDRE) return null;

    const { rootCategory, gruposLista, totais, colunasMeses = [] } = dadosDRE;
    const mesAtualStr = format(new Date(), 'yyyy-MM');

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    let displayColumns = colunasMeses;

    const formatarNomeColuna = (yyyyMmStr) => {
        try {
            const [ano, mes] = yyyyMmStr.split('-');
            const dataObjeto = new Date(ano, parseInt(mes, 10) - 1, 15);
            return format(dataObjeto, 'MMM/yy', { locale: ptBR }).toUpperCase();
        } catch {
            return yyyyMmStr;
        }
    };

    const handleExportCSV = () => {
        if (!sortedGruposLista.length) return;

        let colHeaders = displayColumns.map(formatarNomeColuna).join(';');
        let csvContent = `ESTRUTURA DE CUSTOS DE OBRAS;AV %;TOTAL CUSTEIO;${colHeaders}\n`;

        sortedGruposLista.forEach(grupo => {
            const linhaGeral = displayColumns.map(m => (grupo.mensal[m] || 0).toFixed(2).replace('.', ',')).join(';');
            const av = totais.custoObraTotal > 0 ? ((grupo.total / totais.custoObraTotal) * 100).toFixed(2).replace('.', ',') + '%' : '0%';
            csvContent += `${grupo.mestre.nome};${av};${grupo.total.toFixed(2).replace('.', ',')};${linhaGeral}\n`;
            
            grupo.filhasArray.forEach(filha => {
                const linhaFilha = displayColumns.map(m => (filha.mensal[m] || 0).toFixed(2).replace('.', ',')).join(';');
                const avf = totais.custoObraTotal > 0 ? ((filha.total / totais.custoObraTotal) * 100).toFixed(2).replace('.', ',') + '%' : '0%';
                csvContent += `${filha.nome};${avf};${filha.total.toFixed(2).replace('.', ',')};${linhaFilha}\n`;
            });
        });

        const totaisCSV = displayColumns.map(m => ((totais.totaisMensais && totais.totaisMensais[m]) || 0).toFixed(2).replace('.', ',')).join(';');
        csvContent += `TOTAL DO NEGÓCIO;100%;${totais.custoObraTotal.toFixed(2).replace('.', ',')};${totaisCSV}\n`;

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Custeio_Obras_Matriz_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 overflow-hidden flex flex-col print:shadow-none print:border-none print:m-0 print:p-0 s57-print-area">
            {/* CABEÇALHO DO CARD MATRIZ */}
            <div className="px-6 py-5 border-b border-gray-100 bg-slate-50 print:from-white print:to-white flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">
                        Matriz Estrutural de Custos Const. Civil
                    </h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Conta Centralizadora: {rootCategory?.nome || 'Custo Obra'} • Regime Efetivo Caixa
                    </p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="bg-white rounded-lg px-4 py-2 border border-slate-200 print:hidden flex items-center justify-between gap-4 w-full">
                        <div>
                            <span className="text-xs text-slate-500 block font-semibold mb-0.5 uppercase tracking-wide">Custo Total Global</span>
                            <span className="font-bold text-slate-800 text-lg">{formatBR(totais.custoObraTotal)}</span>
                        </div>
                        <div className="border-l border-slate-200 pl-4 flex gap-2">
                            <button
                                onClick={() => window.print()}
                                className="w-8 h-8 flex items-center justify-center rounded bg-white hover:bg-gray-100 text-slate-600 transition-colors border border-slate-200 shadow-sm"
                                title="Imprimir Relatório (PDF)"
                            >
                                <FontAwesomeIcon icon={faPrint} />
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="w-8 h-8 flex items-center justify-center rounded bg-white hover:bg-gray-100 text-slate-600 transition-colors border border-slate-200 shadow-sm"
                                title="Exportar Matriz para CSV"
                            >
                                <FontAwesomeIcon icon={faFileCsv} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* A MATRIZ SCROLLÁVEL HORIZONTE */}
            <div id="scroll-container-dre" className="overflow-x-auto relative w-full border-t border-gray-200 pb-2 custom-scrollbar">
                <table ref={tableRef} className="w-auto text-left border-collapse bg-white min-w-max">
                    <thead>
                        <tr className="bg-slate-100 border-b-2 border-slate-200 text-xs uppercase tracking-wider text-slate-600 font-bold whitespace-nowrap">
                            <th 
                                className="calc-col-1 py-4 px-6 h-12 sticky left-0 z-20 bg-slate-100 border-r border-slate-200 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-slate-200 transition-colors"
                                onClick={() => handleSort('nome')}
                            >
                                Descrição do Padrão Construtivo
                                <FontAwesomeIcon 
                                    icon={sortConfig.key === 'nome' ? (sortConfig.direction === 'asc' ? faSortUp : faSortDown) : faSort} 
                                    className={`ml-2 ${sortConfig.key === 'nome' ? 'text-blue-500' : 'text-slate-400'}`} 
                                />
                            </th>
                            <th 
                                className="calc-col-2 py-4 px-4 h-12 sticky z-20 text-center bg-slate-100 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors"
                                style={{ left: `${offsets.col2}px` }}
                                onClick={() => handleSort('total')}
                            >
                                AV %
                                <FontAwesomeIcon 
                                    icon={sortConfig.key === 'total' ? (sortConfig.direction === 'asc' ? faSortUp : faSortDown) : faSort} 
                                    className={`ml-2 ${sortConfig.key === 'total' ? 'text-blue-500' : 'text-slate-400'}`} 
                                />
                            </th>
                            <th 
                                className="calc-col-3 py-4 px-6 h-12 text-right sticky z-20 whitespace-nowrap border-r border-slate-200 text-slate-800 bg-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-slate-300 transition-colors"
                                style={{ left: `${offsets.col3}px` }}
                                onClick={() => handleSort('total')}
                            >
                                Total Custeio R$
                                <FontAwesomeIcon 
                                    icon={sortConfig.key === 'total' ? (sortConfig.direction === 'asc' ? faSortUp : faSortDown) : faSort} 
                                    className={`ml-2 ${sortConfig.key === 'total' ? 'text-blue-500' : 'text-slate-400'}`} 
                                />
                            </th>
                            {displayColumns.map(mes => {
                                const isAtual = mes === mesAtualStr;
                                return (
                                    <th 
                                        key={mes} 
                                        id={isAtual ? "mes-atual-col" : undefined}
                                        className={`py-4 px-6 h-12 text-right whitespace-nowrap transition-colors ${
                                            isAtual 
                                            ? 'bg-blue-100 border-l-2 border-r-2 border-blue-500 text-blue-900 shadow-inner' 
                                            : 'border-r border-slate-200'
                                        }`}
                                    >
                                        {formatarNomeColuna(mes)}
                                        {isAtual && <div className="text-[10px] text-blue-600 block mt-0.5 tracking-tight">MÊS ATUAL</div>}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedGruposLista.length === 0 ? (
                            <tr>
                                <td colSpan={displayColumns.length + 3} className="py-12 text-center text-gray-500 sticky left-0">
                                    Nenhum custo lançado ou efetivado no horizonte de pesquisa.
                                </td>
                            </tr>
                        ) : (
                            sortedGruposLista.map((grupo, index) => (
                                <LinhaMestreMatriz
                                    key={grupo.mestre.id || index}
                                    titulo={grupo.mestre.nome}
                                    valorTotal={grupo.total}
                                    mensal={grupo.mensal}
                                    colunasMeses={displayColumns}
                                    filhas={grupo.filhasArray}
                                    defaultOpen={index === 0}
                                    mesAtualStr={mesAtualStr}
                                    custoTotalGlobal={totais.custoObraTotal}
                                    offsets={offsets}
                                />
                            ))
                        )}

                        {/* RODAPÉ DO DRE: TOTAIS POR COLUNA */}
                        {sortedGruposLista.length > 0 && (
                            <tr className="bg-slate-800 text-white shadow-inner font-extrabold text-sm border-t-4 border-slate-900 sticky bottom-0 z-30">
                                <td className="py-5 px-6 sticky left-0 z-40 bg-slate-800 border-r border-slate-700 whitespace-nowrap">
                                    <div className="flex items-center">
                                        TOTAL DA CONSTRUÇÃO
                                    </div>
                                </td>
                                <td 
                                    className="py-5 px-4 sticky z-40 bg-slate-800 border-r border-slate-700 text-center whitespace-nowrap text-blue-300"
                                    style={{ left: `${offsets.col2}px` }}
                                >
                                    100,00%
                                </td>
                                <td 
                                    className="py-5 px-6 text-right border-r border-slate-700 font-black text-blue-200 text-base sticky z-40 bg-slate-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)]"
                                    style={{ left: `${offsets.col3}px` }}
                                >
                                    {formatBR(totais.custoObraTotal)}
                                </td>
                                {displayColumns.map(mes => {
                                    const isAtual = mes === mesAtualStr;
                                    return (
                                        <td key={mes} className={`py-5 px-6 text-right whitespace-nowrap transition-colors ${
                                            isAtual 
                                            ? 'bg-blue-900 border-l-2 border-r-2 border-blue-400 text-white font-black shadow-inner' 
                                            : 'border-r border-slate-700 text-slate-300'
                                        }`}>
                                            {formatBR(totais.totaisMensais && totais.totaisMensais[mes] ? totais.totaisMensais[mes] : 0)}
                                        </td>
                                    );
                                })}
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Dica visual de Scroll */}
            <div className="bg-slate-50 text-slate-400 text-xs p-2 text-center border-t border-gray-100 hidden md:block">
                Dica: Use <strong>Shift + Roda do Mouse</strong> para rolar horizontalmente a planilha.
            </div>
        </div>
    );
}
