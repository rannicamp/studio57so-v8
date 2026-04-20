const fs = require('fs');
const file = 'c:/projetos/studio57so-v8-main/components/orcamento/OrcamentoDetalhes.js';
let content = fs.readFileSync(file, 'utf8');

// Normalize line endings to avoid \r\n issues in matching MULTILINE STRINGS
content = content.replace(/\r\n/g, '\n');

// Group Row
content = content.replace(
'<td colSpan="7" className="px-6 py-3 border-t-4 border-gray-300">{group.codigo} - {group.nome}</td>\n                  <td className="px-6 py-3 text-right border-t-4 border-gray-300">{formatCurrency(group.total)}</td>\n                  <td className="px-6 py-3 text-right border-t-4 border-gray-300 text-blue-700">{formatPercentage(group.total)}</td>\n                  <td className="px-6 py-3 border-t-4 border-gray-300"></td>',
'<td colSpan="7" className="px-6 py-3 border-t-4 border-gray-300">{group.codigo} - {group.nome}</td>\n                  <td className="px-6 py-3 text-right border-t-4 border-gray-300">{formatCurrency(group.total)}</td>\n                  <td className="px-6 py-3 text-right border-t-4 border-gray-300 text-blue-700">{formatPercentage(group.total)}</td>\n                  <td className="px-6 py-2 border-t-4 border-gray-300 text-center">\n                    <input type="text" className="w-16 text-center font-bold text-green-700 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" value={execucao[group.id] !== undefined ? execucao[group.id] + \'%\' : \'0%\'} onChange={(e) => handleExecucaoChange(group.id, e.target.value)} onBlur={handleExecucaoBlur} />\n                  </td>\n                  <td className="px-6 py-3 border-t-4 border-gray-300"></td>'
);

// Tfoot
content = content.replace(
'<tfoot className="bg-gray-100">\n            <tr>\n              <td colSpan="9" className="px-6 py-3 text-right text-sm font-bold uppercase">Custo Total Previsto:</td>\n              <td className="px-6 py-3 text-right text-base font-bold">{formatCurrency(custoTotal)}</td>\n            </tr>\n          </tfoot>',
'<tfoot className="bg-gray-100">\n            <tr>\n              <td colSpan="9" className="px-6 py-3 text-right text-sm font-bold uppercase text-gray-500 border-b border-gray-200">Custo Total Previsto (Patrimônio Alvo):</td>\n              <td colSpan="2" className="px-6 py-3 text-right text-base font-bold text-gray-500 border-b border-gray-200">{formatCurrency(custoTotal)}</td>\n            </tr>\n            <tr className="bg-blue-50">\n              <td colSpan="9" className="px-6 py-4 text-right text-sm font-bold uppercase text-blue-800">\n                <span className="mr-2">Soma da Execução Física:</span>\n                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">{percentualTotalObra.toFixed(2)}%</span>\n              </td>\n              <td colSpan="2" className="px-6 py-4 text-right text-xl font-bold text-green-700">{formatCurrency(patrimonioExecutado)}</td>\n            </tr>\n          </tfoot>'
);

// The colSpans need to be expanded. We previously did replace(/colSpan="10"/g, 'colSpan="11"');
// Let's do it carefully for the other subetapa rows too...
content = content.replace(/colSpan="10"/g, 'colSpan="11"');

fs.writeFileSync(file, content);
console.log('Script finalizado. Arquivo gravado.');
