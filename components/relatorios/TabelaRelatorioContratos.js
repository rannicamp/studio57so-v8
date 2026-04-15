"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatMonthName = (yyyy_mm) => {
  if (!yyyy_mm) return '';
  const [yyyy, mm] = yyyy_mm.split('-');
  const date = new Date(yyyy, mm - 1, 1);
  return date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase().replace('.', '');
}

export default function TabelaRelatorioContratos({ contratos, periodoFiltro }) {
  const [busca, setBusca] = useState('');

  const filtrados = contratos.filter(c => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      c.contato?.nome?.toLowerCase().includes(termo) ||
      c.contato?.razao_social?.toLowerCase().includes(termo) ||
      c.numero_contrato?.toString().includes(termo) ||
      c.id?.toString().includes(termo) ||
      c.unidadesDisplay?.toLowerCase().includes(termo) ||
      c.empreendimento?.nome?.toLowerCase().includes(termo)
    );
  });

  const totalVGV = filtrados.reduce((acc, c) => acc + (c.valor_final_venda || 0), 0);
  const totalPago = filtrados.reduce((acc, c) => acc + (c.valorPago || 0), 0);
  const totalRecebidoNoMes = filtrados.reduce((acc, c) => acc + (c.valorRecebidoNoMes || 0), 0);
  const totalAPagar = filtrados.reduce((acc, c) => acc + (c.saldoAPagar || 0), 0);
  const percentualGeral = totalVGV > 0 ? (totalPago / totalVGV) * 100 : 0;

  const nomeMes = formatMonthName(periodoFiltro);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Buscar por cliente, documento, Nº contrato..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm placeholder-gray-400"
          />
          <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-3.5 text-gray-400" />
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white border-b border-gray-100 text-gray-400 font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">ID/Nº</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Emp./Unidade</th>
              <th className="px-6 py-4 text-right">VGV Total</th>
              {periodoFiltro && (
                 <th className="px-6 py-4 text-right text-blue-600 bg-blue-50/50">Rec. ({nomeMes})</th>
              )}
              <th className="px-6 py-4 text-right">Global Pago</th>
              <th className="px-6 py-4 text-right">A Pagar</th>
              <th className="px-6 py-4 w-48">Quitação (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length > 0 ? filtrados.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${c.colorBadge}`}>
                    {c.statusBadge}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-extrabold text-gray-800">#{c.id}</div>
                  <div className="text-xs font-semibold text-gray-400">Nº {c.numero_contrato || '--'}</div>
                </td>
                <td className="px-6 py-4 font-bold text-gray-800">
                  {c.contato?.nome || c.contato?.razao_social || 'Desconhecido'}
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-800">{c.empreendimento?.nome || '--'}</div>
                  <div className="text-xs font-semibold text-gray-500">Un. {c.unidadesDisplay}</div>
                </td>
                <td className="px-6 py-4 text-right font-black text-gray-700">
                  {formatCurrency(c.valor_final_venda)}
                </td>
                {periodoFiltro && (
                  <td className="px-6 py-4 text-right font-black text-blue-600 bg-blue-50/20">
                    {formatCurrency(c.valorRecebidoNoMes)}
                  </td>
                )}
                <td className="px-6 py-4 text-right font-black text-green-600">
                  {formatCurrency(c.valorPago)}
                </td>
                <td className="px-6 py-4 text-right font-black text-gray-800 opacity-60">
                  {formatCurrency(c.saldoAPagar)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <div className="flex justify-between text-xs font-bold text-gray-500">
                      <span>{Math.round(c.progresso)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${c.progresso >= 100 ? 'bg-purple-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, c.progresso))}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={periodoFiltro ? "9" : "8"} className="px-6 py-10 text-center font-semibold text-gray-500">
                  Nenhum contrato encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot className="bg-gray-100/70 border-t-2 border-gray-200 text-gray-800 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <tr>
                <td colSpan="4" className="px-6 py-4 text-right uppercase text-xs font-black tracking-widest text-gray-400">
                  Totais ({filtrados.length})
                </td>
                <td className="px-6 py-4 text-right font-black text-gray-800 border-l border-white/50">
                  {formatCurrency(totalVGV)}
                </td>
                {periodoFiltro && (
                  <td className="px-6 py-4 text-right font-black text-blue-600 bg-blue-100/30">
                    {formatCurrency(totalRecebidoNoMes)}
                  </td>
                )}
                <td className="px-6 py-4 text-right font-black text-green-700 bg-green-50/30">
                  {formatCurrency(totalPago)}
                </td>
                <td className="px-6 py-4 text-right font-black text-red-500 bg-red-50/30">
                  {formatCurrency(totalAPagar)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <div className="flex justify-between text-[11px] font-black text-gray-700 uppercase tracking-wider">
                      <span>Média: {Math.round(percentualGeral)}% Pago</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${percentualGeral >= 100 ? 'bg-purple-600' : 'bg-green-600'}`}
                        style={{ width: `${Math.min(100, Math.max(0, percentualGeral))}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
