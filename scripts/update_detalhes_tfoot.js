const fs = require('fs');
const file = 'c:/projetos/studio57so-v8-main/components/orcamento/OrcamentoDetalhes.js';
let content = fs.readFileSync(file, 'utf8');

// The file might contain \r\n, normalize to \n for matching
content = content.replace(/\r\n/g, '\n');

const tfootOld = `<tfoot className="bg-gray-100">
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
 </tfoot>`;

// Replace `colSpan="9"` with `colSpan="7"`, and manually list the other 4 columns!
const tfootNew = `<tfoot className="bg-gray-100">
 <tr>
 <td colSpan="7" className="px-6 py-3 text-right text-sm font-bold uppercase text-gray-500 border-b border-gray-200">Custo Total Previsto (Alvo):</td>
 <td className="px-6 py-3 text-right text-base font-bold text-gray-700 border-b border-gray-200">{formatCurrency(custoTotal)}</td>
 <td className="px-6 py-3 text-right text-sm font-bold text-gray-400 border-b border-gray-200">100.00%</td>
 <td className="px-6 py-3 text-center text-sm font-bold text-gray-400 border-b border-gray-200">-</td>
 <td className="px-6 py-3 border-b border-gray-200"></td>
 </tr>
 <tr className="bg-blue-50">
 <td colSpan="7" className="px-6 py-4 text-right text-sm font-bold uppercase text-blue-800">Custo Total Executado (Realizado):</td>
 <td className="px-6 py-4 text-right text-base font-bold text-green-700">{formatCurrency(patrimonioExecutado)}</td>
 <td className="px-6 py-4 text-right text-sm font-bold text-gray-400">-</td>
 <td className="px-6 py-4 text-center text-lg font-bold text-blue-700">{percentualTotalObra.toFixed(2)}%</td>
 <td className="px-6 py-4"></td>
 </tr>
 </tfoot>`;

if (content.includes(tfootOld)) {
    content = content.replace(tfootOld, tfootNew);
    fs.writeFileSync(file, content);
    console.log('TFOOT foi atualizado com colSpan separados!');
} else {
    console.log('TFOOT antigo não encontrado. Veja se o código atual corresponde.');
}
