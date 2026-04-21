const fs = require('fs');
const file = 'components/financeiro/LancamentoFormModal.js';
let c = fs.readFileSync(file, 'utf8');
c = c.replace("queryKey: ['ativos-disponiveis', organizacaoId]", "queryKey: ['ativos-passivos-disponiveis', organizacaoId]");
fs.writeFileSync(file, c);
