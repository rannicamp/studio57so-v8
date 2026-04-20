const fs = require('fs');
const file = 'c:/projetos/studio57so-v8-main/components/orcamento/OrcamentoDetalhes.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\r\n/g, '\n');

// Missing 'td' for % Executado in the items array (isRealSubetapa = true AND false! Actually both item maps should have it)
const regexItem = /<td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">\{formatPercentage\(item\.custo_total\)\}<\/td>\n\s+<td className="px-6 py-4 text-sm text-center">/g;

content = content.replace(regexItem, '<td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage(item.custo_total)}</td>\n <td className="px-6 py-4 text-sm text-center">-</td>\n <td className="px-6 py-4 text-sm text-center">');

fs.writeFileSync(file, content);
console.log('Update de Colunas - itens reparado');
