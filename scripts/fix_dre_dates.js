const fs = require('fs');
const filePath = 'components/relatorios/financeiro/RelatorioDREContainer.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/startDate:\s*`\$\{new Date\(\)\.getFullYear\(\)\}-01-01`/, "startDate: ''");
content = content.replace(/endDate:\s*`\$\{new Date\(\)\.getFullYear\(\)\}-12-31`/, "endDate: ''");

fs.writeFileSync(filePath, content);
console.log('Fixed dates in RelatorioDREContainer.js');
