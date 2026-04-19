const fs = require('fs');
const file = 'c:/projetos/studio57so-v8-main/components/orcamento/OrcamentoDetalhes.js';
let content = fs.readFileSync(file, 'utf8');

// Thead
content = content.replace('<th className="px-6 py-3 text-right text-xs font-bold uppercase">% do Total</th>', '<th className="px-6 py-3 text-right text-xs font-bold uppercase">% do Total</th>\n <th className="px-6 py-3 text-center text-xs font-bold uppercase">% Executado</th>');

// Group Row
content = content.replace(
'<td className="px-6 py-3 border-t-4 border-gray-300"></td>',
'<td className="px-6 py-2 border-t-4 border-gray-300 text-center">\n <input type="text" className="w-16 text-center font-bold text-green-700 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" value={execucao[group.id] !== undefined ? execucao[group.id] + \'%\' : \'0%\'} onChange={(e) => handleExecucaoChange(group.id, e.target.value)} onBlur={handleExecucaoBlur} />\n </td>\n <td className="px-6 py-3 border-t-4 border-gray-300"></td>'
);

// Subgroup Row
content = content.replace(
'<td className="px-6 py-2 text-right text-blue-600">{formatPercentage(subgroup.total)}</td>\n <td></td>',
'<td className="px-6 py-2 text-right text-blue-600">{formatPercentage(subgroup.total)}</td>\n <td></td>\n <td></td>'
);

// Subgroup items
content = content.replace(
/<td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage\(item\.custo_total\)}<\/td>\n <td className="px-6 py-4 text-sm text-center">/g,
'<td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage(item.custo_total)}</td>\n <td></td>\n <td className="px-6 py-4 text-sm text-center">'
);

// Tfoot
content = content.replace(
/<tfoot className="bg-gray-100">\n <tr>\n <td colSpan="9" className="px-6 py-3 text-right text-sm font-bold uppercase">Custo Total Previsto:<\/td>\n <td className="px-6 py-3 text-right text-base font-bold">{formatCurrency\(custoTotal\)}<\/td>\n <\/tr>\n <\/tfoot>/g,
`<tfoot className="bg-gray-100">
 <tr>
 <td colSpan="9" className="px-6 py-3 text-right text-sm font-bold uppercase text-gray-500 border-b border-gray-200">Custo Total Previsto (Patrimônio Alvo):</td>
 <td colSpan="2" className="px-6 py-3 text-right text-base font-bold text-gray-500 border-b border-gray-200">{formatCurrency(custoTotal)}</td>
 </tr>
 <tr className="bg-blue-50">
 <td colSpan="9" className="px-6 py-4 text-right text-sm font-bold uppercase text-blue-800">
 <span className="mr-2">Soma da Execução Física:</span>
 <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">{percentualTotalObra.toFixed(2)}%</span>
 </td>
 <td colSpan="2" className="px-6 py-4 text-right text-xl font-bold text-green-700">{formatCurrency(patrimonioExecutado)}</td>
 </tr>
 </tfoot>`
);

// Colspans format
content = content.replace(/colSpan="10"/g, 'colSpan="11"');

fs.writeFileSync(file, content);
console.log('Script finalizado');
