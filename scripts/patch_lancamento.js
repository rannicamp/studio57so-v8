const fs = require('fs'); 
const file = 'components/financeiro/LancamentoFormModal.js'; 
let c = fs.readFileSync(file, 'utf8'); 
c = c.replace('ativosDisponiveis={ativosDisponiveis}', 'ativosDisponiveis={ativosDisponiveis.filter(a => a.tipo === "Ativo")}\n        passivosDisponiveis={ativosDisponiveis.filter(a => a.tipo === "Passivo")}'); 
fs.writeFileSync(file, c);
